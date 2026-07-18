import os
import sqlite3
import uuid
from datetime import datetime
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure

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
                status TEXT NOT NULL DEFAULT 'Pending',
                timestamp TEXT NOT NULL
            )
        """)
        conn.commit()
        conn.close()

    def insert_complaint(self, text, category, priority, sentiment_score):
        timestamp = datetime.utcnow().isoformat() + "Z"
        complaint_id = str(uuid.uuid4())
        
        complaint_data = {
            "id": complaint_id,
            "complaint_text": text,
            "category": category,
            "priority": priority,
            "sentiment_score": float(sentiment_score),
            "status": "Pending",
            "timestamp": timestamp
        }

        if self.db_type == 'mongodb':
            # MongoDB inserts use _id, we can map id to _id or store both
            mongo_data = complaint_data.copy()
            mongo_data["_id"] = complaint_id
            self.mongo_db.complaints.insert_one(mongo_data)
            return complaint_data
        else:
            conn = sqlite3.connect(self.sqlite_path)
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO complaints (id, complaint_text, category, priority, sentiment_score, status, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (complaint_id, text, category, priority, float(sentiment_score), "Pending", timestamp))
            conn.commit()
            conn.close()
            return complaint_data

    def get_complaints(self, search_query=None, category=None, priority=None, status=None, page=1, limit=10):
        # Calculate pagination skip
        skip = (page - 1) * limit

        if self.db_type == 'mongodb':
            # Build MongoDB filter query
            query = {}
            if search_query:
                query["complaint_text"] = {"$regex": search_query, "$options": "i"}
            if category and category != 'All':
                query["category"] = category
            if priority and priority != 'All':
                query["priority"] = priority
            if status and status != 'All':
                query["status"] = status
                
            total = self.mongo_db.complaints.count_documents(query)
            cursor = self.mongo_db.complaints.find(query).sort("timestamp", -1).skip(skip).limit(limit)
            
            complaints = []
            for doc in cursor:
                doc["id"] = doc.get("_id", doc.get("id"))
                if "_id" in doc:
                    del doc["_id"]
                complaints.append(doc)
                
            return complaints, total
        else:
            # Build SQLite query dynamically
            conn = sqlite3.connect(self.sqlite_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            query_str = "SELECT * FROM complaints WHERE 1=1"
            params = []
            
            if search_query:
                query_str += " AND complaint_text LIKE ?"
                params.append(f"%{search_query}%")
            if category and category != 'All':
                query_str += " AND category = ?"
                params.append(category)
            if priority and priority != 'All':
                query_str += " AND priority = ?"
                params.append(priority)
            if status and status != 'All':
                query_str += " AND status = ?"
                params.append(status)
                
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
                complaints.append({
                    "id": row["id"],
                    "complaint_text": row["complaint_text"],
                    "category": row["category"],
                    "priority": row["priority"],
                    "sentiment_score": row["sentiment_score"],
                    "status": row["status"],
                    "timestamp": row["timestamp"]
                })
                
            conn.close()
            return complaints, total

    def update_status(self, complaint_id, new_status):
        if new_status not in ["Pending", "In Progress", "Resolved"]:
            raise ValueError("Invalid status value")

        if self.db_type == 'mongodb':
            result = self.mongo_db.complaints.update_one(
                {"_id": complaint_id},
                {"$set": {"status": new_status}}
            )
            return result.modified_count > 0
        else:
            conn = sqlite3.connect(self.sqlite_path)
            cursor = conn.cursor()
            cursor.execute("UPDATE complaints SET status = ? WHERE id = ?", (new_status, complaint_id))
            modified = cursor.rowcount > 0
            conn.commit()
            conn.close()
            return modified

    def get_dashboard_stats(self):
        if self.db_type == 'mongodb':
            # MongoDB stats calculations
            total = self.mongo_db.complaints.count_documents({})
            high_priority = self.mongo_db.complaints.count_documents({"priority": "High"})
            pending = self.mongo_db.complaints.count_documents({"status": "Pending"})
            resolved = self.mongo_db.complaints.count_documents({"status": "Resolved"})
            
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
            
            cursor.execute("SELECT COUNT(*) as count FROM complaints WHERE status = 'Pending'")
            pending = cursor.fetchone()["count"]
            
            cursor.execute("SELECT COUNT(*) as count FROM complaints WHERE status = 'Resolved'")
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
