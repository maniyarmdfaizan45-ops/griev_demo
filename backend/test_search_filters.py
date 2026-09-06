import unittest
import json
import os
import sys
from datetime import datetime, timedelta, timezone

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, db
from auth import encode_auth_token, encode_citizen_token


class TestAdvancedSearchAndFilters(unittest.TestCase):
    def setUp(self):
        self.app = app
        self.client = self.app.test_client()
        self.admin_token = encode_auth_token("admin")
        self.admin_headers = {
            "Authorization": f"Bearer {self.admin_token}",
            "Content-Type": "application/json"
        }

        # Clear complaints and status history in SQLite/Mongo before each test
        if db.db_type == 'sqlite':
            import sqlite3
            conn = sqlite3.connect(db.sqlite_path)
            cursor = conn.cursor()
            cursor.execute("DELETE FROM complaints")
            cursor.execute("DELETE FROM status_history")
            cursor.execute("DELETE FROM notifications")
            conn.commit()
            conn.close()
        else:
            db.mongo_db.complaints.delete_many({})
            db.mongo_db.status_history.delete_many({})
            db.mongo_db.notifications.delete_many({})

    # 1. Department filter returns only matching complaints
    def test_01_department_filter_returns_matching_only(self):
        db.insert_complaint(
            text="Pipeline leakage near main square",
            category="Water",
            priority="High",
            sentiment_score=-0.5,
            department="Water Supply Department"
        )
        db.insert_complaint(
            text="Power line short circuit on street 4",
            category="Electricity",
            priority="High",
            sentiment_score=-0.6,
            department="Electricity Department"
        )

        res = self.client.get("/api/get-complaints?department=Water%20Supply%20Department")
        data = res.get_json()
        self.assertEqual(res.status_code, 200)
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["complaints"][0]["department"], "Water Supply Department")

    # 2. Unknown/nonexistent department returns no matching complaints
    def test_02_unknown_department_returns_empty(self):
        db.insert_complaint(
            text="Garbage bin overflowing",
            category="Garbage",
            priority="Medium",
            sentiment_score=-0.2,
            department="Sanitation/Waste Management Department"
        )

        res = self.client.get("/api/get-complaints?department=Nonexistent%20Dept")
        data = res.get_json()
        self.assertEqual(res.status_code, 200)
        self.assertEqual(data["total"], 0)
        self.assertEqual(len(data["complaints"]), 0)

    # 3. sla_status=WITHIN_SLA works
    def test_03_sla_status_within_sla(self):
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        db.insert_complaint(
            text="Minor road pothole issue",
            category="Road",
            priority="Low", # 72 hours SLA window
            sentiment_score=-0.1,
            department="Public Works Department",
            created_at=now_str
        )

        res = self.client.get("/api/get-complaints?sla_status=WITHIN_SLA")
        data = res.get_json()
        self.assertEqual(res.status_code, 200)
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["complaints"][0]["sla_status"], "WITHIN_SLA")

    # 4. sla_status=NEAR_DEADLINE works
    def test_04_sla_status_near_deadline(self):
        # High priority SLA is 24 hours. Warning starts at 75% = 18h passed (6h remaining)
        past_time = (datetime.now(timezone.utc) - timedelta(hours=20)).strftime("%Y-%m-%dT%H:%M:%SZ")
        db.insert_complaint(
            text="Transformer spark warning",
            category="Electricity",
            priority="High",
            sentiment_score=-0.8,
            department="Electricity Department",
            created_at=past_time
        )

        res = self.client.get("/api/get-complaints?sla_status=NEAR_DEADLINE")
        data = res.get_json()
        self.assertEqual(res.status_code, 200)
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["complaints"][0]["sla_status"], "NEAR_DEADLINE")

    # 5. sla_status=SLA_BREACHED works
    def test_05_sla_status_sla_breached(self):
        # High priority SLA is 24 hours. 30 hours past created time => Breached
        past_time = (datetime.now(timezone.utc) - timedelta(hours=30)).strftime("%Y-%m-%dT%H:%M:%SZ")
        db.insert_complaint(
            text="Severe water contamination",
            category="Water",
            priority="High",
            sentiment_score=-0.9,
            department="Water Supply Department",
            created_at=past_time
        )

        res = self.client.get("/api/get-complaints?sla_status=SLA_BREACHED")
        data = res.get_json()
        self.assertEqual(res.status_code, 200)
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["complaints"][0]["sla_status"], "SLA_BREACHED")

    # 6. Admin search finds a complaint by name
    def test_06_admin_search_by_name(self):
        db.insert_complaint(
            text="Streetlight broken",
            category="Electricity",
            priority="Medium",
            sentiment_score=-0.3,
            name="John Doe",
            phone="9876543210",
            location="Sector 5"
        )

        res = self.client.get("/api/get-complaints?search=John", headers=self.admin_headers)
        data = res.get_json()
        self.assertEqual(res.status_code, 200)
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["complaints"][0]["name"], "John Doe")

    # 7. Admin search finds a complaint by phone
    def test_07_admin_search_by_phone(self):
        db.insert_complaint(
            text="Dirty drinking water",
            category="Water",
            priority="High",
            sentiment_score=-0.5,
            name="Alice Smith",
            phone="9988776655",
            location="Block B"
        )

        res = self.client.get("/api/get-complaints?search=9988776655", headers=self.admin_headers)
        data = res.get_json()
        self.assertEqual(res.status_code, 200)
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["complaints"][0]["phone"], "9988776655")

    # 8. Admin search finds a complaint by location
    def test_08_admin_search_by_location(self):
        db.insert_complaint(
            text="Pothole on main highway",
            category="Road",
            priority="Medium",
            sentiment_score=-0.4,
            name="Robert Johnson",
            phone="9123456789",
            location="MG Road Metro Station"
        )

        res = self.client.get("/api/get-complaints?search=MG%20Road", headers=self.admin_headers)
        data = res.get_json()
        self.assertEqual(res.status_code, 200)
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["complaints"][0]["location"], "MG Road Metro Station")

    # 9. Existing complaint-text search still works
    def test_09_complaint_text_search(self):
        db.insert_complaint(
            text="Burst water pipe flooding basement",
            category="Water",
            priority="High",
            sentiment_score=-0.7
        )

        res = self.client.get("/api/get-complaints?search=flooding")
        data = res.get_json()
        self.assertEqual(res.status_code, 200)
        self.assertEqual(data["total"], 1)

    # 10. Existing grievance-ID search still works
    def test_10_grievance_id_search(self):
        c = db.insert_complaint(
            text="Uncollected garbage heap",
            category="Garbage",
            priority="Medium",
            sentiment_score=-0.3
        )
        gid = c["grievance_id"]

        res = self.client.get(f"/api/get-complaints?search={gid}")
        data = res.get_json()
        self.assertEqual(res.status_code, 200)
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["complaints"][0]["grievance_id"], gid)

    # 11. Combining department + SLA status works
    def test_11_combining_department_and_sla_status(self):
        past_time = (datetime.now(timezone.utc) - timedelta(hours=30)).strftime("%Y-%m-%dT%H:%M:%SZ")
        db.insert_complaint(
            text="Breached water issue",
            category="Water",
            priority="High",
            sentiment_score=-0.8,
            department="Water Supply Department",
            created_at=past_time
        )
        db.insert_complaint(
            text="Breached electricity issue",
            category="Electricity",
            priority="High",
            sentiment_score=-0.8,
            department="Electricity Department",
            created_at=past_time
        )

        res = self.client.get("/api/get-complaints?department=Water%20Supply%20Department&sla_status=SLA_BREACHED")
        data = res.get_json()
        self.assertEqual(res.status_code, 200)
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["complaints"][0]["department"], "Water Supply Department")
        self.assertEqual(data["complaints"][0]["sla_status"], "SLA_BREACHED")

    # 12. Combining search + department + SLA status works
    def test_12_combining_search_department_and_sla_status(self):
        past_time = (datetime.now(timezone.utc) - timedelta(hours=30)).strftime("%Y-%m-%dT%H:%M:%SZ")
        db.insert_complaint(
            text="Breached water valve leakage on 5th avenue",
            category="Water",
            priority="High",
            sentiment_score=-0.8,
            department="Water Supply Department",
            created_at=past_time
        )
        db.insert_complaint(
            text="Breached water meter issue on 12th street",
            category="Water",
            priority="High",
            sentiment_score=-0.8,
            department="Water Supply Department",
            created_at=past_time
        )

        res = self.client.get("/api/get-complaints?search=valve&department=Water%20Supply%20Department&sla_status=SLA_BREACHED")
        data = res.get_json()
        self.assertEqual(res.status_code, 200)
        self.assertEqual(data["total"], 1)
        self.assertIn("valve", data["complaints"][0]["complaint_text"])

    # 13. Public ledger does not expose private citizen search/filter behavior
    def test_13_public_search_does_not_expose_private_contact_info(self):
        db.insert_complaint(
            text="Road repair needed near park",
            category="Road",
            priority="Medium",
            sentiment_score=-0.3,
            name="Secret Citizen",
            phone="8887776665",
            location="Secret Location"
        )

        # Public request (no admin authorization header) searching for citizen name
        res_name = self.client.get("/api/get-complaints?search=Secret")
        data_name = res_name.get_json()
        self.assertEqual(res_name.status_code, 200)
        self.assertEqual(data_name["total"], 0)

        # Public request searching for citizen phone number
        res_phone = self.client.get("/api/get-complaints?search=8887776665")
        data_phone = res_phone.get_json()
        self.assertEqual(res_phone.status_code, 200)
        self.assertEqual(data_phone["total"], 0)

        # Authenticated Admin request searching for citizen name returns the record
        res_admin = self.client.get("/api/get-complaints?search=Secret", headers=self.admin_headers)
        data_admin = res_admin.get_json()
        self.assertEqual(res_admin.status_code, 200)
        self.assertEqual(data_admin["total"], 1)


if __name__ == "__main__":
    unittest.main()
