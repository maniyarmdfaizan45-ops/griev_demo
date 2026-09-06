import os
import json
import re
import sqlite3
import uuid
from datetime import datetime
from pymongo import MongoClient, ReturnDocument
from pymongo.errors import ConnectionFailure
from departments import DEPARTMENT_BY_CATEGORY, DEPARTMENTS, get_department_for_category
from sla import calculate_deadline, calculate_sla_status, resolution_hours
from escalation import (
    ESCALATION_ESCALATED,
    ESCALATION_LEVEL_DEPARTMENT,
    ESCALATION_NOT_ESCALATED,
    ESCALATION_REASON_SLA_BREACHED,
    is_eligible_for_escalation,
)

STATUS_VALUES = ["SUBMITTED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED", "REOPENED"]
STATUS_ALIASES = {
    "PENDING": "SUBMITTED",
    "IN PROGRESS": "IN_PROGRESS",
    "RESOLVED": "RESOLVED",
    "SUBMITTED": "SUBMITTED",
    "ASSIGNED": "ASSIGNED",
    "IN_PROGRESS": "IN_PROGRESS",
    "CLOSED": "CLOSED",
    "REOPENED": "REOPENED",
}
ALLOWED_TRANSITIONS = {
    "SUBMITTED": {"ASSIGNED"},
    "ASSIGNED": {"IN_PROGRESS"},
    "IN_PROGRESS": {"RESOLVED"},
    "RESOLVED": {"CLOSED", "REOPENED"},
    "REOPENED": {"IN_PROGRESS"},
    "CLOSED": set(),
}


def normalize_status(status):
    normalized = str(status or "").strip().upper()
    return STATUS_ALIASES.get(normalized, normalized)


def grievance_year(timestamp):
    year = str(timestamp or "")[:4]
    return year if year.isdigit() else str(datetime.utcnow().year)


def format_grievance_id(year, number):
    return f"GRV-{year}-{number:06d}"


