"""Tests of the admin pages' worker side: the navigation's counters
(GET /api/admin/summary), rejecting an account (POST
/api/admin/users/<u>/reject), the last activity of an account, the Models
list (GET /api/admin/models), the History (GET /api/admin/audit,
audit.py) and the disk warning and digest (admin_watch.py):

  python3 -m unittest discover -s worker/tests
"""

import json
import os
import sys
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest import mock

WORKER_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(WORKER_DIR))

import admin_watch  # noqa: E402
import auth as auth_module  # noqa: E402
from audit import AuditLog  # noqa: E402
from auth import AuthStore  # noqa: E402
from reports import ReportStore  # noqa: E402

server = None  # imported when the tests run, see test_account_and_reports.py

PASSWORD = "correct-horse"


class AdminPanelTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        global server
        os.environ.setdefault("WORKER_JOBS_DIR", tempfile.mkdtemp(prefix="panel-test-jobs-"))
        import server as worker_server
        server = worker_server
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        cls.base = f"http://127.0.0.1:{cls.httpd.server_address[1]}"
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="panel-test-"))
        self.auth = AuthStore(self.tmp / ".auth", mode="required", registration="approval", secret="test-secret")
        self.audit = AuditLog(self.tmp / ".audit")
        self.reports = ReportStore(self.tmp / ".reports", hide_threshold=2)
        self.rejections = []
        for patch in (
            mock.patch.object(server, "AUTH", self.auth),
            mock.patch.object(server, "AUDIT", self.audit),
            mock.patch.object(server, "REPORTS", self.reports),
            mock.patch.object(server, "JOBS_DIR", self.tmp),
            # The second step has tests of its own (test_two_factor.py).
            mock.patch.object(server, "ADMIN_2FA", False),
            mock.patch.object(server.mailer, "send_new_account", lambda *args, **kwargs: None),
            mock.patch.object(server.mailer, "send_account_rejected",
                              lambda *args, **kwargs: self.rejections.append(args)),
            mock.patch.object(server.cloudflare, "purge_paths_async", lambda *args, **kwargs: None),
        ):
            patch.start()
            self.addCleanup(patch.stop)
        self.auth.ensure_admin("admin", PASSWORD)
        self.auth.register("alice", PASSWORD, "alice@example.org")
        self.auth.approve_user("alice")
        self.auth.register("bob", PASSWORD, "bob@example.org")
        self.admin = self.auth.issue_token("admin")
        self.add_job("a" * 32, "alice", "house.ifc", 1000)
        self.add_job("b" * 32, "alice", "broken.obj", 50)
        server.record_failure("b" * 32, "No supported 3D model found in archive.")

    def add_job(self, job_id, owner, filename, size):
        model_dir = self.tmp / job_id / "input"
        model_dir.mkdir(parents=True)
        if not filename.startswith("broken"):
            (model_dir / "model.glb").write_bytes(b"x" * 300)
        else:
            (model_dir / filename).write_bytes(b"x" * 10)
        server.write_owner(job_id, owner, filename, size)

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

    # ---- counters -----------------------------------------------------------

    def test_summary(self):
        status, body = self.request("GET", "/api/admin/summary", self.admin)
        self.assertEqual(status, 200)
        self.assertEqual(body["pendingUsers"], 1)
        self.assertEqual(body["openReports"], 0)
        self.assertGreater(body["disk"]["total"], 0)
        status, _ = self.request("GET", "/api/admin/summary", self.auth.issue_token("alice"))
        self.assertEqual(status, 403)

    # ---- rejecting -------------------------------------------------------------

    def test_reject_pending_account(self):
        status, body = self.request("POST", "/api/admin/users/bob/reject", self.admin, {"reason": "Spam"})
        self.assertEqual(status, 200)
        self.assertNotIn("bob", {u["username"] for u in self.auth.list_users()})
        self.assertEqual(self.rejections, [("bob", "bob@example.org", "Spam")])
        entry = self.audit.entries(1)[0]
        self.assertEqual((entry["admin"], entry["action"], entry["target"], entry["details"]),
                         ("admin", "reject", "bob", {"reason": "Spam"}))

    def test_active_account_cannot_be_rejected(self):
        status, _ = self.request("POST", "/api/admin/users/alice/reject", self.admin, {"reason": ""})
        self.assertEqual(status, 409)
        self.assertIn("alice", {u["username"] for u in self.auth.list_users()})

    # ---- last activity ------------------------------------------------------

    def test_login_and_activity_are_recorded(self):
        self.auth.login("alice", PASSWORD)
        record = next(u for u in self.auth.list_users() if u["username"] == "alice")
        self.assertAlmostEqual(record["lastLoginAt"], time.time(), delta=5)
        # Written again only after SEEN_INTERVAL.
        token = self.auth.issue_token("alice")
        with mock.patch.object(auth_module.time, "time", return_value=time.time() + auth_module.SEEN_INTERVAL + 5):
            self.auth.user_from_token(token)
        later = next(u for u in self.auth.list_users() if u["username"] == "alice")
        self.assertGreater(later["lastSeenAt"], record["lastSeenAt"])
        self.assertEqual(later["lastLoginAt"], record["lastLoginAt"])

    # ---- models -------------------------------------------------------------------

    def test_models(self):
        status, body = self.request("GET", "/api/admin/models", self.admin)
        self.assertEqual(status, 200)
        models = {m["id"]: m for m in body["models"]}
        ready, broken = models["a" * 32], models["b" * 32]
        self.assertEqual((ready["state"], ready["format"], ready["owner"], ready["size"]), ("ready", "ifc", "alice", 1000))
        self.assertGreaterEqual(ready["storage"], 300)
        self.assertEqual(broken["state"], "failed")
        self.assertIn("No supported", broken["error"])
        self.assertEqual(body["queue"], [])

    def test_admin_deleting_a_model_is_recorded(self):
        status, _ = self.request("DELETE", f"/api/jobs/{'a' * 32}", self.admin)
        self.assertEqual(status, 200)
        entry = self.audit.entries(1)[0]
        self.assertEqual((entry["action"], entry["target"], entry["details"]["owner"]), ("delete-model", "a" * 32, "alice"))

    # ---- history --------------------------------------------------------------------

    def test_audit_endpoint(self):
        self.request("POST", "/api/admin/users/bob/approve", self.admin)
        self.request("POST", "/api/admin/users/alice/plan", self.admin, {"tier": "pro", "expiresAt": None})
        status, body = self.request("GET", "/api/admin/audit?limit=1", self.admin)
        self.assertEqual(status, 200)
        self.assertEqual([e["action"] for e in body["entries"]], ["plan"])
        self.assertTrue(body["more"])
        status, body = self.request("GET", "/api/admin/audit?action=approve", self.admin)
        self.assertEqual([(e["action"], e["target"]) for e in body["entries"]], [("approve", "bob")])
        status, _ = self.request("GET", "/api/admin/audit", self.auth.issue_token("alice"))
        self.assertEqual(status, 403)

    def test_audit_paging(self):
        log = AuditLog(self.tmp / "paging")
        with mock.patch("audit.time.time", side_effect=[100, 200, 300]):
            for target in ("a", "b", "c"):
                log.record("admin", "approve", target)
        self.assertEqual([e["target"] for e in log.entries(2)], ["c", "b"])
        self.assertEqual([e["target"] for e in log.entries(2, before=200)], ["a"])

    # ---- digest ----------------------------------------------------------------------

    def test_digest_numbers(self):
        digest = server.admin_digest(time.time() - 3600, time.time() + 1)
        self.assertEqual({a["username"] for a in digest["newAccounts"]}, {"admin", "alice", "bob"})
        self.assertEqual((digest["pending"], digest["uploads"], digest["uploadedBytes"], digest["failed"]), (1, 2, 1050, 1))


class AdminWatchTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="watch-test-"))
        self.mailer = mock.Mock()
        self.mailer.enabled.return_value = True
        self.digests = []
        self.watch = admin_watch.AdminWatch(self.tmp / ".admin", self.tmp, lambda: ["boss@example.org"], self.mailer,
                                            lambda since, now: self.digests.append((since, now)) or {"since": since})

    def full_disk(self, percent):
        total = 1000
        return mock.patch.object(admin_watch.shutil, "disk_usage",
                                 return_value=mock.Mock(total=total, used=percent * 10, free=total - percent * 10))

    def test_disk_warning_once_a_day(self):
        with self.full_disk(90), mock.patch.dict(os.environ, {"WORKER_DISK_WARN_PERCENT": "85", "WORKER_ADMIN_DIGEST": "off"}):
            self.watch.check(now=1000)
            self.watch.check(now=2000)
            self.assertEqual(self.mailer.send_disk_warning.call_count, 1)
            self.watch.check(now=1000 + admin_watch.DISK_WARNING_REPEAT)
            self.assertEqual(self.mailer.send_disk_warning.call_count, 2)
        with self.full_disk(50), mock.patch.dict(os.environ, {"WORKER_DISK_WARN_PERCENT": "85"}):
            self.watch.check(now=10 ** 7)
            self.assertEqual(self.mailer.send_disk_warning.call_count, 2)

    def test_disk_warning_off(self):
        with self.full_disk(99), mock.patch.dict(os.environ, {"WORKER_DISK_WARN_PERCENT": "0"}):
            self.watch.check(now=1000)
        self.mailer.send_disk_warning.assert_not_called()

    def test_daily_digest(self):
        day = time.mktime((2026, 11, 16, 6, 0, 0, 0, 0, -1))
        with self.full_disk(10), mock.patch.dict(os.environ, {"WORKER_ADMIN_DIGEST": "daily", "WORKER_ADMIN_DIGEST_HOUR": "8"}):
            self.watch.check(now=day)  # notes the day, sends nothing
            self.watch.check(now=day + 3 * 3600)  # same day
            self.assertEqual(self.digests, [])
            self.watch.check(now=day + 24 * 3600)  # next day, 6:00 - before the hour
            self.assertEqual(self.digests, [])
            self.watch.check(now=day + 26 * 3600)  # next day, 8:00
            self.watch.check(now=day + 27 * 3600)
        self.assertEqual(self.digests, [(int(day), day + 26 * 3600)])
        self.assertEqual(self.mailer.send_admin_digest.call_count, 1)

    def test_weekly_digest(self):
        monday = time.mktime((2026, 11, 16, 9, 0, 0, 0, 0, -1))
        with self.full_disk(10), mock.patch.dict(os.environ, {"WORKER_ADMIN_DIGEST": "weekly"}):
            self.watch.check(now=monday)
            for day in range(1, 7):
                self.watch.check(now=monday + day * 86400)
            self.assertEqual(self.digests, [])
            self.watch.check(now=monday + 7 * 86400)
        self.assertEqual(len(self.digests), 1)


if __name__ == "__main__":
    unittest.main()
