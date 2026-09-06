import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(__file__))

import app as app_module
from auth import encode_auth_token, encode_citizen_token
from database import GrievanceDB


class NotificationTests(unittest.TestCase):
    def setUp(self):
        self.original_db = app_module.db
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db = object.__new__(GrievanceDB)
        self.db.db_type = 'sqlite'
        self.db.sqlite_path = os.path.join(self.temp_dir.name, 'test_notifications.db')
        self.db.init_sqlite_db()
        app_module.db = self.db
        self.client = app_module.app.test_client()

        self.admin_headers = {
            'Authorization': f'Bearer {encode_auth_token("admin")}'
        }

    def tearDown(self):
        app_module.db = self.original_db
        self.temp_dir.cleanup()

    def submit_complaint(self, text="Water leakage on 5th avenue", category="Water", priority="High"):
        response = self.client.post('/api/submit-complaint', json={
            'complaint_text': text,
            'category': category,
            'priority': priority,
            'sentiment_score': -0.5,
        })
        self.assertEqual(response.status_code, 201)
        data = response.get_json()
        complaint = data['complaint']
        token = data.get('token') or encode_citizen_token(complaint['grievance_id'])
        return complaint, token

    def citizen_headers(self, token):
        return {'Authorization': f'Bearer {token}'}

    # 1. Notification after complaint submission
    def test_01_citizen_notification_after_submission(self):
        complaint, token = self.submit_complaint()
        grievance_id = complaint['grievance_id']

        response = self.client.get('/api/notifications', headers=self.citizen_headers(token))
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data['total'], 1)
        self.assertEqual(data['notifications'][0]['notification_type'], 'COMPLAINT_SUBMITTED')
        self.assertIn(grievance_id, data['notifications'][0]['message'])

    # 2. Notification after status change
    def test_02_notification_after_status_change(self):
        complaint, token = self.submit_complaint()
        cid = complaint['id']

        # Transition SUBMITTED -> ASSIGNED -> IN_PROGRESS
        self.client.put(f'/api/update-status/{cid}', json={'status': 'ASSIGNED'}, headers=self.admin_headers)
        self.client.put(f'/api/update-status/{cid}', json={'status': 'IN_PROGRESS'}, headers=self.admin_headers)

        res = self.client.get('/api/notifications', headers=self.citizen_headers(token))
        self.assertEqual(res.status_code, 200)
        notifs = res.get_json()['notifications']
        types = [n['notification_type'] for n in notifs]
        self.assertIn('COMPLAINT_ASSIGNED', types)
        self.assertIn('STATUS_CHANGED', types)

    # 3. Notification after resolution
    def test_03_notification_after_resolution(self):
        complaint, token = self.submit_complaint()
        cid = complaint['id']

        self.client.put(f'/api/update-status/{cid}', json={'status': 'ASSIGNED'}, headers=self.admin_headers)
        self.client.put(f'/api/update-status/{cid}', json={'status': 'IN_PROGRESS'}, headers=self.admin_headers)
        res_update = self.client.put(
            f'/api/update-status/{cid}',
            json={'status': 'RESOLVED', 'remark': 'Fixed pipe leak'},
            headers=self.admin_headers
        )
        self.assertEqual(res_update.status_code, 200)

        res = self.client.get('/api/notifications', headers=self.citizen_headers(token))
        notifs = res.get_json()['notifications']
        self.assertTrue(any(n['notification_type'] == 'COMPLAINT_RESOLVED' for n in notifs))

    # 4. Notification after reopening
    def test_04_notification_after_reopening(self):
        complaint, token = self.submit_complaint()
        cid = complaint['id']

        self.client.put(f'/api/update-status/{cid}', json={'status': 'ASSIGNED'}, headers=self.admin_headers)
        self.client.put(f'/api/update-status/{cid}', json={'status': 'IN_PROGRESS'}, headers=self.admin_headers)
        self.client.put(f'/api/update-status/{cid}', json={'status': 'RESOLVED', 'remark': 'Resolved'}, headers=self.admin_headers)
        reopen_res = self.client.put(f'/api/update-status/{cid}', json={'status': 'REOPENED', 'remark': 'Water leaking again'}, headers=self.admin_headers)
        self.assertEqual(reopen_res.status_code, 200)

        res = self.client.get('/api/notifications', headers=self.citizen_headers(token))
        notifs = res.get_json()['notifications']
        self.assertTrue(any(n['notification_type'] == 'COMPLAINT_REOPENED' for n in notifs))

    # 5. Admin notification for new complaint
    def test_05_admin_notification_for_new_complaint(self):
        complaint, _ = self.submit_complaint()
        gid = complaint['grievance_id']

        res = self.client.get('/api/notifications', headers=self.admin_headers)
        self.assertEqual(res.status_code, 200)
        notifs = res.get_json()['notifications']
        self.assertTrue(any(n['notification_type'] == 'NEW_COMPLAINT_SUBMITTED' and n['grievance_id'] == gid for n in notifs))

    # 6. Unauthenticated request without valid JWT is denied
    def test_06_unauthenticated_request_denied(self):
        complaint, _ = self.submit_complaint()
        gid = complaint['grievance_id']

        # Requesting without Authorization header (even if grievance_id query param is present) must return 401
        res = self.client.get(f'/api/notifications?grievance_id={gid}')
        self.assertEqual(res.status_code, 401)

        res_read_all = self.client.put('/api/notifications/read-all')
        self.assertEqual(res_read_all.status_code, 401)

    # 7. Citizen cannot retrieve another citizen's notifications by changing grievance ID
    def test_07_citizen_cannot_read_another_citizen_notifications(self):
        c1, token1 = self.submit_complaint(text="Pothole on main highway road", category="Road")
        c2, token2 = self.submit_complaint(text="Garbage overflow in sector 4 street", category="Garbage")

        # Citizen 1 uses their token but appends C2's grievance_id to query string
        res = self.client.get(f'/api/notifications?grievance_id={c2["grievance_id"]}', headers=self.citizen_headers(token1))
        self.assertEqual(res.status_code, 200)
        notifs = res.get_json()['notifications']

        # Must return ONLY Citizen 1's notifications, ignoring unverified query param
        self.assertTrue(all(n['recipient'] == c1['grievance_id'] for n in notifs))
        self.assertFalse(any(n['recipient'] == c2['grievance_id'] for n in notifs))

    # 8. Citizen cannot mark another citizen's notification as read
    def test_08_citizen_cannot_mark_another_citizen_notification_as_read(self):
        c1, token1 = self.submit_complaint(text="Pothole on main highway road", category="Road")
        c2, token2 = self.submit_complaint(text="Garbage overflow in sector 4 street", category="Garbage")

        c2_notifs = self.client.get('/api/notifications', headers=self.citizen_headers(token2)).get_json()['notifications']
        c2_notif_id = c2_notifs[0]['id']

        # Citizen 1 tries to mark Citizen 2's notification as read
        unauth_read = self.client.put(f'/api/notifications/{c2_notif_id}/read', headers=self.citizen_headers(token1))
        self.assertEqual(unauth_read.status_code, 404)

        # Verify C2 notification is still unread
        c2_notifs_after = self.client.get('/api/notifications', headers=self.citizen_headers(token2)).get_json()['notifications']
        self.assertFalse(c2_notifs_after[0]['is_read'])

    # 9. Citizen cannot mark another citizen's notifications as read-all
    def test_09_citizen_cannot_mark_another_citizen_notifications_read_all(self):
        c1, token1 = self.submit_complaint(text="Pothole on main highway road", category="Road")
        c2, token2 = self.submit_complaint(text="Garbage overflow in sector 4 street", category="Garbage")

        # Citizen 1 calls read-all
        res = self.client.put('/api/notifications/read-all', headers=self.citizen_headers(token1))
        self.assertEqual(res.status_code, 200)

        # Citizen 2's unread count must remain 1
        c2_data = self.client.get('/api/notifications', headers=self.citizen_headers(token2)).get_json()
        self.assertEqual(c2_data['unread_count'], 1)

    # 10. Admin can access admin notifications through existing JWT authentication
    def test_10_admin_can_access_admin_notifications(self):
        res = self.client.get('/api/notifications', headers=self.admin_headers)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json()['recipient'], 'admin')

    # 11. Citizen cannot access admin notifications
    def test_11_citizen_cannot_access_admin_notifications(self):
        c1, token1 = self.submit_complaint()
        res = self.client.get('/api/notifications', headers=self.citizen_headers(token1))
        self.assertEqual(res.status_code, 200)
        notifs = res.get_json()['notifications']

        # None of the citizen's notifications must be for 'admin'
        self.assertTrue(all(n['recipient'] == c1['grievance_id'] for n in notifs))
        self.assertFalse(any(n['recipient'] == 'admin' for n in notifs))

    # 12. Mark one notification as read
    def test_12_mark_one_notification_as_read(self):
        complaint, token = self.submit_complaint()

        res_before = self.client.get('/api/notifications', headers=self.citizen_headers(token))
        notif_id = res_before.get_json()['notifications'][0]['id']
        self.assertEqual(res_before.get_json()['unread_count'], 1)

        read_res = self.client.put(f'/api/notifications/{notif_id}/read', headers=self.citizen_headers(token))
        self.assertEqual(read_res.status_code, 200)
        self.assertTrue(read_res.get_json()['notification']['is_read'])

        res_after = self.client.get('/api/notifications', headers=self.citizen_headers(token))
        self.assertEqual(res_after.get_json()['unread_count'], 0)

    # 13. Mark all notifications as read
    def test_13_mark_all_notifications_as_read(self):
        complaint, token = self.submit_complaint()
        cid = complaint['id']

        self.client.put(f'/api/update-status/{cid}', json={'status': 'ASSIGNED'}, headers=self.admin_headers)

        res_before = self.client.get('/api/notifications', headers=self.citizen_headers(token))
        self.assertGreaterEqual(res_before.get_json()['unread_count'], 2)

        read_all_res = self.client.put('/api/notifications/read-all', headers=self.citizen_headers(token))
        self.assertEqual(read_all_res.status_code, 200)

        res_after = self.client.get('/api/notifications', headers=self.citizen_headers(token))
        self.assertEqual(res_after.get_json()['unread_count'], 0)

    # 14. Correct unread count
    def test_14_correct_unread_count(self):
        complaint, token = self.submit_complaint()

        res = self.client.get('/api/notifications', headers=self.citizen_headers(token))
        data = res.get_json()
        unread_cnt = sum(1 for n in data['notifications'] if not n['is_read'])
        self.assertEqual(data['unread_count'], unread_cnt)

    # 15. Duplicate event does not create duplicate notifications
    def test_15_duplicate_event_does_not_create_duplicate_notifications(self):
        complaint, _ = self.submit_complaint()
        cid = complaint['id']

        for _ in range(5):
            self.db.get_complaint(cid)

        admin_notifs = self.client.get('/api/notifications', headers=self.admin_headers).get_json()['notifications']
        submit_notifs = [n for n in admin_notifs if n['event_key'] == f"submit:{cid}:admin"]
        self.assertEqual(len(submit_notifs), 1)

    # 16. SLA state transition creates one notification
    def test_16_sla_state_transition_creates_one_notification(self):
        complaint, _ = self.submit_complaint()
        cid = complaint['id']

        self.db.create_notification(
            recipient="admin",
            notification_type="SLA_BREACHED",
            title="SLA Breached",
            message="SLA breached",
            grievance_id=complaint['grievance_id'],
            complaint_id=cid,
            event_key=f"sla:{cid}:SLA_BREACHED:admin"
        )
        self.db.create_notification(
            recipient="admin",
            notification_type="SLA_BREACHED",
            title="SLA Breached",
            message="SLA breached again",
            grievance_id=complaint['grievance_id'],
            complaint_id=cid,
            event_key=f"sla:{cid}:SLA_BREACHED:admin"
        )

        admin_notifs = self.client.get('/api/notifications', headers=self.admin_headers).get_json()['notifications']
        sla_notifs = [n for n in admin_notifs if n['event_key'] == f"sla:{cid}:SLA_BREACHED:admin"]
        self.assertEqual(len(sla_notifs), 1)

    # 17. Escalation creates one notification
    def test_17_escalation_creates_one_notification(self):
        complaint, token = self.submit_complaint()
        cid = complaint['id']

        esc_res = self.client.post(
            f'/api/escalate/{cid}',
            json={'reason': 'Delayed resolution'},
            headers=self.admin_headers
        )
        self.assertEqual(esc_res.status_code, 200)

        cit_notifs = self.client.get('/api/notifications', headers=self.citizen_headers(token)).get_json()['notifications']
        cit_esc = [n for n in cit_notifs if n['notification_type'] == 'COMPLAINT_ESCALATED']
        self.assertEqual(len(cit_esc), 1)

        adm_notifs = self.client.get('/api/notifications', headers=self.admin_headers).get_json()['notifications']
        adm_esc = [n for n in adm_notifs if n['notification_type'] == 'COMPLAINT_ESCALATED' and n['complaint_id'] == cid]
        self.assertEqual(len(adm_esc), 1)

    # 18. Related/duplicate detection can create an appropriate notification
    def test_18_related_duplicate_detection_creates_notification(self):
        self.submit_complaint(text="Water pipeline bursting near main gate street area", category="Water")
        self.submit_complaint(text="Water pipeline bursting near main gate street area", category="Water")

        adm_notifs = self.client.get('/api/notifications', headers=self.admin_headers).get_json()['notifications']
        dup_notifs = [n for n in adm_notifs if n['notification_type'] == 'DUPLICATE_DETECTED']
        self.assertGreaterEqual(len(dup_notifs), 1)


if __name__ == '__main__':
    unittest.main()
