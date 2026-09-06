import unittest
import json
import os
import sys

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, db
from auth import encode_auth_token, encode_citizen_token


class TestSecurityHardening(unittest.TestCase):
    def setUp(self):
        self.app = app
        self.client = self.app.test_client()
        self.admin_token = encode_auth_token("admin")
        self.admin_headers = {
            "Authorization": f"Bearer {self.admin_token}",
            "Content-Type": "application/json"
        }
        self.citizen_token = encode_citizen_token("GRV-20260906-000001")
        self.citizen_headers = {
            "Authorization": f"Bearer {self.citizen_token}",
            "Content-Type": "application/json"
        }

        # Clear test database tables/collections
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

        # Insert a sample complaint for testing
        self.test_complaint = db.insert_complaint(
            text="Pipeline burst near residential park",
            category="Water",
            priority="High",
            sentiment_score=-0.8,
            department="Water Supply Department",
            name="Alice Smith",
            phone="9876543210",
            location="Sector 14 Block C",
            address="123 Park Avenue"
        )
        self.complaint_id = self.test_complaint["id"]
        self.grievance_id = self.test_complaint["grievance_id"]

    # 1. Citizen JWT rejected on PUT /api/update-status/<id>
    def test_01_citizen_jwt_rejected_on_update_status(self):
        res = self.client.put(
            f"/api/update-status/{self.complaint_id}",
            headers=self.citizen_headers,
            json={"status": "IN_PROGRESS"}
        )
        self.assertIn(res.status_code, (401, 403))

    # 2. Citizen JWT rejected on PUT /api/update-department/<id>
    def test_02_citizen_jwt_rejected_on_update_department(self):
        res = self.client.put(
            f"/api/update-department/{self.complaint_id}",
            headers=self.citizen_headers,
            json={"department": "Electricity Department"}
        )
        self.assertIn(res.status_code, (401, 403))

    # 3. Citizen JWT rejected on POST /api/escalate/<id>
    def test_03_citizen_jwt_rejected_on_escalate(self):
        res = self.client.post(
            f"/api/escalate/{self.complaint_id}",
            headers=self.citizen_headers,
            json={"reason": "Manual escalation attempt by citizen"}
        )
        self.assertIn(res.status_code, (401, 403))

    # 4. Citizen JWT rejected on GET /api/dashboard-stats
    def test_04_citizen_jwt_rejected_on_dashboard_stats(self):
        res = self.client.get(
            "/api/dashboard-stats",
            headers=self.citizen_headers
        )
        self.assertIn(res.status_code, (401, 403))

    # 5. Valid admin JWT still works on admin endpoints
    def test_05_admin_jwt_works_on_admin_endpoints(self):
        res_stats = self.client.get("/api/dashboard-stats", headers=self.admin_headers)
        self.assertEqual(res_stats.status_code, 200)

        res_status = self.client.put(
            f"/api/update-status/{self.complaint_id}",
            headers=self.admin_headers,
            json={"status": "ASSIGNED"}
        )
        self.assertEqual(res_status.status_code, 200)

    # 6. Public GET /api/get-complaints does not expose name
    def test_06_public_get_complaints_no_name(self):
        res = self.client.get("/api/get-complaints")
        data = res.get_json()
        self.assertEqual(res.status_code, 200)
        self.assertTrue(len(data["complaints"]) > 0)
        self.assertNotIn("name", data["complaints"][0])

    # 7. Public GET /api/get-complaints does not expose phone
    def test_07_public_get_complaints_no_phone(self):
        res = self.client.get("/api/get-complaints")
        data = res.get_json()
        self.assertEqual(res.status_code, 200)
        self.assertNotIn("phone", data["complaints"][0])

    # 8. Public GET /api/get-complaints does not expose location
    def test_08_public_get_complaints_no_location(self):
        res = self.client.get("/api/get-complaints")
        data = res.get_json()
        self.assertEqual(res.status_code, 200)
        self.assertNotIn("location", data["complaints"][0])

    # 9. Public GET /api/get-complaints does not expose address
    def test_09_public_get_complaints_no_address(self):
        res = self.client.get("/api/get-complaints")
        data = res.get_json()
        self.assertEqual(res.status_code, 200)
        self.assertNotIn("address", data["complaints"][0])

    # 10. Public grievance-ID lookup does not expose private fields
    def test_10_public_grievance_lookup_no_private_fields(self):
        res = self.client.get(f"/api/get-complaints/by-grievance-id/{self.grievance_id}")
        data = res.get_json()
        self.assertEqual(res.status_code, 200)
        complaint = data["complaint"]
        self.assertNotIn("name", complaint)
        self.assertNotIn("phone", complaint)
        self.assertNotIn("location", complaint)
        self.assertNotIn("address", complaint)

    # 11. Tampered/invalid JWT is rejected by protected endpoints
    def test_11_invalid_jwt_rejected(self):
        invalid_headers = {"Authorization": "Bearer invalid.jwt.signature"}
        res = self.client.get("/api/dashboard-stats", headers=invalid_headers)
        self.assertEqual(res.status_code, 401)

    # 12. Existing citizen notification authentication still works
    def test_12_citizen_notification_authentication_works(self):
        token = encode_citizen_token(self.grievance_id)
        headers = {"Authorization": f"Bearer {token}"}
        res = self.client.get("/api/notifications", headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["recipient"], self.grievance_id)

    # 13. Existing admin search by name/phone/location still works when authenticated as admin
    def test_13_admin_search_by_pii_works(self):
        res = self.client.get("/api/get-complaints?search=Alice", headers=self.admin_headers)
        data = res.get_json()
        self.assertEqual(res.status_code, 200)
        self.assertEqual(data["total"], 1)
        self.assertIn("name", data["complaints"][0])
        self.assertEqual(data["complaints"][0]["name"], "Alice Smith")


if __name__ == "__main__":
    unittest.main()
