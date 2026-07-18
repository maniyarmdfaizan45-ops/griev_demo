import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(__file__))

from app import app


class AppRouteTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_root_returns_success_message(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload['status'], 'ok')
        self.assertIn('GrievanceAI', payload['message'])


if __name__ == '__main__':
    unittest.main()
