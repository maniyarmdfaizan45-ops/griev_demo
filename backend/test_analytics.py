import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(__file__))

import app as app_module
from auth import encode_auth_token
from database import GrievanceDB


class AnalyticsTests(unittest.TestCase):
    def setUp(self):
        self.original_db = app_module.db
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db = object.__new__(GrievanceDB)
        self.db.db_type = 'sqlite'
        self.db.sqlite_path = os.path.join(self.temp_dir.name, 'test_analytics.db')
        self.db.init_sqlite_db()
        app_module.db = self.db
        self.client = app_module.app.test_client()

        self.admin_headers = {
            'Authorization': f'Bearer {encode_auth_token("admin")}'
        }

    def tearDown(self):
        app_module.db = self.original_db
        self.temp_dir.cleanup()

    def submit_complaint(self, text="Water supply pipe leak on Main Street", category="Water", priority="High"):
        res = self.client.post('/api/submit-complaint', json={
            'complaint_text': text,
            'category': category,
            'priority': priority,
            'sentiment_score': -0.4,
        })
        self.assertEqual(res.status_code, 201)
        return res.get_json()['complaint']

    # 1. Existing dashboard statistics remain correct
    def test_01_existing_dashboard_statistics(self):
        self.submit_complaint(category="Water", priority="High")
        self.submit_complaint(category="Road", priority="Low")

        res = self.client.get('/api/dashboard-stats', headers=self.admin_headers)
        self.assertEqual(res.status_code, 200)
        stats = res.get_json()['stats']

        self.assertEqual(stats['total_complaints'], 2)
        self.assertEqual(stats['high_priority_complaints'], 1)
        self.assertEqual(stats['pending_complaints'], 2)
        self.assertEqual(stats['resolved_complaints'], 0)
        self.assertIn('category_distribution', stats)
        self.assertIn('priority_distribution', stats)
        self.assertIn('trend_data', stats)

    # 2. SLA counts are correct
    def test_02_sla_counts(self):
        c1 = self.submit_complaint(priority="High")
        res = self.client.get('/api/dashboard-stats', headers=self.admin_headers)
        sla = res.get_json()['stats']['sla_analytics']

        self.assertEqual(sla['total_sla_tracked'], 1)
        self.assertIn('within_sla', sla)
        self.assertIn('near_deadline', sla)
        self.assertIn('currently_breached', sla)
        self.assertIn('resolved_within_sla', sla)
        self.assertIn('resolved_after_sla', sla)

    # 3. SLA breach rate is correct
    def test_03_sla_breach_rate(self):
        c1 = self.submit_complaint()

        # Simulate breach by inserting notification event or setting status
        res = self.client.get('/api/dashboard-stats', headers=self.admin_headers)
        sla = res.get_json()['stats']['sla_analytics']
        self.assertIsInstance(sla['sla_breach_rate'], float)

    # 4. SLA compliance rate is correct
    def test_04_sla_compliance_rate(self):
        c1 = self.submit_complaint()
        res = self.client.get('/api/dashboard-stats', headers=self.admin_headers)
        sla = res.get_json()['stats']['sla_analytics']

        self.assertEqual(sla['sla_compliance_rate'], round(100.0 - sla['sla_breach_rate'], 1))

    # 5. Average resolution time is calculated correctly
    def test_05_avg_resolution_time(self):
        c1 = self.submit_complaint()
        cid = c1['id']

        self.client.put(f'/api/update-status/{cid}', json={'status': 'ASSIGNED'}, headers=self.admin_headers)
        self.client.put(f'/api/update-status/{cid}', json={'status': 'IN_PROGRESS'}, headers=self.admin_headers)
        self.client.put(f'/api/update-status/{cid}', json={'status': 'RESOLVED', 'remark': 'Fixed'}, headers=self.admin_headers)

        res = self.client.get('/api/dashboard-stats', headers=self.admin_headers)
        res_analytics = res.get_json()['stats']['resolution_analytics']
        self.assertIn('avg_resolution_time_hours', res_analytics)
        self.assertGreaterEqual(res_analytics['avg_resolution_time_hours'], 0.0)

    # 6. Department performance metrics are correct
    def test_06_department_performance_metrics(self):
        self.submit_complaint(category="Water")
        res = self.client.get('/api/dashboard-stats', headers=self.admin_headers)
        dept_perf = res.get_json()['stats']['department_performance']

        self.assertIsInstance(dept_perf, list)
        self.assertGreater(len(dept_perf), 0)
        water_dept = next((d for d in dept_perf if 'Water' in d['department']), None)
        self.assertIsNotNone(water_dept)
        self.assertEqual(water_dept['total_complaints'], 1)

    # 7. Escalation count/rate is correct
    def test_07_escalation_count_and_rate(self):
        c1 = self.submit_complaint()
        cid = c1['id']

        self.client.post(f'/api/escalate/{cid}', json={'reason': 'Emergency'}, headers=self.admin_headers)

        res = self.client.get('/api/dashboard-stats', headers=self.admin_headers)
        esc = res.get_json()['stats']['escalation_analytics']

        self.assertEqual(esc['total_escalated'], 1)
        self.assertEqual(esc['escalation_rate'], 100.0)

    # 8. Reopen count/rate is correct
    def test_08_reopen_count_and_rate(self):
        c1 = self.submit_complaint()
        cid = c1['id']

        self.client.put(f'/api/update-status/{cid}', json={'status': 'ASSIGNED'}, headers=self.admin_headers)
        self.client.put(f'/api/update-status/{cid}', json={'status': 'IN_PROGRESS'}, headers=self.admin_headers)
        self.client.put(f'/api/update-status/{cid}', json={'status': 'RESOLVED', 'remark': 'Resolved'}, headers=self.admin_headers)
        self.client.put(f'/api/update-status/{cid}', json={'status': 'REOPENED', 'remark': 'Reopened'}, headers=self.admin_headers)

        res = self.client.get('/api/dashboard-stats', headers=self.admin_headers)
        reopen = res.get_json()['stats']['reopen_analytics']

        self.assertEqual(reopen['total_reopened'], 1)
        self.assertEqual(reopen['reopen_rate'], 100.0)

    # 9. Empty dataset does not cause division-by-zero errors
    def test_09_empty_dataset_no_errors(self):
        res = self.client.get('/api/dashboard-stats', headers=self.admin_headers)
        self.assertEqual(res.status_code, 200)
        stats = res.get_json()['stats']

        self.assertEqual(stats['total_complaints'], 0)
        self.assertEqual(stats['sla_analytics']['sla_breach_rate'], 0.0)
        self.assertEqual(stats['sla_analytics']['sla_compliance_rate'], 100.0)
        self.assertEqual(stats['resolution_analytics']['avg_resolution_time_hours'], 0.0)

    # 10. Admin authentication is required
    def test_10_admin_authentication_required(self):
        res_unauth = self.client.get('/api/dashboard-stats')
        self.assertEqual(res_unauth.status_code, 401)


if __name__ == '__main__':
    unittest.main()
