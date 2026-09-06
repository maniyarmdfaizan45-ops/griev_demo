import os
import sqlite3
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(__file__))

import app as app_module
from auth import encode_auth_token
from database import GrievanceDB
from sla import calculate_deadline, calculate_sla_status
from similarity import find_related_complaints


class AppRouteTests(unittest.TestCase):
    def setUp(self):
        self.client = app_module.app.test_client()

    def test_root_returns_success_message(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload['status'], 'ok')
        self.assertIn('GrievanceAI', payload['message'])


class WorkflowTests(unittest.TestCase):
    def setUp(self):
        self.original_db = app_module.db
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db = object.__new__(GrievanceDB)
        self.db.db_type = 'sqlite'
        self.db.sqlite_path = os.path.join(self.temp_dir.name, 'workflow.db')
        self.db.init_sqlite_db()
        app_module.db = self.db
        self.client = app_module.app.test_client()
        self.auth_headers = {
            'Authorization': f'Bearer {encode_auth_token("test-admin")}'
        }

    def tearDown(self):
        app_module.db = self.original_db
        self.temp_dir.cleanup()

    def submit(self):
        response = self.client.post('/api/submit-complaint', json={
            'complaint_text': 'Workflow test complaint',
            'category': 'Others',
            'priority': 'Low',
            'sentiment_score': 0,
        })
        self.assertEqual(response.status_code, 201)
        return response.get_json()['complaint']['id']

    def update(self, complaint_id, status, remark=None):
        payload = {'status': status}
        if remark is not None:
            payload['remark'] = remark
        return self.client.put(
            f'/api/update-status/{complaint_id}',
            json=payload,
            headers=self.auth_headers,
        )

    def test_valid_lifecycle_reopen_and_history(self):
        complaint_id = self.submit()
        self.assertEqual(self.db.get_complaint(complaint_id)['status'], 'SUBMITTED')
        for status, remark in [
            ('ASSIGNED', None),
            ('IN_PROGRESS', None),
            ('RESOLVED', 'Initial work completed'),
            ('REOPENED', 'The issue returned'),
            ('IN_PROGRESS', None),
            ('RESOLVED', 'Repair completed again'),
            ('CLOSED', None),
        ]:
            response = self.update(complaint_id, status, remark)
            self.assertEqual(response.status_code, 200, response.get_json())

        history_response = self.client.get(f'/api/get-complaints/{complaint_id}/history')
        self.assertEqual(history_response.status_code, 200)
        history = history_response.get_json()['history']
        self.assertEqual(
            [event['new_status'] for event in history],
            ['SUBMITTED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REOPENED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
        )
        self.assertEqual(history[3]['remark'], 'Initial work completed')
        closed_update = self.update(complaint_id, 'IN_PROGRESS')
        self.assertEqual(closed_update.status_code, 400)
        self.assertIn('Invalid status transition', closed_update.get_json()['message'])

    def test_invalid_transitions_unknown_status_and_unauthorized_update(self):
        complaint_id = self.submit()
        unauthorized = self.client.put(
            f'/api/update-status/{complaint_id}',
            json={'status': 'ASSIGNED'},
        )
        self.assertEqual(unauthorized.status_code, 401)

        invalid = self.update(complaint_id, 'RESOLVED', 'Skipping required stages')
        self.assertEqual(invalid.status_code, 400)
        self.assertIn('Invalid status transition', invalid.get_json()['message'])

        unknown = self.update(complaint_id, 'NOT_A_STATUS')
        self.assertEqual(unknown.status_code, 400)
        self.assertIn('Unknown status', unknown.get_json()['message'])

        missing = self.update('does-not-exist', 'ASSIGNED')
        self.assertEqual(missing.status_code, 404)

        missing_history = self.client.get('/api/get-complaints/does-not-exist/history')
        self.assertEqual(missing_history.status_code, 404)

    def test_resolution_and_reopen_require_remarks(self):
        complaint_id = self.submit()
        self.assertEqual(self.update(complaint_id, 'ASSIGNED').status_code, 200)
        self.assertEqual(self.update(complaint_id, 'IN_PROGRESS').status_code, 200)
        missing_resolution_remark = self.update(complaint_id, 'RESOLVED')
        self.assertEqual(missing_resolution_remark.status_code, 400)

        self.assertEqual(self.update(complaint_id, 'RESOLVED', 'Completed repair').status_code, 200)
        missing_reopen_remark = self.update(complaint_id, 'REOPENED')
        self.assertEqual(missing_reopen_remark.status_code, 400)

    def test_category_department_mapping_and_admin_override(self):
        expected = {
            'Water': 'Water Supply Department',
            'Electricity': 'Electricity Department',
            'Road': 'Public Works Department',
            'Garbage': 'Sanitation/Waste Management Department',
            'Others': 'General/Public Grievance Department',
        }
        complaint_ids = {}
        for category, department in expected.items():
            response = self.client.post('/api/submit-complaint', json={
                'complaint_text': f'{category} department mapping test',
                'category': category,
                'priority': 'Low',
                'sentiment_score': 0,
            })
            self.assertEqual(response.status_code, 201)
            complaint = response.get_json()['complaint']
            complaint_ids[category] = complaint['id']
            self.assertEqual(complaint['department'], department)
            self.assertEqual(self.db.get_complaint(complaint['id'])['department'], department)

        road_id = complaint_ids['Road']
        override = self.client.put(
            f'/api/update-department/{road_id}',
            json={'department': expected['Others']},
            headers=self.auth_headers,
        )
        self.assertEqual(override.status_code, 200)
        self.assertEqual(override.get_json()['complaint']['department'], expected['Others'])
        self.assertEqual(self.db.get_complaint(road_id)['category'], 'Road')

        invalid = self.client.put(
            f'/api/update-department/{road_id}',
            json={'department': 'Not a department'},
            headers=self.auth_headers,
        )
        self.assertEqual(invalid.status_code, 400)

    def test_prediction_and_submission_automatically_assign_department(self):
        prediction = self.client.post('/api/predict', json={
            'complaint_text': 'Several potholes are making the road unsafe near the school.',
        })
        self.assertEqual(prediction.status_code, 200)
        prediction_data = prediction.get_json()['data']
        self.assertEqual(prediction_data['category'], 'Road')
        self.assertEqual(prediction_data['department'], 'Public Works Department')

        submission = self.client.post('/api/submit-complaint', json={
            'complaint_text': 'Several potholes are making the road unsafe near the school.',
        })
        self.assertEqual(submission.status_code, 201)
        complaint = submission.get_json()['complaint']
        self.assertEqual(complaint['category'], 'Road')
        self.assertEqual(complaint['department'], 'Public Works Department')

    def test_public_ids_are_unique_stable_and_trackable(self):
        first_id = self.submit()
        second_id = self.submit()
        first = self.db.get_complaint(first_id)
        second = self.db.get_complaint(second_id)
        self.assertRegex(first['grievance_id'], r'^GRV-\d{4}-\d{6}$')
        self.assertRegex(second['grievance_id'], r'^GRV-\d{4}-\d{6}$')
        self.assertNotEqual(first['grievance_id'], second['grievance_id'])

        public_lookup = self.client.get(f"/api/get-complaints/by-grievance-id/{first['grievance_id']}")
        self.assertEqual(public_lookup.status_code, 200)
        self.assertEqual(public_lookup.get_json()['complaint']['id'], first_id)

        original_public_id = first['grievance_id']
        self.assertEqual(self.update(first_id, 'ASSIGNED').status_code, 200)
        self.assertEqual(self.update(first_id, 'IN_PROGRESS').status_code, 200)
        self.assertEqual(self.update(first_id, 'RESOLVED', 'Completed work').status_code, 200)
        self.assertEqual(self.update(first_id, 'REOPENED', 'Issue returned').status_code, 200)
        department_update = self.client.put(
            f'/api/update-department/{first_id}',
            json={'department': 'Public Works Department'},
            headers=self.auth_headers,
        )
        self.assertEqual(department_update.status_code, 200)
        self.assertEqual(self.db.get_complaint(first_id)['grievance_id'], original_public_id)

    def test_existing_internal_ids_receive_public_ids_on_migration(self):
        internal_id = 'legacy-internal-uuid'
        with tempfile.TemporaryDirectory() as folder:
            path = os.path.join(folder, 'legacy.db')
            connection = sqlite3.connect(path)
            connection.execute("""
                CREATE TABLE complaints (
                    id TEXT PRIMARY KEY,
                    complaint_text TEXT NOT NULL,
                    category TEXT NOT NULL,
                    priority TEXT NOT NULL,
                    sentiment_score REAL NOT NULL,
                    status TEXT NOT NULL,
                    timestamp TEXT NOT NULL
                )
            """)
            connection.execute(
                "INSERT INTO complaints VALUES (?, ?, ?, ?, ?, ?, ?)",
                (internal_id, 'Legacy complaint', 'Road', 'Low', 0.0, 'Pending', '2026-04-03T10:00:00Z'),
            )
            connection.commit()
            connection.close()

            legacy_db = object.__new__(GrievanceDB)
            legacy_db.db_type = 'sqlite'
            legacy_db.sqlite_path = path
            legacy_db.init_sqlite_db()
            migrated = legacy_db.get_complaint(internal_id)
            self.assertEqual(migrated['id'], internal_id)
            self.assertEqual(migrated['grievance_id'], 'GRV-2026-000001')
            self.assertEqual(migrated['status'], 'SUBMITTED')
            self.assertEqual(migrated['sla_deadline'], '2026-04-10T10:00:00Z')

    def test_sla_windows_and_boundaries_are_deterministic(self):
        created_at = '2026-09-06T14:00:00Z'
        expected_deadlines = {
            'High': '2026-09-07T14:00:00Z',
            'Medium': '2026-09-09T14:00:00Z',
            'Low': '2026-09-13T14:00:00Z',
        }
        for priority, expected_deadline in expected_deadlines.items():
            complaint = self.db.insert_complaint(
                f'{priority} SLA test', 'Others', priority, 0, created_at=created_at
            )
            self.assertEqual(complaint['sla_deadline'], expected_deadline)

        high_deadline = expected_deadlines['High']
        self.assertEqual(
            calculate_sla_status('IN_PROGRESS', high_deadline, 'High', now='2026-09-06T20:00:00Z'),
            'WITHIN_SLA',
        )
        self.assertEqual(
            calculate_sla_status('IN_PROGRESS', high_deadline, 'High', now='2026-09-07T09:00:00Z'),
            'NEAR_DEADLINE',
        )
        self.assertEqual(
            calculate_sla_status('IN_PROGRESS', high_deadline, 'High', now='2026-09-07T15:00:00Z'),
            'SLA_BREACHED',
        )
        self.assertEqual(
            calculate_sla_status('RESOLVED', high_deadline, 'High', '2026-09-07T13:59:00Z'),
            'RESOLVED_WITHIN_SLA',
        )
        self.assertEqual(
            calculate_sla_status('RESOLVED', high_deadline, 'High', '2026-09-07T14:01:00Z'),
            'RESOLVED_AFTER_SLA',
        )

    def test_reopening_restarts_active_sla_and_preserves_resolution_history(self):
        complaint_id = self.db.insert_complaint(
            'Reopen SLA test', 'Others', 'High', 0, created_at='2026-09-06T14:00:00Z'
        )['id']
        self.assertEqual(self.update(complaint_id, 'ASSIGNED').status_code, 200)
        self.assertEqual(self.update(complaint_id, 'IN_PROGRESS').status_code, 200)
        self.assertEqual(self.update(complaint_id, 'RESOLVED', 'Initial resolution').status_code, 200)
        before_reopen = self.db.get_complaint(complaint_id)
        self.assertEqual(before_reopen['sla_result'], 'RESOLVED_WITHIN_SLA')
        self.assertEqual(self.update(complaint_id, 'REOPENED', 'Issue returned').status_code, 200)
        after_reopen = self.db.get_complaint(complaint_id)
        self.assertNotEqual(after_reopen['sla_deadline'], before_reopen['sla_deadline'])
        self.assertIsNone(after_reopen['sla_result'])
        history = self.db.get_status_history(complaint_id)
        self.assertIn('Initial resolution', [event['remark'] for event in history])

    def test_escalation_detection_is_idempotent_and_uses_existing_sla(self):
        not_breached = self.db.insert_complaint(
            'Active SLA complaint', 'Others', 'High', 0, created_at='2099-09-06T14:00:00Z'
        )['id']
        normal = self.db.get_complaint(not_breached)
        self.assertEqual(normal['sla_status'], 'WITHIN_SLA')
        self.assertEqual(normal['escalation_status'], 'NOT_ESCALATED')

        breached = self.db.insert_complaint(
            'Breached SLA complaint', 'Others', 'High', 0, created_at='2020-09-06T14:00:00Z'
        )['id']
        first_read = self.db.get_complaint(breached)
        second_read = self.db.get_complaint(breached)
        self.assertEqual(first_read['sla_status'], 'SLA_BREACHED')
        self.assertEqual(first_read['escalation_status'], 'ESCALATED')
        self.assertEqual(first_read['escalation_level'], 1)
        self.assertEqual(second_read['escalation_status'], 'ESCALATED')
        escalation_events = [
            event for event in self.db.get_status_history(breached)
            if event['event_type'] == 'ESCALATION'
        ]
        self.assertEqual(len(escalation_events), 1)

    def test_escalation_resolution_reopen_and_manual_authorization(self):
        breached = self.db.insert_complaint(
            'Escalation lifecycle complaint', 'Others', 'High', 0, created_at='2020-09-06T14:00:00Z'
        )['id']
        self.assertEqual(self.db.get_complaint(breached)['escalation_status'], 'ESCALATED')
        self.assertEqual(self.update(breached, 'ASSIGNED').status_code, 200)
        self.assertEqual(self.update(breached, 'IN_PROGRESS').status_code, 200)
        resolved = self.update(breached, 'RESOLVED', 'Resolved after escalation')
        self.assertEqual(resolved.status_code, 200)
        resolved_data = resolved.get_json()['complaint']
        self.assertEqual(resolved_data['sla_status'], 'RESOLVED_AFTER_SLA')
        self.assertEqual(resolved_data['escalation_status'], 'ESCALATED')

        reopened = self.update(breached, 'REOPENED', 'Issue returned')
        self.assertEqual(reopened.status_code, 200)
        reopened_data = reopened.get_json()['complaint']
        self.assertEqual(reopened_data['escalation_status'], 'NOT_ESCALATED')
        self.assertEqual(reopened_data['escalation_level'], 0)
        self.assertTrue(any(
            event['event_type'] == 'ESCALATION'
            for event in self.db.get_status_history(breached)
        ))

        unauthorized = self.client.post(
            f'/api/escalate/{breached}', json={'reason': 'Manual review'}
        )
        self.assertEqual(unauthorized.status_code, 401)
        manual = self.client.post(
            f'/api/escalate/{breached}',
            json={'reason': 'Officer requested senior review'},
            headers=self.auth_headers,
        )
        self.assertEqual(manual.status_code, 200)
        self.assertEqual(manual.get_json()['complaint']['escalation_status'], 'ESCALATED')
        duplicate = self.client.post(
            f'/api/escalate/{breached}',
            json={'reason': 'Second review'},
            headers=self.auth_headers,
        )
        self.assertEqual(duplicate.status_code, 400)

    def test_closed_grievance_does_not_escalate(self):
        complaint_id = self.db.insert_complaint(
            'Future closed complaint', 'Others', 'Low', 0, created_at='2099-09-06T14:00:00Z'
        )['id']
        self.assertEqual(self.update(complaint_id, 'ASSIGNED').status_code, 200)
        self.assertEqual(self.update(complaint_id, 'IN_PROGRESS').status_code, 200)
        self.assertEqual(self.update(complaint_id, 'RESOLVED', 'Completed').status_code, 200)
        closed = self.update(complaint_id, 'CLOSED')
        self.assertEqual(closed.status_code, 200)
        self.assertEqual(closed.get_json()['complaint']['escalation_status'], 'NOT_ESCALATED')

    def test_related_detection_returns_no_match_for_unrelated_issue(self):
        existing = self.db.insert_complaint(
            'No water supply in Vidyanagar.', 'Water', 'Low', 0,
            created_at='2099-09-06T14:00:00Z',
        )
        results = find_related_complaints(
            'The road has large potholes near the railway station.',
            'Road', 'Public Works Department', [self.db.get_complaint(existing['id'])],
        )
        self.assertEqual(results, [])

    def test_related_detection_identifies_similar_and_location_matches(self):
        existing = self.db.insert_complaint(
            'LOCATION: Vidyanagar\nNo water supply in Vidyanagar for three days.', 'Water', 'Low', 0,
            created_at='2099-09-06T14:00:00Z',
        )
        candidate = self.db.get_complaint(existing['id'])
        results = find_related_complaints(
            'There has been no water in Vidyanagar for the last three days.',
            'Water', 'Water Supply Department', [candidate],
        )
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['match_type'], 'HIGHLY_SIMILAR')
        self.assertEqual(results[0]['related_grievance_id'], existing['grievance_id'])

        different_issue = find_related_complaints(
            'Water pressure is very low in another area.',
            'Water', 'Water Supply Department', [candidate],
        )
        self.assertEqual(different_issue, [])

        same_text_other_location = find_related_complaints(
            'LOCATION: Rajapur\nNo water supply in Vidyanagar for three days.',
            'Water', 'Water Supply Department', [candidate],
        )
        self.assertTrue(
            not same_text_other_location
            or same_text_other_location[0]['match_type'] != 'HIGHLY_SIMILAR'
        )

        same_location = find_related_complaints(
            'LOCATION: Vidyanagar\nNo water supply in Vidyanagar for three days.',
            'Water', 'Water Supply Department', [candidate],
        )
        self.assertEqual(same_location[0]['match_type'], 'HIGHLY_SIMILAR')

    def test_related_detection_limits_multiple_matches_and_submission_response(self):
        for index in range(4):
            self.db.insert_complaint(
                f'No water supply in Vidyanagar for {index + 2} days.', 'Water', 'Low', 0,
                created_at='2099-09-06T14:00:00Z',
            )
        response = self.client.post('/api/submit-complaint', json={
            'complaint_text': 'No water supply in Vidyanagar for three days.',
            'category': 'Water',
            'priority': 'Low',
            'sentiment_score': 0,
        })
        self.assertEqual(response.status_code, 201)
        payload = response.get_json()
        self.assertTrue(payload['possible_duplicate'])
        self.assertLessEqual(len(payload['related_grievances']), 3)
        self.assertTrue(payload['complaint']['possible_duplicate'])

    def test_first_complaint_has_no_related_matches(self):
        response = self.client.post('/api/submit-complaint', json={
            'complaint_text': 'A unique civic complaint with no prior match.',
            'category': 'Others',
            'priority': 'Low',
            'sentiment_score': 0,
        })
        self.assertEqual(response.status_code, 201)
        payload = response.get_json()
        self.assertFalse(payload['possible_duplicate'])
        self.assertEqual(payload['related_grievances'], [])


if __name__ == '__main__':
    unittest.main()
