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

    def insert_complaint(self, text, category, priority, sentiment_score, department=None, created_at=None):
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
            return self._with_sla_data(complaint_data)
        else:
            conn = sqlite3.connect(self.sqlite_path)
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO complaints
                    (id, complaint_text, category, priority, sentiment_score, status, timestamp, grievance_id, department,
                     sla_deadline, sla_original_deadline, sla_started_at, sla_result,
                     escalation_status, escalation_level, escalated_at, escalation_reason,
                     possible_duplicate, related_grievances)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (complaint_id, text, category, priority, float(sentiment_score), "SUBMITTED", timestamp,
                   grievance_id, department, sla_deadline, sla_deadline, timestamp, None,
                   ESCALATION_NOT_ESCALATED, 0, None, None, 0, "[]"))
            cursor.execute("""
                INSERT INTO status_history
                    (complaint_id, old_status, new_status, changed_by, changed_at, remark)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (complaint_id, None, "SUBMITTED", "citizen", timestamp, "Complaint submitted"))
            conn.commit()
            conn.close()
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

    def get_complaints(self, search_query=None, category=None, priority=None, status=None, escalation=None, page=1, limit=10):
        # Calculate pagination skip
        skip = (page - 1) * limit

        if self.db_type == 'mongodb':
            # Build MongoDB filter query
            query = {}
            if search_query:
                query["$or"] = [
                    {"complaint_text": {"$regex": search_query, "$options": "i"}},
                    {"grievance_id": {"$regex": search_query, "$options": "i"}},
                ]
            if category and category != 'All':
                query["category"] = category
            if priority and priority != 'All':
                query["priority"] = priority
            if status and status != 'All':
                query["status"] = normalize_status(status)
            if escalation and escalation != 'All':
                query["escalation_status"] = escalation
                
            total = self.mongo_db.complaints.count_documents(query)
            cursor = self.mongo_db.complaints.find(query).sort("timestamp", -1).skip(skip).limit(limit)
            
            complaints = []
            for doc in cursor:
                doc["id"] = doc.get("_id", doc.get("id"))
                if "_id" in doc:
                    del doc["_id"]
                doc["status"] = normalize_status(doc.get("status"))
                doc["grievance_id"] = doc.get("grievance_id")
                doc["department"] = doc.get("department") or get_department_for_category(doc.get("category"))
                complaints.append(self._with_sla_data(doc))
                
            return complaints, total
        else:
            # Build SQLite query dynamically
            conn = sqlite3.connect(self.sqlite_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            query_str = "SELECT * FROM complaints WHERE 1=1"
            params = []
            
            if search_query:
                query_str += " AND (complaint_text LIKE ? OR grievance_id LIKE ?)"
                params.extend([f"%{search_query}%", f"%{search_query}%"])
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
                
            # Get total count first
            count_query = query_str.replace("SELECT *", "SELECT COUNT(*) as count")
            cursor.execute(count_query, params)
            total = cursor.fetchone()["count"]
            
            # Add ordering and pagination
            query_str += " ORDER BY timestamp DESC LIMIT ? OFFSET ?"
            params.extend([limit, skip])
            
            cursor.execute(query_str, params)
            rows = cursor.fetchall()
            
            complaints = []
            for row in rows:
                complaints.append(self._with_sla_data({
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
                }))
                
            conn.close()
            return complaints, total

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

        return self.get_complaint(complaint_id)

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
        return self.get_complaint(complaint_id)

    def get_dashboard_stats(self):
        if self.db_type == 'mongodb':
            # MongoDB stats calculations
            total = self.mongo_db.complaints.count_documents({})
            high_priority = self.mongo_db.complaints.count_documents({"priority": "High"})
            pending = self.mongo_db.complaints.count_documents({"status": {"$in": ["SUBMITTED", "ASSIGNED", "IN_PROGRESS", "REOPENED", "Pending", "In Progress"]}})
            resolved = self.mongo_db.complaints.count_documents({"status": {"$in": ["RESOLVED", "CLOSED", "Resolved"]}})
            
            # Category aggregation
            cat_pipeline = [{"$group": {"_id": "$category", "count": {"$sum": 1}}}]
            cat_results = list(self.mongo_db.complaints.aggregate(cat_pipeline))
            category_counts = {item["_id"]: item["count"] for item in cat_results}
            
            # Priority aggregation
            pri_pipeline = [{"$group": {"_id": "$priority", "count": {"$sum": 1}}}]
            pri_results = list(self.mongo_db.complaints.aggregate(pri_pipeline))
            priority_counts = {item["_id"]: item["count"] for item in pri_results}
            
            # Get latest 100 complaints for trend sorting
            recent_complaints = list(self.mongo_db.complaints.find({}, {"timestamp": 1}).sort("timestamp", 1).limit(100))
            
        else:
            conn = sqlite3.connect(self.sqlite_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # Total counts
            cursor.execute("SELECT COUNT(*) as count FROM complaints")
            total = cursor.fetchone()["count"]
            
            cursor.execute("SELECT COUNT(*) as count FROM complaints WHERE priority = 'High'")
            high_priority = cursor.fetchone()["count"]
            
            cursor.execute("SELECT COUNT(*) as count FROM complaints WHERE status IN ('SUBMITTED', 'ASSIGNED', 'IN_PROGRESS', 'REOPENED')")
            pending = cursor.fetchone()["count"]
            
            cursor.execute("SELECT COUNT(*) as count FROM complaints WHERE status IN ('RESOLVED', 'CLOSED')")
            resolved = cursor.fetchone()["count"]
            
            # Category aggregation
            cursor.execute("SELECT category, COUNT(*) as count FROM complaints GROUP BY category")
            category_counts = {row["category"]: row["count"] for row in cursor.fetchall()}
            
            # Priority aggregation
            cursor.execute("SELECT priority, COUNT(*) as count FROM complaints GROUP BY priority")
            priority_counts = {row["priority"]: row["count"] for row in cursor.fetchall()}
            
            # Get recent complaint timestamps for trend tracking
            cursor.execute("SELECT timestamp FROM complaints ORDER BY timestamp ASC LIMIT 100")
            recent_complaints = [{"timestamp": row["timestamp"]} for row in cursor.fetchall()]
            
            conn.close()

        # Parse trends (count by date)
        trends = {}
        for comp in recent_complaints:
            # ISO timestamp e.g. "2026-07-16T19:42:07.123Z" -> extract "2026-07-16"
            date_str = comp["timestamp"][:10]
            trends[date_str] = trends.get(date_str, 0) + 1
            
        trend_data = [{"date": k, "complaints": v} for k, v in sorted(trends.items())]

        # Make sure category counts includes all categories with at least 0
        categories = ["Water", "Electricity", "Road", "Garbage", "Others"]
        for cat in categories:
            if cat not in category_counts:
                category_counts[cat] = 0
                
        # Make sure priorities includes all categories with at least 0
        priorities = ["High", "Medium", "Low"]
        for pri in priorities:
            if pri not in priority_counts:
                priority_counts[pri] = 0

        return {
            "total_complaints": total,
            "high_priority_complaints": high_priority,
            "pending_complaints": pending,
            "resolved_complaints": resolved,
            "category_distribution": category_counts,
            "priority_distribution": priority_counts,
            "trend_data": trend_data
        }