class GrievanceDB:
    def __init__(self):
        self.db_type = None  # 'mongodb' or 'sqlite'
        self.mongo_client = None
        self.mongo_db = None
        self.sqlite_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "complaints.db")
        
        self.initialize_connection()

    def initialize_connection(self):
        mongo_uri = os.getenv("MONGO_URI")
        
        if mongo_uri:
            try:
                print("Attempting to connect to MongoDB...")
                # Set a short connection timeout so it falls back quickly if offline
                self.mongo_client = MongoClient(mongo_uri, serverSelectionTimeoutMS=3000)
                # Force a connection check
                self.mongo_client.admin.command('ping')
                
                db_name = os.getenv("MONGO_DB_NAME", "grievance_system")
                self.mongo_db = self.mongo_client[db_name]
                for legacy_status, canonical_status in {
                    "Pending": "SUBMITTED",
                    "In Progress": "IN_PROGRESS",
                    "Resolved": "RESOLVED",
                }.items():
                    self.mongo_db.complaints.update_many(
                        {"status": legacy_status}, {"$set": {"status": canonical_status}}
                    )
                for category, department in DEPARTMENT_BY_CATEGORY.items():
                    self.mongo_db.complaints.update_many(
                        {"category": category, "department": {"$in": [None, ""]}},
                        {"$set": {"department": department}},
                    )
                self._backfill_mongo_grievance_ids()
                self._backfill_mongo_sla()
                self.mongo_db.notifications.create_index("recipient")
                self.mongo_db.notifications.create_index("event_key", unique=True, sparse=True)
                self.db_type = 'mongodb'
                print(f"[INFO] Connected to MongoDB database: {db_name}")
                return
            except (ConnectionFailure, Exception) as e:
                print(f"[WARNING] MongoDB connection failed: {e}")
                print("Falling back to local SQLite database...")
        else:
            print("[INFO] MONGO_URI not set. Initializing local SQLite database...")

        # Fallback to SQLite
        self.db_type = 'sqlite'
        self.init_sqlite_db()
        print(f"[INFO] SQLite initialized at: {self.sqlite_path}")

    def init_sqlite_db(self):
        conn = sqlite3.connect(self.sqlite_path)
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS complaints (
                id TEXT PRIMARY KEY,
                complaint_text TEXT NOT NULL,
                category TEXT NOT NULL,
                priority TEXT NOT NULL,
                sentiment_score REAL NOT NULL,
                status TEXT NOT NULL DEFAULT 'SUBMITTED',
                timestamp TEXT NOT NULL,
                grievance_id TEXT,
                department TEXT,
                sla_deadline TEXT,
                sla_original_deadline TEXT,
                sla_started_at TEXT,
                sla_result TEXT,
                escalation_status TEXT NOT NULL DEFAULT 'NOT_ESCALATED',
                escalation_level INTEGER NOT NULL DEFAULT 0,
                escalated_at TEXT,
                escalation_reason TEXT,
                possible_duplicate INTEGER NOT NULL DEFAULT 0,
                related_grievances TEXT,
                assigned_to TEXT,
                assigned_at TEXT,
                resolution_date TEXT,
                resolution_remarks TEXT,
                resolved_by TEXT,
                closed_at TEXT,
                reopened_reason TEXT,
                reopened_by TEXT
            )
        """)
        columns = {row[1] for row in cursor.execute("PRAGMA table_info(complaints)")}
        for name, definition in {
            "grievance_id": "TEXT",
            "assigned_to": "TEXT",
            "department": "TEXT",
            "sla_deadline": "TEXT",
            "sla_original_deadline": "TEXT",
            "sla_started_at": "TEXT",
            "sla_result": "TEXT",
            "escalation_status": "TEXT",
            "escalation_level": "INTEGER",
            "escalated_at": "TEXT",
            "escalation_reason": "TEXT",
            "possible_duplicate": "INTEGER",
            "related_grievances": "TEXT",
            "assigned_at": "TEXT",
            "resolution_date": "TEXT",
            "resolution_remarks": "TEXT",
            "resolved_by": "TEXT",
            "closed_at": "TEXT",
            "reopened_reason": "TEXT",
            "reopened_by": "TEXT",
            "name": "TEXT",
            "phone": "TEXT",
            "location": "TEXT",
            "address": "TEXT",
        }.items():
            if name not in columns:
                cursor.execute(f"ALTER TABLE complaints ADD COLUMN {name} {definition}")

        cursor.execute("UPDATE complaints SET status = 'SUBMITTED' WHERE status = 'Pending'")
        cursor.execute("UPDATE complaints SET status = 'IN_PROGRESS' WHERE status = 'In Progress'")
        cursor.execute("UPDATE complaints SET status = 'RESOLVED' WHERE status = 'Resolved'")
        for category, department in DEPARTMENT_BY_CATEGORY.items():
            cursor.execute(
                "UPDATE complaints SET department = ? WHERE category = ? AND (department IS NULL OR department = '')",
                (department, category),
            )
        self._backfill_sqlite_grievance_ids(cursor)
        self._backfill_sqlite_sla(cursor)
        cursor.execute("UPDATE complaints SET escalation_status = 'NOT_ESCALATED' WHERE escalation_status IS NULL")
        cursor.execute("UPDATE complaints SET escalation_level = 0 WHERE escalation_level IS NULL")
        cursor.execute("UPDATE complaints SET possible_duplicate = 0 WHERE possible_duplicate IS NULL")
        cursor.execute("UPDATE complaints SET related_grievances = '[]' WHERE related_grievances IS NULL")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS grievance_sequences (
                year TEXT PRIMARY KEY,
                last_number INTEGER NOT NULL
            )
        """)
        for year, last_number in self._sqlite_grievance_counters(cursor).items():
            cursor.execute(
                "INSERT INTO grievance_sequences (year, last_number) VALUES (?, ?) "
                "ON CONFLICT(year) DO UPDATE SET last_number = MAX(last_number, excluded.last_number)",
                (year, last_number),
            )
        cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_complaints_grievance_id ON complaints(grievance_id)")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS status_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                complaint_id TEXT NOT NULL,
                old_status TEXT,
                new_status TEXT NOT NULL,
                changed_by TEXT NOT NULL,
                changed_at TEXT NOT NULL,
                remark TEXT,
                event_type TEXT NOT NULL DEFAULT 'STATUS',
                FOREIGN KEY (complaint_id) REFERENCES complaints(id)
            )
        """)
        history_columns = {row[1] for row in cursor.execute("PRAGMA table_info(status_history)")}
        if "event_type" not in history_columns:
            cursor.execute("ALTER TABLE status_history ADD COLUMN event_type TEXT NOT NULL DEFAULT 'STATUS'")
        cursor.execute("""
            INSERT INTO status_history
                (complaint_id, old_status, new_status, changed_by, changed_at, remark)
            SELECT c.id, NULL, c.status, 'system_migration', c.timestamp,
                   'Initial status recorded during workflow migration'
            FROM complaints c
            WHERE NOT EXISTS (
                SELECT 1 FROM status_history h WHERE h.complaint_id = c.id
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id TEXT PRIMARY KEY,
                recipient TEXT NOT NULL,
                grievance_id TEXT,
                complaint_id TEXT,
                notification_type TEXT NOT NULL,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                created_at TEXT NOT NULL,
                is_read INTEGER NOT NULL DEFAULT 0,
                event_key TEXT UNIQUE,
                metadata TEXT
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient)")
        cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_event_key ON notifications(event_key)")
        conn.commit()
        conn.close()

    @staticmethod
    def _grievance_number(value):
        match = re.fullmatch(r"GRV-(\d{4})-(\d{6})", str(value or ""))
        return (match.group(1), int(match.group(2))) if match else None

    def _backfill_sqlite_grievance_ids(self, cursor):
        rows = cursor.execute(
            "SELECT id, timestamp, grievance_id FROM complaints ORDER BY timestamp ASC, id ASC"
        ).fetchall()
        counters = self._sqlite_grievance_counters(cursor)
        for complaint_id, timestamp, existing_id in rows:
            if existing_id:
                continue
            year = grievance_year(timestamp)
            counters[year] = counters.get(year, 0) + 1
            cursor.execute(
                "UPDATE complaints SET grievance_id = ? WHERE id = ?",
                (format_grievance_id(year, counters[year]), complaint_id),
            )

    def _backfill_sqlite_sla(self, cursor):
        rows = cursor.execute(
            "SELECT id, timestamp, priority, sla_deadline, sla_original_deadline, sla_started_at "
            "FROM complaints"
        ).fetchall()
        for complaint_id, timestamp, priority, deadline, original_deadline, started_at in rows:
            deadline = deadline or calculate_deadline(timestamp, priority)
            original_deadline = original_deadline or deadline
            started_at = started_at or timestamp
            cursor.execute(
                "UPDATE complaints SET sla_deadline = ?, sla_original_deadline = ?, sla_started_at = ? WHERE id = ?",
                (deadline, original_deadline, started_at, complaint_id),
            )

    def _sqlite_grievance_counters(self, cursor):
        counters = {}
        for (existing_id,) in cursor.execute("SELECT grievance_id FROM complaints WHERE grievance_id IS NOT NULL"):
            parsed = self._grievance_number(existing_id)
            if parsed:
                year, number = parsed
                counters[year] = max(counters.get(year, 0), number)
        return counters

    def _next_sqlite_grievance_id(self, timestamp):
        year = grievance_year(timestamp)
        conn = sqlite3.connect(self.sqlite_path)
        cursor = conn.cursor()
        cursor.execute("BEGIN IMMEDIATE")
        cursor.execute(
            "INSERT INTO grievance_sequences (year, last_number) VALUES (?, 1) "
            "ON CONFLICT(year) DO UPDATE SET last_number = last_number + 1",
            (year,),
        )
        number = cursor.execute(
            "SELECT last_number FROM grievance_sequences WHERE year = ?", (year,)
        ).fetchone()[0]
        conn.commit()
        conn.close()
        return format_grievance_id(year, number)

    def _backfill_mongo_grievance_ids(self):
        counters = {}
        existing = self.mongo_db.complaints.find(
            {"grievance_id": {"$exists": True, "$ne": None}},
            {"grievance_id": 1},
        )
        for doc in existing:
            parsed = self._grievance_number(doc.get("grievance_id"))
            if parsed:
                year, number = parsed
                counters[year] = max(counters.get(year, 0), number)

        missing = self.mongo_db.complaints.find(
            {"$or": [{"grievance_id": {"$exists": False}}, {"grievance_id": None}]},
            {"timestamp": 1},
        ).sort("timestamp", 1)
        for doc in missing:
            year = grievance_year(doc.get("timestamp"))
            counters[year] = counters.get(year, 0) + 1
            self.mongo_db.complaints.update_one(
                {"_id": doc["_id"]},
                {"$set": {"grievance_id": format_grievance_id(year, counters[year])}},
            )
        for year, number in counters.items():
            self.mongo_db.grievance_sequences.update_one(
                {"_id": year}, {"$max": {"last_number": number}}, upsert=True
            )
        self.mongo_db.complaints.create_index("grievance_id", unique=True, sparse=True)

    def _next_mongo_grievance_id(self, timestamp):
        year = grievance_year(timestamp)
        sequence = self.mongo_db.grievance_sequences.find_one_and_update(
            {"_id": year},
            {"$inc": {"last_number": 1}},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        return format_grievance_id(year, sequence["last_number"])

    def _backfill_mongo_sla(self):
        missing = self.mongo_db.complaints.find(
            {"$or": [{"sla_deadline": {"$exists": False}}, {"sla_deadline": None}]},
            {"timestamp": 1, "priority": 1},
        )
        for doc in missing:
            deadline = calculate_deadline(doc.get("timestamp"), doc.get("priority"))
            self.mongo_db.complaints.update_one(
                {"_id": doc["_id"]},
                {"$set": {
                    "sla_deadline": deadline,
                    "sla_original_deadline": deadline,
                    "sla_started_at": doc.get("timestamp"),
                }},
            )
        self.mongo_db.complaints.update_many(
            {"escalation_status": {"$exists": False}},
            {"$set": {"escalation_status": ESCALATION_NOT_ESCALATED, "escalation_level": 0}},
        )
        self.mongo_db.complaints.update_many(
            {"possible_duplicate": {"$exists": False}},
            {"$set": {"possible_duplicate": False, "related_grievances": []}},
        )

    def insert_complaint(self, text, category, priority, sentiment_score, department=None, created_at=None, name=None, phone=None, location=None, address=None):
        timestamp = created_at or (datetime.utcnow().isoformat() + "Z")
        complaint_id = str(uuid.uuid4())
        grievance_id = None
        if self.db_type == 'sqlite':
            grievance_id = self._next_sqlite_grievance_id(timestamp)
        else:
            grievance_id = self._next_mongo_grievance_id(timestamp)
        department = department or get_department_for_category(category)
        sla_deadline = calculate_deadline(timestamp, priority)
        if department not in DEPARTMENTS:
            raise ValueError(f"Unknown department: {department}")
        
        complaint_data = {
            "id": complaint_id,
            "complaint_text": text,
            "category": category,
            "priority": priority,
            "sentiment_score": float(sentiment_score),
            "status": "SUBMITTED",
            "timestamp": timestamp,
            "grievance_id": grievance_id,
            "department": department,
            "sla_deadline": sla_deadline,
            "sla_original_deadline": sla_deadline,
            "sla_started_at": timestamp,
            "sla_result": None,
            "escalation_status": ESCALATION_NOT_ESCALATED,
            "escalation_level": 0,
            "escalated_at": None,
            "escalation_reason": None,
            "possible_duplicate": 0,
            "related_grievances": "[]",
            "name": name,
            "phone": phone,
            "location": location,
            "address": address,
        }

        if self.db_type == 'mongodb':
            # MongoDB inserts use _id, we can map id to _id or store both
            mongo_data = complaint_data.copy()
            mongo_data["_id"] = complaint_id
            self.mongo_db.complaints.insert_one(mongo_data)
            self.mongo_db.status_history.insert_one({
                "complaint_id": complaint_id,
                "old_status": None,
                "new_status": "SUBMITTED",
                "changed_by": "citizen",
                "changed_at": timestamp,
                "remark": "Complaint submitted",
                "event_type": "STATUS",
            })
        else:
            conn = sqlite3.connect(self.sqlite_path)
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO complaints
                    (id, complaint_text, category, priority, sentiment_score, status, timestamp, grievance_id, department,
                     sla_deadline, sla_original_deadline, sla_started_at, sla_result,
                     escalation_status, escalation_level, escalated_at, escalation_reason,
                     possible_duplicate, related_grievances, name, phone, location, address)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (complaint_id, text, category, priority, float(sentiment_score), "SUBMITTED", timestamp,
                   grievance_id, department, sla_deadline, sla_deadline, timestamp, None,
                   ESCALATION_NOT_ESCALATED, 0, None, None, 0, "[]", name, phone, location, address))
            cursor.execute("""
                INSERT INTO status_history
                    (complaint_id, old_status, new_status, changed_by, changed_at, remark)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (complaint_id, None, "SUBMITTED", "citizen", timestamp, "Complaint submitted"))
            conn.commit()
            conn.close()

        # Create notifications for submission
        self.create_notification(
            recipient=grievance_id,
            notification_type="COMPLAINT_SUBMITTED",
            title="Complaint Submitted",
            message=f"Your complaint {grievance_id} has been submitted successfully in category '{category}'.",
            grievance_id=grievance_id,
            complaint_id=complaint_id,
            event_key=f"submit:{complaint_id}:{grievance_id}",
            metadata={"category": category, "priority": priority, "department": department},
            created_at=timestamp,
        )
        self.create_notification(
            recipient="admin",
            notification_type="NEW_COMPLAINT_SUBMITTED",
            title="New Grievance Submitted",
            message=f"New grievance {grievance_id} submitted in category '{category}' with {priority} priority.",
            grievance_id=grievance_id,
            complaint_id=complaint_id,
            event_key=f"submit:{complaint_id}:admin",
            metadata={"category": category, "priority": priority, "department": department},
            created_at=timestamp,
        )

        return self._with_sla_data(complaint_data)

    def _with_sla_data(self, complaint):
        deadline = complaint.get("sla_deadline")
        if not deadline:
            deadline = calculate_deadline(complaint["timestamp"], complaint["priority"])
        complaint["sla_deadline"] = deadline
        complaint["sla_status"] = calculate_sla_status(
            complaint["status"],
            deadline,
            complaint["priority"],
            complaint.get("resolution_date"),
            complaint.get("sla_result"),
        )
        if complaint.get("resolution_date"):
            complaint["resolution_time_hours"] = resolution_hours(
                complaint["timestamp"], complaint["resolution_date"]
            )
        else:
            complaint["resolution_time_hours"] = None
        self._ensure_escalation(complaint)
        related = complaint.get("related_grievances", [])
        if isinstance(related, str):
            try:
                related = json.loads(related)
            except json.JSONDecodeError:
                related = []
        complaint["related_grievances"] = related
        complaint["possible_duplicate"] = bool(complaint.get("possible_duplicate")) or bool(related)

        # Trigger SLA notifications if SLA is approaching or breached
        sla_st = complaint.get("sla_status")
        grievance_id = complaint.get("grievance_id")
        if sla_st in {"NEAR_DEADLINE", "SLA_BREACHED"} and grievance_id:
            notif_type = "SLA_APPROACHING" if sla_st == "NEAR_DEADLINE" else "SLA_BREACHED"
            title = "SLA Deadline Approaching" if sla_st == "NEAR_DEADLINE" else "SLA Breached"
            msg = (
                f"Grievance {grievance_id} is approaching its SLA resolution deadline."
                if sla_st == "NEAR_DEADLINE"
                else f"Grievance {grievance_id} has breached its resolution SLA deadline."
            )
            self.create_notification(
                recipient="admin",
                notification_type=notif_type,
                title=title,
                message=msg,
                grievance_id=grievance_id,
                complaint_id=complaint["id"],
                event_key=f"sla:{complaint['id']}:{sla_st}:admin",
                metadata={"sla_status": sla_st, "deadline": deadline},
            )

        return complaint

    def get_active_complaints(self, limit=250, exclude_id=None):
        complaints, _ = self.get_complaints(page=1, limit=limit)
        return [
            complaint for complaint in complaints
            if complaint["status"] in {"SUBMITTED", "ASSIGNED", "IN_PROGRESS", "REOPENED"}
            and complaint["id"] != exclude_id
        ]

    def save_related_grievances(self, complaint_id, related_grievances):
        serialized = json.dumps(related_grievances)
        if self.db_type == "mongodb":
            self.mongo_db.complaints.update_one(
                {"_id": complaint_id},
                {"$set": {"possible_duplicate": bool(related_grievances), "related_grievances": related_grievances}},
            )
        else:
            conn = sqlite3.connect(self.sqlite_path)
            conn.execute(
                "UPDATE complaints SET possible_duplicate = ?, related_grievances = ? WHERE id = ?",
                (bool(related_grievances), serialized, complaint_id),
            )
            conn.commit()
            conn.close()
        return self.get_complaint(complaint_id)

    def _ensure_escalation(self, complaint):
        if not is_eligible_for_escalation(complaint["status"], complaint["sla_status"]):
            complaint.setdefault("escalation_status", ESCALATION_NOT_ESCALATED)
            complaint.setdefault("escalation_level", 0)
            return
        if complaint.get("escalation_status") == ESCALATION_ESCALATED:
            return

        escalated_at = datetime.utcnow().isoformat() + "Z"
        if self.db_type == "mongodb":
            self.mongo_db.complaints.update_one(
                {"_id": complaint["id"]},
                {"$set": {
                    "escalation_status": ESCALATION_ESCALATED,
                    "escalation_level": ESCALATION_LEVEL_DEPARTMENT,
                    "escalated_at": escalated_at,
                    "escalation_reason": ESCALATION_REASON_SLA_BREACHED,
                }},
            )
            self.mongo_db.status_history.insert_one({
                "complaint_id": complaint["id"],
                "old_status": complaint["status"],
                "new_status": complaint["status"],
                "changed_by": "system",
                "changed_at": escalated_at,
                "remark": ESCALATION_REASON_SLA_BREACHED,
                "event_type": "ESCALATION",
            })
        else:
            conn = sqlite3.connect(self.sqlite_path)
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE complaints SET escalation_status = ?, escalation_level = ?, escalated_at = ?, escalation_reason = ? WHERE id = ?",
                (ESCALATION_ESCALATED, ESCALATION_LEVEL_DEPARTMENT, escalated_at, ESCALATION_REASON_SLA_BREACHED, complaint["id"]),
            )
            cursor.execute("""
                INSERT INTO status_history
                    (complaint_id, old_status, new_status, changed_by, changed_at, remark, event_type)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (complaint["id"], complaint["status"], complaint["status"], "system", escalated_at,
                  ESCALATION_REASON_SLA_BREACHED, "ESCALATION"))
            conn.commit()
            conn.close()
        complaint.update({
            "escalation_status": ESCALATION_ESCALATED,
            "escalation_level": ESCALATION_LEVEL_DEPARTMENT,
            "escalated_at": escalated_at,
            "escalation_reason": ESCALATION_REASON_SLA_BREACHED,
        })

        # Escalation notifications
        grievance_id = complaint.get("grievance_id")
        if grievance_id:
            self.create_notification(
                recipient=grievance_id,
                notification_type="COMPLAINT_ESCALATED",
                title="Grievance Escalated",
                message=f"Your complaint {grievance_id} has been escalated for priority resolution.",
                grievance_id=grievance_id,
                complaint_id=complaint["id"],
                event_key=f"escalation:{complaint['id']}:{grievance_id}",
                metadata={"escalation_reason": ESCALATION_REASON_SLA_BREACHED},
                created_at=escalated_at,
            )
        self.create_notification(
            recipient="admin",
            notification_type="COMPLAINT_ESCALATED",
            title="Complaint Escalated",
            message=f"Grievance {grievance_id or complaint['id']} escalated due to: {ESCALATION_REASON_SLA_BREACHED}.",
            grievance_id=grievance_id,
            complaint_id=complaint["id"],
            event_key=f"escalation:{complaint['id']}:admin",
            metadata={"escalation_reason": ESCALATION_REASON_SLA_BREACHED},
            created_at=escalated_at,
        )

    def get_complaints(self, search_query=None, category=None, priority=None, status=None, escalation=None, department=None, sla_status=None, is_admin=False, page=1, limit=10):
        # Calculate pagination skip
        skip = (page - 1) * limit

        if self.db_type == 'mongodb':
            query = {}
            if category and category != 'All':
                query["category"] = category
            if priority and priority != 'All':
                query["priority"] = priority
            if status and status != 'All':
                query["status"] = normalize_status(status)
            if escalation and escalation != 'All':
                query["escalation_status"] = escalation

            cursor = self.mongo_db.complaints.find(query).sort("timestamp", -1)
            raw_list = []
            for doc in cursor:
                doc["id"] = doc.get("_id", doc.get("id"))
                if "_id" in doc:
                    del doc["_id"]
                doc["status"] = normalize_status(doc.get("status"))
                doc["grievance_id"] = doc.get("grievance_id")
                doc["department"] = doc.get("department") or get_department_for_category(doc.get("category"))
                raw_list.append(self._with_sla_data(doc))
        else:
            conn = sqlite3.connect(self.sqlite_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            query_str = "SELECT * FROM complaints WHERE 1=1"
            params = []
            
            if category and category != 'All':
                query_str += " AND category = ?"
                params.append(category)
            if priority and priority != 'All':
                query_str += " AND priority = ?"
                params.append(priority)
            if status and status != 'All':
                query_str += " AND status = ?"
                params.append(normalize_status(status))
            if escalation and escalation != 'All':
                query_str += " AND escalation_status = ?"
                params.append(escalation)
                
            query_str += " ORDER BY timestamp DESC"
            cursor.execute(query_str, params)
            rows = cursor.fetchall()
            
            raw_list = []
            for row in rows:
                row_dict = dict(row)
                row_dict["status"] = normalize_status(row_dict.get("status"))
                row_dict["department"] = row_dict.get("department") or get_department_for_category(row_dict.get("category"))
                raw_list.append(self._with_sla_data(row_dict))
            conn.close()

        filtered = []
        sq = search_query.strip().lower() if search_query else ""

        for doc in raw_list:
            # Department filter
            if department and department != 'All':
                doc_dept = (doc.get("department") or get_department_for_category(doc.get("category")) or "").lower()
                target_dept = department.lower()
                if target_dept != doc_dept and target_dept not in doc_dept and doc_dept not in target_dept:
                    continue

            # SLA status filter
            if sla_status and sla_status != 'All':
                doc_sla = (doc.get("sla_status") or "").upper()
                target_sla = sla_status.upper()
                if doc_sla != target_sla:
                    continue

            # Search query filter
            if sq:
                matched = False
                c_text = (doc.get("complaint_text") or "").lower()
                g_id = (doc.get("grievance_id") or "").lower()
                c_id = (doc.get("id") or "").lower()

                if sq in c_text or sq in g_id or sq in c_id:
                    matched = True

                if not matched and is_admin:
                    name = (doc.get("name") or "").lower()
                    phone = (doc.get("phone") or "").lower()
                    loc = (doc.get("location") or doc.get("address") or "").lower()
                    if sq in name or sq in phone or sq in loc:
                        matched = True

                if not matched:
                    continue

            filtered.append(doc)

        total = len(filtered)
        page_items = filtered[skip : skip + limit]
        return page_items, total

    def get_complaint(self, complaint_id):
        if self.db_type == 'mongodb':
            complaint = self.mongo_db.complaints.find_one({"_id": complaint_id})
            if not complaint:
                return None
            complaint["id"] = complaint.pop("_id")
            complaint["status"] = normalize_status(complaint.get("status"))
            complaint["grievance_id"] = complaint.get("grievance_id")
            complaint["department"] = complaint.get("department") or get_department_for_category(complaint.get("category"))
            return self._with_sla_data(complaint)

        conn = sqlite3.connect(self.sqlite_path)
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT * FROM complaints WHERE id = ?", (complaint_id,)).fetchone()
        conn.close()
        if not row:
            return None
        return self._with_sla_data({
            "id": row["id"],
            "complaint_text": row["complaint_text"],
            "category": row["category"],
            "priority": row["priority"],
            "sentiment_score": row["sentiment_score"],
            "status": normalize_status(row["status"]),
            "timestamp": row["timestamp"],
            "grievance_id": row["grievance_id"],
            "department": row["department"] or get_department_for_category(row["category"]),
            "sla_deadline": row["sla_deadline"],
            "sla_original_deadline": row["sla_original_deadline"],
            "sla_started_at": row["sla_started_at"],
            "sla_result": row["sla_result"],
            "escalation_status": row["escalation_status"],
            "escalation_level": row["escalation_level"],
            "escalated_at": row["escalated_at"],
            "escalation_reason": row["escalation_reason"],
            "possible_duplicate": row["possible_duplicate"],
            "related_grievances": row["related_grievances"],
            "assigned_to": row["assigned_to"],
            "assigned_at": row["assigned_at"],
            "resolution_date": row["resolution_date"],
            "resolution_remarks": row["resolution_remarks"],
            "resolved_by": row["resolved_by"],
            "closed_at": row["closed_at"],
            "reopened_reason": row["reopened_reason"],
            "reopened_by": row["reopened_by"],
        })

    def get_complaint_by_grievance_id(self, grievance_id):
        if self.db_type == 'mongodb':
            complaint = self.mongo_db.complaints.find_one(
                {"grievance_id": grievance_id}, {"_id": 1}
            )
            return self.get_complaint(complaint["_id"]) if complaint else None

        conn = sqlite3.connect(self.sqlite_path)
        row = conn.execute(
            "SELECT id FROM complaints WHERE grievance_id = ?", (grievance_id,)
        ).fetchone()
        conn.close()
        return self.get_complaint(row[0]) if row else None

    def update_status(self, complaint_id, new_status, changed_by, remark=None):
        normalized_status = normalize_status(new_status)
        if normalized_status not in STATUS_VALUES:
            raise ValueError(f"Unknown status: {new_status}")
        if normalized_status in {"RESOLVED", "REOPENED"} and not str(remark or "").strip():
            raise ValueError(f"A remark is required when changing status to {normalized_status}")

        complaint = self.get_complaint(complaint_id)
        if not complaint:
            return None
        old_status = normalize_status(complaint["status"])
        if normalized_status not in ALLOWED_TRANSITIONS[old_status]:
            raise ValueError(f"Invalid status transition: {old_status} -> {normalized_status}")

        changed_at = datetime.utcnow().isoformat() + "Z"
        sla_updates = {}
        if normalized_status == "RESOLVED":
            sla_updates["sla_result"] = calculate_sla_status(
                "RESOLVED", complaint["sla_deadline"], complaint["priority"], changed_at
            )
        elif normalized_status == "REOPENED":
            # Reopening starts a fresh active SLA; previous resolution remains in history.
            sla_updates.update({
                "sla_started_at": changed_at,
                "sla_deadline": calculate_deadline(changed_at, complaint["priority"]),
                "sla_result": None,
                "escalation_status": ESCALATION_NOT_ESCALATED,
                "escalation_level": 0,
                "escalated_at": None,
                "escalation_reason": None,
            })
        if self.db_type == 'mongodb':
            updates = {"status": normalized_status, **sla_updates}
            if normalized_status == "ASSIGNED":
                updates.update({"assigned_to": changed_by, "assigned_at": changed_at})
            elif normalized_status == "RESOLVED":
                updates.update({
                    "resolution_date": changed_at,
                    "resolution_remarks": remark.strip(),
                    "resolved_by": changed_by,
                })
            elif normalized_status == "CLOSED":
                updates["closed_at"] = changed_at
            elif normalized_status == "REOPENED":
                updates.update({"reopened_reason": remark.strip(), "reopened_by": changed_by})
            self.mongo_db.complaints.update_one({"_id": complaint_id}, {"$set": updates})
            self.mongo_db.status_history.insert_one({
                "complaint_id": complaint_id,
                "old_status": old_status,
                "new_status": normalized_status,
                "changed_by": changed_by,
                "changed_at": changed_at,
                "remark": remark.strip() if remark else None,
                "event_type": "STATUS",
            })
        else:
            conn = sqlite3.connect(self.sqlite_path)
            cursor = conn.cursor()
            updates = {"status": normalized_status, **sla_updates}
            if normalized_status == "ASSIGNED":
                updates.update({"assigned_to": changed_by, "assigned_at": changed_at})
            elif normalized_status == "RESOLVED":
                updates.update({
                    "resolution_date": changed_at,
                    "resolution_remarks": remark.strip(),
                    "resolved_by": changed_by,
                })
            elif normalized_status == "CLOSED":
                updates["closed_at"] = changed_at
            elif normalized_status == "REOPENED":
                updates.update({"reopened_reason": remark.strip(), "reopened_by": changed_by})
            assignments = ", ".join(f"{column} = ?" for column in updates)
            cursor.execute(
                f"UPDATE complaints SET {assignments} WHERE id = ?",
                [*updates.values(), complaint_id],
            )
            cursor.execute("""
                INSERT INTO status_history
                    (complaint_id, old_status, new_status, changed_by, changed_at, remark)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (complaint_id, old_status, normalized_status, changed_by, changed_at, remark.strip() if remark else None))
            conn.commit()
            conn.close()

        updated_complaint = self.get_complaint(complaint_id)
        grievance_id = updated_complaint.get("grievance_id") if updated_complaint else None

        if normalized_status == "RESOLVED":
            cit_type, cit_title, cit_msg = "COMPLAINT_RESOLVED", "Grievance Resolved", f"Your complaint {grievance_id} has been resolved."
            adm_type, adm_title, adm_msg = "COMPLAINT_RESOLVED", "Complaint Resolved", f"Grievance {grievance_id} was resolved."
        elif normalized_status == "REOPENED":
            cit_type, cit_title, cit_msg = "COMPLAINT_REOPENED", "Grievance Reopened", f"Your complaint {grievance_id} has been reopened."
            adm_type, adm_title, adm_msg = "COMPLAINT_REOPENED", "Complaint Reopened", f"Grievance {grievance_id} has been reopened by citizen."
        elif normalized_status == "ASSIGNED":
            cit_type, cit_title, cit_msg = "COMPLAINT_ASSIGNED", "Grievance Assigned", f"Your complaint {grievance_id} has been assigned."
            adm_type, adm_title, adm_msg = "COMPLAINT_ASSIGNED", "Complaint Assigned", f"Grievance {grievance_id} assigned."
        else:
            cit_type, cit_title, cit_msg = "STATUS_CHANGED", "Status Updated", f"Your complaint {grievance_id} status updated to {normalized_status}."
            adm_type, adm_title, adm_msg = "STATUS_CHANGED", "Status Updated", f"Grievance {grievance_id} status updated to {normalized_status}."

        if grievance_id:
            self.create_notification(
                recipient=grievance_id,
                notification_type=cit_type,
                title=cit_title,
                message=cit_msg,
                grievance_id=grievance_id,
                complaint_id=complaint_id,
                event_key=f"status:{complaint_id}:{normalized_status}:{grievance_id}",
                metadata={"status": normalized_status, "remark": remark, "changed_by": changed_by},
                created_at=changed_at,
            )
        self.create_notification(
            recipient="admin",
            notification_type=adm_type,
            title=adm_title,
            message=adm_msg,
            grievance_id=grievance_id,
            complaint_id=complaint_id,
            event_key=f"status:{complaint_id}:{normalized_status}:admin",
            metadata={"status": normalized_status, "remark": remark, "changed_by": changed_by},
            created_at=changed_at,
        )

        return updated_complaint

    def get_status_history(self, complaint_id):
        if self.db_type == 'mongodb':
            history = self.mongo_db.status_history.find(
                {"complaint_id": complaint_id}, {"_id": 0}
            ).sort("changed_at", 1)
            return list(history)

        conn = sqlite3.connect(self.sqlite_path)
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT complaint_id, old_status, new_status, changed_by, changed_at, remark, event_type "
            "FROM status_history WHERE complaint_id = ? ORDER BY changed_at ASC, id ASC",
            (complaint_id,),
        ).fetchall()
        conn.close()
        return [dict(row) for row in rows]

    def manually_escalate(self, complaint_id, reason, changed_by):
        reason = str(reason or "").strip()
        if not reason:
            raise ValueError("Escalation reason is required")
        complaint = self.get_complaint(complaint_id)
        if not complaint:
            return None
        if complaint.get("escalation_status") == ESCALATION_ESCALATED:
            raise ValueError("Complaint is already escalated")
        if complaint["status"] in {"RESOLVED", "CLOSED"}:
            raise ValueError(f"Cannot escalate complaint in status {complaint['status']}")

        escalated_at = datetime.utcnow().isoformat() + "Z"
        fields = {
            "escalation_status": ESCALATION_ESCALATED,
            "escalation_level": ESCALATION_LEVEL_DEPARTMENT,
            "escalated_at": escalated_at,
            "escalation_reason": reason,
        }
        if self.db_type == "mongodb":
            self.mongo_db.complaints.update_one({"_id": complaint_id}, {"$set": fields})
            self.mongo_db.status_history.insert_one({
                "complaint_id": complaint_id,
                "old_status": complaint["status"],
                "new_status": complaint["status"],
                "changed_by": changed_by,
                "changed_at": escalated_at,
                "remark": reason,
                "event_type": "ESCALATION_MANUAL",
            })
        else:
            conn = sqlite3.connect(self.sqlite_path)
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE complaints SET escalation_status = ?, escalation_level = ?, escalated_at = ?, escalation_reason = ? WHERE id = ?",
                (fields["escalation_status"], fields["escalation_level"], fields["escalated_at"], fields["escalation_reason"], complaint_id),
            )
            cursor.execute("""
                INSERT INTO status_history
                    (complaint_id, old_status, new_status, changed_by, changed_at, remark, event_type)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (complaint_id, complaint["status"], complaint["status"], changed_by, escalated_at, reason, "ESCALATION_MANUAL"))
            conn.commit()
            conn.close()
        complaint.update(fields)
        grievance_id = complaint.get("grievance_id")
        if grievance_id:
            self.create_notification(
                recipient=grievance_id,
                notification_type="COMPLAINT_ESCALATED",
                title="Grievance Escalated",
                message=f"Your complaint {grievance_id} has been escalated for priority resolution.",
                grievance_id=grievance_id,
                complaint_id=complaint_id,
                event_key=f"escalation:{complaint_id}:{grievance_id}",
                metadata={"escalation_reason": reason},
                created_at=escalated_at,
            )
        self.create_notification(
            recipient="admin",
            notification_type="COMPLAINT_ESCALATED",
            title="Complaint Escalated",
            message=f"Grievance {grievance_id or complaint_id} escalated due to: {reason}.",
            grievance_id=grievance_id,
            complaint_id=complaint_id,
            event_key=f"escalation:{complaint_id}:admin",
            metadata={"escalation_reason": reason},
            created_at=escalated_at,
        )
        return complaint

    def update_department(self, complaint_id, department, changed_by):
        if department not in DEPARTMENTS:
            raise ValueError(f"Unknown department: {department}")
        complaint = self.get_complaint(complaint_id)
        if not complaint:
            return None

        if self.db_type == 'mongodb':
            self.mongo_db.complaints.update_one(
                {"_id": complaint_id}, {"$set": {"department": department, "department_updated_by": changed_by}}
            )
        else:
            conn = sqlite3.connect(self.sqlite_path)
            conn.execute(
                "UPDATE complaints SET department = ? WHERE id = ?",
                (department, complaint_id),
            )
            conn.commit()
            conn.close()

        updated_complaint = self.get_complaint(complaint_id)
        grievance_id = updated_complaint.get("grievance_id") if updated_complaint else None
        if grievance_id:
            self.create_notification(
                recipient=grievance_id,
                notification_type="COMPLAINT_ASSIGNED",
                title="Department Assigned",
                message=f"Your complaint {grievance_id} has been assigned to department: {department}.",
                grievance_id=grievance_id,
                complaint_id=complaint_id,
                event_key=f"dept:{complaint_id}:{department}:{grievance_id}",
                metadata={"department": department, "changed_by": changed_by},
            )
        self.create_notification(
            recipient="admin",
            notification_type="COMPLAINT_ASSIGNED",
            title="Complaint Routed",
            message=f"Grievance {grievance_id or complaint_id} routed to department: {department}.",
            grievance_id=grievance_id,
            complaint_id=complaint_id,
            event_key=f"dept:{complaint_id}:{department}:admin",
            metadata={"department": department, "changed_by": changed_by},
        )
        return updated_complaint

    def get_dashboard_stats(self):
        # Fetch all complaints to build complete, accurate metrics
        all_raw, _ = self.get_complaints(page=1, limit=10000)
        total = len(all_raw)

        high_priority = sum(1 for c in all_raw if c.get("priority") == "High")
        pending = sum(1 for c in all_raw if c.get("status") in {"SUBMITTED", "ASSIGNED", "IN_PROGRESS", "REOPENED"})
        resolved = sum(1 for c in all_raw if c.get("status") in {"RESOLVED", "CLOSED"})

        # Category distribution
        categories = ["Water", "Electricity", "Road", "Garbage", "Others"]
        category_counts = {cat: 0 for cat in categories}
        for c in all_raw:
            cat = c.get("category", "Others")
            category_counts[cat] = category_counts.get(cat, 0) + 1

        # Priority distribution
        priorities = ["High", "Medium", "Low"]
        priority_counts = {pri: 0 for pri in priorities}
        for c in all_raw:
            pri = c.get("priority", "Low")
            priority_counts[pri] = priority_counts.get(pri, 0) + 1

        # Trend data
        trends = {}
        for c in sorted(all_raw, key=lambda x: x.get("timestamp", ""))[:100]:
            ts = c.get("timestamp", "")[:10]
            if ts:
                trends[ts] = trends.get(ts, 0) + 1
        trend_data = [{"date": k, "complaints": v} for k, v in sorted(trends.items())]

        # SLA Analytics
        total_sla_tracked = total
        within_sla = sum(1 for c in all_raw if c.get("sla_status") == "WITHIN_SLA")
        near_deadline = sum(1 for c in all_raw if c.get("sla_status") == "NEAR_DEADLINE")
        currently_breached = sum(1 for c in all_raw if c.get("sla_status") == "SLA_BREACHED")
        resolved_within_sla = sum(1 for c in all_raw if c.get("sla_status") == "RESOLVED_WITHIN_SLA" or c.get("sla_result") == "RESOLVED_WITHIN_SLA")
        resolved_after_sla = sum(1 for c in all_raw if c.get("sla_status") == "RESOLVED_AFTER_SLA" or c.get("sla_result") == "RESOLVED_AFTER_SLA")

        total_breaches = currently_breached + resolved_after_sla
        sla_breach_rate = round((total_breaches / total_sla_tracked * 100), 1) if total_sla_tracked > 0 else 0.0
        sla_compliance_rate = round((100.0 - sla_breach_rate), 1) if total_sla_tracked > 0 else 100.0

        # Resolution Analytics
        resolved_with_time = [c for c in all_raw if c.get("resolution_time_hours") is not None and c.get("status") in {"RESOLVED", "CLOSED"}]
        avg_res_time_overall = round(sum(c["resolution_time_hours"] for c in resolved_with_time) / len(resolved_with_time), 1) if resolved_with_time else 0.0

        avg_res_by_cat = {}
        for cat in categories:
            cat_resolved = [c for c in resolved_with_time if c.get("category") == cat]
            avg_res_by_cat[cat] = round(sum(c["resolution_time_hours"] for c in cat_resolved) / len(cat_resolved), 1) if cat_resolved else 0.0

        avg_res_by_dept = {}
        for dept in DEPARTMENTS:
            dept_resolved = [c for c in resolved_with_time if c.get("department") == dept]
            avg_res_by_dept[dept] = round(sum(c["resolution_time_hours"] for c in dept_resolved) / len(dept_resolved), 1) if dept_resolved else 0.0

        # Escalation Analytics
        total_escalated = sum(1 for c in all_raw if c.get("escalation_status") == ESCALATION_ESCALATED or c.get("escalation_level", 0) > 0)
        escalation_rate = round((total_escalated / total * 100), 1) if total > 0 else 0.0
        escalation_by_dept = {}
        for dept in DEPARTMENTS:
            escalation_by_dept[dept] = sum(1 for c in all_raw if c.get("department") == dept and (c.get("escalation_status") == ESCALATION_ESCALATED or c.get("escalation_level", 0) > 0))

        # Reopen Analytics
        total_reopened = sum(1 for c in all_raw if c.get("status") == "REOPENED" or c.get("reopened_by") is not None)
        reopen_rate = round((total_reopened / total * 100), 1) if total > 0 else 0.0

        # Department Performance Matrix
        department_performance = []
        for dept in DEPARTMENTS:
            dept_all = [c for c in all_raw if c.get("department") == dept]
            d_tot = len(dept_all)
            d_act = sum(1 for c in dept_all if c.get("status") in {"SUBMITTED", "ASSIGNED", "IN_PROGRESS", "REOPENED"})
            d_res = sum(1 for c in dept_all if c.get("status") in {"RESOLVED", "CLOSED"})
            d_res_rate = round((d_res / d_tot * 100), 1) if d_tot > 0 else 0.0

            d_resolved_time = [c for c in dept_all if c.get("resolution_time_hours") is not None and c.get("status") in {"RESOLVED", "CLOSED"}]
            d_avg_time = round(sum(c["resolution_time_hours"] for c in d_resolved_time) / len(d_resolved_time), 1) if d_resolved_time else 0.0

            d_breaches = sum(1 for c in dept_all if c.get("sla_status") in {"SLA_BREACHED", "RESOLVED_AFTER_SLA"} or c.get("sla_result") == "RESOLVED_AFTER_SLA")
            d_breach_rate = round((d_breaches / d_tot * 100), 1) if d_tot > 0 else 0.0
            d_escalations = sum(1 for c in dept_all if c.get("escalation_status") == ESCALATION_ESCALATED or c.get("escalation_level", 0) > 0)

            department_performance.append({
                "department": dept,
                "total_complaints": d_tot,
                "active_complaints": d_act,
                "resolved_complaints": d_res,
                "resolution_rate": d_res_rate,
                "avg_resolution_time": d_avg_time,
                "sla_breach_count": d_breaches,
                "sla_breach_rate": d_breach_rate,
                "escalation_count": d_escalations,
            })

        return {
            "total_complaints": total,
            "high_priority_complaints": high_priority,
            "pending_complaints": pending,
            "resolved_complaints": resolved,
            "category_distribution": category_counts,
            "priority_distribution": priority_counts,
            "trend_data": trend_data,
            "sla_analytics": {
                "total_sla_tracked": total_sla_tracked,
                "within_sla": within_sla,
                "near_deadline": near_deadline,
                "currently_breached": currently_breached,
                "resolved_within_sla": resolved_within_sla,
                "resolved_after_sla": resolved_after_sla,
                "sla_breach_rate": sla_breach_rate,
                "sla_compliance_rate": sla_compliance_rate,
            },
            "resolution_analytics": {
                "avg_resolution_time_hours": avg_res_time_overall,
                "avg_resolution_time_by_category": avg_res_by_cat,
                "avg_resolution_time_by_department": avg_res_by_dept,
            },
            "escalation_analytics": {
                "total_escalated": total_escalated,
                "escalation_rate": escalation_rate,
                "escalation_by_department": escalation_by_dept,
            },
            "reopen_analytics": {
                "total_reopened": total_reopened,
                "reopen_rate": reopen_rate,
            },
            "department_performance": department_performance,
        }

    # ==================== NOTIFICATIONS ENGINE ====================

    def _format_notification(self, doc):
        if not doc:
            return None
        d = dict(doc)
        d["id"] = str(d.get("id") or d.get("_id"))
        d["is_read"] = bool(d.get("is_read"))
        metadata = d.get("metadata", "{}")
        if isinstance(metadata, str):
            try:
                metadata = json.loads(metadata)
            except Exception:
                metadata = {}
        d["metadata"] = metadata
        d.pop("_id", None)
        return d

    def get_notification_by_event_key(self, event_key):
        if not event_key:
            return None
        if self.db_type == 'mongodb':
            doc = self.mongo_db.notifications.find_one({"event_key": event_key})
            return self._format_notification(doc) if doc else None
        else:
            conn = sqlite3.connect(self.sqlite_path)
            conn.row_factory = sqlite3.Row
            row = conn.execute("SELECT * FROM notifications WHERE event_key = ?", (event_key,)).fetchone()
            conn.close()
            return self._format_notification(dict(row)) if row else None

    def create_notification(self, recipient, notification_type, title, message, grievance_id=None, complaint_id=None, event_key=None, metadata=None, created_at=None):
        if not recipient or not notification_type or not title or not message:
            return None

        timestamp = created_at or (datetime.utcnow().isoformat() + "Z")

        # Idempotency check: prevent duplicate notifications for the same event key
        if event_key:
            existing = self.get_notification_by_event_key(event_key)
            if existing:
                return existing

        notification_id = str(uuid.uuid4())
        metadata_json = json.dumps(metadata) if isinstance(metadata, (dict, list)) else (metadata or "{}")

        notification_data = {
            "id": notification_id,
            "recipient": recipient,
            "grievance_id": grievance_id,
            "complaint_id": complaint_id,
            "notification_type": notification_type,
            "title": title,
            "message": message,
            "created_at": timestamp,
            "is_read": 0,
            "event_key": event_key,
            "metadata": metadata_json,
        }

        if self.db_type == 'mongodb':
            mongo_data = notification_data.copy()
            mongo_data["_id"] = notification_id
            try:
                self.mongo_db.notifications.insert_one(mongo_data)
            except Exception:
                if event_key:
                    return self.get_notification_by_event_key(event_key)
                return None
            return self._format_notification(notification_data)
        else:
            conn = sqlite3.connect(self.sqlite_path)
            cursor = conn.cursor()
            try:
                cursor.execute("""
                    INSERT INTO notifications
                        (id, recipient, grievance_id, complaint_id, notification_type, title, message, created_at, is_read, event_key, metadata)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
                """, (notification_id, recipient, grievance_id, complaint_id, notification_type, title, message, timestamp, event_key, metadata_json))
                conn.commit()
            except sqlite3.IntegrityError:
                conn.close()
                if event_key:
                    return self.get_notification_by_event_key(event_key)
                return None
            conn.close()
            return self._format_notification(notification_data)

    def get_notifications(self, recipient, page=1, limit=20):
        if not recipient:
            return [], 0, 0

        page = max(1, page)
        limit = max(1, limit)
        offset = (page - 1) * limit

        if self.db_type == 'mongodb':
            total = self.mongo_db.notifications.count_documents({"recipient": recipient})
            unread_count = self.mongo_db.notifications.count_documents({"recipient": recipient, "is_read": 0})
            cursor = self.mongo_db.notifications.find({"recipient": recipient}).sort("created_at", -1).skip(offset).limit(limit)
            notifications = [self._format_notification(doc) for doc in cursor]
            return notifications, total, unread_count
        else:
            conn = sqlite3.connect(self.sqlite_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            total = cursor.execute("SELECT COUNT(*) FROM notifications WHERE recipient = ?", (recipient,)).fetchone()[0]
            unread_count = cursor.execute("SELECT COUNT(*) FROM notifications WHERE recipient = ? AND is_read = 0", (recipient,)).fetchone()[0]
            rows = cursor.execute("""
                SELECT id, recipient, grievance_id, complaint_id, notification_type, title, message, created_at, is_read, event_key, metadata
                FROM notifications
                WHERE recipient = ?
                ORDER BY created_at DESC, id DESC
                LIMIT ? OFFSET ?
            """, (recipient, limit, offset)).fetchall()
            conn.close()
            notifications = [self._format_notification(dict(r)) for r in rows]
            return notifications, total, unread_count

    def mark_notification_read(self, notification_id, recipient):
        if not recipient or not notification_id:
            return None

        if self.db_type == 'mongodb':
            result = self.mongo_db.notifications.find_one_and_update(
                {"_id": notification_id, "recipient": recipient},
                {"$set": {"is_read": 1}},
                return_document=ReturnDocument.AFTER,
            )
            return self._format_notification(result) if result else None
        else:
            conn = sqlite3.connect(self.sqlite_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE notifications SET is_read = 1 WHERE id = ? AND recipient = ?",
                (notification_id, recipient),
            )
            conn.commit()
            if cursor.rowcount == 0:
                conn.close()
                return None
            row = cursor.execute("SELECT * FROM notifications WHERE id = ?", (notification_id,)).fetchone()
            conn.close()
            return self._format_notification(dict(row)) if row else None

    def mark_all_notifications_read(self, recipient):
        if not recipient:
            return 0

        if self.db_type == 'mongodb':
            res = self.mongo_db.notifications.update_many(
                {"recipient": recipient, "is_read": 0},
                {"$set": {"is_read": 1}},
            )
            return res.modified_count
        else:
            conn = sqlite3.connect(self.sqlite_path)
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE notifications SET is_read = 1 WHERE recipient = ? AND is_read = 0",
                (recipient,),
            )
            count = cursor.rowcount
            conn.commit()
            conn.close()
            return count
