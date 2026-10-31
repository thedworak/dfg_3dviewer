"""Tests of deleting one's own account (POST /api/auth/delete-account) and of
reporting models (POST /api/jobs/<id>/report, /api/admin/reports):

  python3 -m unittest discover -s worker/tests
"""

import json
import os
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from unittest import mock

WORKER_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(WORKER_DIR))

from auth import AuthStore  # noqa: E402
from reports import ReportStore  # noqa: E402
from http.server import ThreadingHTTPServer  # noqa: E402

# server is imported when the tests run, not when they are loaded: other test
# modules (test_ai) set WORKER_* variables before their own import of it, and
# discovery loads this module first. Everything this test needs is patched.
server = None

PASSWORD = "correct-horse"


class AccountAndReportsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        global server
        os.environ.setdefault("WORKER_JOBS_DIR", tempfile.mkdtemp(prefix="account-test-jobs-"))
        import server as worker_server
        server = worker_server
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        cls.base = f"http://127.0.0.1:{cls.httpd.server_address[1]}"
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="account-test-"))
        self.auth = AuthStore(self.tmp / ".auth", mode="required", registration="open", secret="test-secret")
        self.reports = ReportStore(self.tmp / ".reports", hide_threshold=2)
        for patch in (
            mock.patch.object(server, "AUTH", self.auth),
            mock.patch.object(server, "REPORTS", self.reports),
            mock.patch.object(server, "JOBS_DIR", self.tmp),
            mock.patch.object(server.cloudflare, "purge_paths_async", lambda *args, **kwargs: None),
            mock.patch.object(server.mailer, "send_content_report", lambda *args, **kwargs: None),
        ):
            patch.start()
            self.addCleanup(patch.stop)
        for name in ("alice", "bob", "carol"):
            self.auth.register(name, PASSWORD, f"{name}@example.org")
        self.auth.ensure_admin("admin", PASSWORD)
        self.tokens = {name: self.auth.issue_token(name) for name in ("alice", "bob", "carol", "admin")}
        self.alice_jobs = [self.add_job("a" * 32, "alice"), self.add_job("b" * 32, "alice")]
        self.bob_job = self.add_job("c" * 32, "bob")

    def add_job(self, job_id, owner):
        model_dir = self.tmp / job_id / "input"
        model_dir.mkdir(parents=True, exist_ok=True)
        (model_dir / "model.glb").write_bytes(b"glTF")
        server.write_owner(job_id, owner, "model.glb", 4)
        return job_id

    def request(self, method, path, user=None, body=None, headers=None):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(self.base + path, data=data, method=method)
        if user:
            req.add_header("Authorization", f"Bearer {self.tokens[user]}")
        if data:
            req.add_header("Content-Type", "application/json")
        for name, value in (headers or {}).items():
            req.add_header(name, value)
        try:
            with urllib.request.urlopen(req) as response:
                return response.status, json.loads(response.read())
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read())

    def listed(self, user=None):
        status, body = self.request("GET", "/api/jobs", user)
        self.assertEqual(status, 200)
        return {job["id"] for job in body["jobs"]}

    # ---- account deletion -------------------------------------------------

    def test_delete_account_removes_account_and_models(self):
        status, body = self.request("POST", "/api/auth/delete-account", "alice", {"password": PASSWORD})
        self.assertEqual(status, 200)
        self.assertEqual(body["status"], "deleted")
        self.assertEqual(body["removedModels"], 2)
        self.assertNotIn("alice", {u["username"] for u in self.auth.list_users()})
        for job_id in self.alice_jobs:
            self.assertFalse((self.tmp / job_id).exists())
        self.assertTrue((self.tmp / self.bob_job).exists())
        # The old session no longer works.
        status, me = self.request("GET", "/api/auth/me", "alice")
        self.assertIsNone(me["user"])

    def test_delete_account_needs_password(self):
        status, _ = self.request("POST", "/api/auth/delete-account", "alice", {"password": "wrong-password"})
        self.assertEqual(status, 401)
        self.assertIn("alice", {u["username"] for u in self.auth.list_users()})
        self.assertTrue((self.tmp / self.alice_jobs[0]).exists())

    def test_delete_account_needs_login(self):
        status, _ = self.request("POST", "/api/auth/delete-account", None, {"password": PASSWORD})
        self.assertEqual(status, 401)

    def test_last_admin_cannot_delete_itself(self):
        status, _ = self.request("POST", "/api/auth/delete-account", "admin", {"password": PASSWORD})
        self.assertEqual(status, 409)
        self.assertIn("admin", {u["username"] for u in self.auth.list_users()})

    def test_linked_store_customer_is_deleted(self):
        self.auth.set_app_plan("alice", "$RCAnonymousID:abc", {"tier": "pro"})
        deleted = []
        entitlements = mock.Mock(delete_customer=lambda app_id: deleted.append(app_id) or True)
        with mock.patch.object(server, "ENTITLEMENTS", entitlements):
            status, body = self.request("POST", "/api/auth/delete-account", "alice", {"password": PASSWORD})
        self.assertEqual(status, 200)
        self.assertTrue(body["storeCustomerDeleted"])
        self.assertEqual(deleted, ["$RCAnonymousID:abc"])

    # ---- reports ------------------------------------------------------------

    def test_report_and_hide_after_threshold(self):
        status, _ = self.request("POST", f"/api/jobs/{self.bob_job}/report", "alice", {"reason": "offensive"})
        self.assertEqual(status, 201)
        self.assertIn(self.bob_job, self.listed("alice"))
        # The same reporter again counts once.
        self.request("POST", f"/api/jobs/{self.bob_job}/report", "alice", {"reason": "hate"})
        self.assertIn(self.bob_job, self.listed())
        self.request("POST", f"/api/jobs/{self.bob_job}/report", "carol", {"reason": "spam", "details": "ads"})
        # Two reporters: out of the list, except for its owner and admins.
        self.assertNotIn(self.bob_job, self.listed())
        self.assertNotIn(self.bob_job, self.listed("alice"))
        self.assertIn(self.bob_job, self.listed("bob"))
        self.assertIn(self.bob_job, self.listed("admin"))

    def test_report_needs_a_known_reason(self):
        status, _ = self.request("POST", f"/api/jobs/{self.bob_job}/report", "alice", {"reason": "boring"})
        self.assertEqual(status, 400)

    def test_report_of_missing_model(self):
        status, _ = self.request("POST", f"/api/jobs/{'z' * 32}/report", "alice", {"reason": "spam"})
        self.assertEqual(status, 404)

    def test_admin_resolves_reports(self):
        self.request("POST", f"/api/jobs/{self.bob_job}/report", "alice", {"reason": "offensive"})
        self.request("POST", f"/api/jobs/{self.bob_job}/report", "carol", {"reason": "offensive"})
        status, _ = self.request("GET", "/api/admin/reports", "alice")
        self.assertEqual(status, 403)
        status, body = self.request("GET", "/api/admin/reports", "admin")
        self.assertEqual(status, 200)
        self.assertEqual(len(body["reports"]), 2)
        self.assertNotIn("reporter", body["reports"][0])
        report_id = body["reports"][0]["id"]
        status, _ = self.request("POST", f"/api/admin/reports/{report_id}", "admin", {"action": "dismiss"})
        self.assertEqual(status, 200)
        # Every open report of the model is closed: it is listed again.
        self.assertIn(self.bob_job, self.listed())
        self.assertEqual(self.reports.list("open"), [])

    def test_admin_removes_model_and_disables_uploader(self):
        self.request("POST", f"/api/jobs/{self.bob_job}/report", "alice", {"reason": "violence"})
        report_id = self.reports.list("open")[0]["id"]
        status, _ = self.request("POST", f"/api/admin/reports/{report_id}", "admin", {"action": "remove-model"})
        self.assertEqual(status, 200)
        self.assertFalse((self.tmp / self.bob_job).exists())

        job = self.add_job("d" * 32, "bob")
        self.request("POST", f"/api/jobs/{job}/report", "alice", {"reason": "violence"})
        report_id = self.reports.list("open")[0]["id"]
        status, _ = self.request("POST", f"/api/admin/reports/{report_id}", "admin", {"action": "disable-user"})
        self.assertEqual(status, 200)
        self.assertEqual(next(u for u in self.auth.list_users() if u["username"] == "bob")["status"], "disabled")


if __name__ == "__main__":
    unittest.main()
