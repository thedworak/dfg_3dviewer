"""Tests of the mail to the administrators about a new account
(POST /api/auth/register, mailer.send_new_account) and of the admin panel's
statistics (GET /api/admin/stats):

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
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest import mock

WORKER_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(WORKER_DIR))

import mailer  # noqa: E402
from auth import AuthStore  # noqa: E402

server = None  # imported when the tests run, see test_account_and_reports.py

PASSWORD = "correct-horse"


class AdminStatsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        global server
        os.environ.setdefault("WORKER_JOBS_DIR", tempfile.mkdtemp(prefix="stats-test-jobs-"))
        import server as worker_server
        server = worker_server
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        cls.base = f"http://127.0.0.1:{cls.httpd.server_address[1]}"
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="stats-test-"))
        self.auth = AuthStore(self.tmp / ".auth", mode="required", registration="approval", secret="test-secret")
        self.mails = []
        for patch in (
            mock.patch.object(server, "AUTH", self.auth),
            mock.patch.object(server, "JOBS_DIR", self.tmp),
            # The second step has tests of its own (test_two_factor.py).
            mock.patch.object(server, "ADMIN_2FA", False),
            mock.patch.object(server.mailer, "send_new_account",
                              lambda account, admins, **kwargs: self.mails.append((account, list(admins)))),
        ):
            patch.start()
            self.addCleanup(patch.stop)
        self.auth.ensure_admin("admin", PASSWORD)
        self.auth.update_user("admin", email="boss@example.org")
        self.auth.register("alice", PASSWORD, "alice@example.org")
        self.auth.approve_user("alice")
        self.auth.register("bob", PASSWORD, "bob@example.org")
        self.auth.set_plan_grant("alice", "pro")
        for job_id, owner, size in (("a" * 32, "alice", 1000), ("b" * 32, None, 0)):
            model_dir = self.tmp / job_id / "input"
            model_dir.mkdir(parents=True)
            (model_dir / "model.glb").write_bytes(b"x" * 300)
            server.write_owner(job_id, owner, "model.glb", size)

    def request(self, method, path, token=None, body=None):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(self.base + path, data=data, method=method)
        if token:
            req.add_header("Authorization", f"Bearer {token}")
        if data:
            req.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(req) as response:
                return response.status, json.loads(response.read())
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read())

    def test_registration_tells_the_admins(self):
        status, _ = self.request("POST", "/api/auth/register", body={
            "username": "carol", "password": PASSWORD, "email": " carol@example.org "})
        self.assertEqual(status, 201)
        self.assertEqual(self.mails, [(
            {"username": "carol", "status": "pending", "email": "carol@example.org"}, ["boss@example.org"])])

    def test_failed_registration_tells_nobody(self):
        status, _ = self.request("POST", "/api/auth/register", body={
            "username": "alice", "password": PASSWORD, "email": "x@example.org"})
        self.assertEqual(status, 409)
        self.assertEqual(self.mails, [])

    def test_stats_for_admins_only(self):
        status, _ = self.request("GET", "/api/admin/stats")
        self.assertEqual(status, 401)
        status, _ = self.request("GET", "/api/admin/stats", self.auth.issue_token("alice"))
        self.assertEqual(status, 403)

    def test_stats(self):
        status, body = self.request("GET", "/api/admin/stats", self.auth.issue_token("admin"))
        self.assertEqual(status, 200)
        users = sorted((u["role"], u["status"], u["plan"]) for u in body["users"])
        self.assertEqual(users, [("admin", "active", "free"), ("user", "active", "pro"), ("user", "pending", "free")])
        # No addresses; names only in the ten accounts using the most space.
        self.assertNotIn("example.org", json.dumps(body))
        self.assertNotIn("username", json.dumps({key: value for key, value in body.items() if key != "topStorage"}))
        self.assertEqual([entry["username"] for entry in body["topStorage"]], ["alice"])
        self.assertIn("percent", body["disk"])
        sizes = sorted((m["size"], m["storage"] >= 300, m["anonymous"]) for m in body["models"])
        # Without a recorded upload size, the space on disk.
        self.assertEqual(sizes[1], (1000, True, False))
        self.assertTrue(sizes[0][0] >= 300 and sizes[0][2])


class SignupRecipientsTest(unittest.TestCase):
    def test_recipients(self):
        with mock.patch.dict(os.environ, {"WORKER_SIGNUP_EMAIL": ""}):
            self.assertEqual(mailer.signup_recipients(["b@x.org", "", "a@x.org", "a@x.org"]), ["a@x.org", "b@x.org"])
        with mock.patch.dict(os.environ, {"WORKER_SIGNUP_EMAIL": "m@x.org, n@x.org"}):
            self.assertEqual(mailer.signup_recipients(["a@x.org"]), ["m@x.org", "n@x.org"])
        with mock.patch.dict(os.environ, {"WORKER_SIGNUP_EMAIL": "off"}):
            self.assertEqual(mailer.signup_recipients(["a@x.org"]), [])

    def test_message(self):
        sent = []
        env = {"WORKER_SMTP_HOST": "smtp.example.org", "WORKER_SMTP_FROM": "viewer@example.org",
               "WORKER_SIGNUP_EMAIL": "", "WORKER_PUBLIC_URL": "https://viewer.example.org"}
        with mock.patch.dict(os.environ, env), mock.patch.object(mailer, "_send", sent.append):
            mailer.send_new_account({"username": "carol", "email": "c@x.org", "status": "pending"},
                                    ["boss@example.org"], background=False)
        self.assertEqual(len(sent), 1)
        self.assertEqual(sent[0]["To"], "boss@example.org")
        self.assertIn("approval", sent[0]["Subject"])
        self.assertIn("https://viewer.example.org/exadmin/#users", sent[0].get_content())


if __name__ == "__main__":
    unittest.main()
