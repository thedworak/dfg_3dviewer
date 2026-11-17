"""Tests of Cloudflare Turnstile in front of logging in, registering,
resetting a password and an administrator's second step (turnstile.py,
server.py _turnstile_ok); Cloudflare itself is not called:

  python3 -m unittest discover -s worker/tests
"""

import io
import json
import os
import sys
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.parse
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest import mock

WORKER_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(WORKER_DIR))

import totp  # noqa: E402
import turnstile  # noqa: E402
from audit import AuditLog  # noqa: E402
from auth import AuthStore  # noqa: E402

server = None  # imported when the tests run, see test_account_and_reports.py

PASSWORD = "correct-horse"
KEYS = {"WORKER_TURNSTILE_SITE_KEY": "site-key", "WORKER_TURNSTILE_SECRET": "secret-key"}


class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


class VerifyTest(unittest.TestCase):
    def test_off_without_both_keys(self):
        with mock.patch.dict(os.environ, {"WORKER_TURNSTILE_SITE_KEY": "x", "WORKER_TURNSTILE_SECRET": ""}):
            self.assertFalse(turnstile.enabled())
            self.assertIsNone(turnstile.public_config())
            self.assertFalse(turnstile.protects("login"))

    def test_config_and_protect_list(self):
        with mock.patch.dict(os.environ, {**KEYS, "WORKER_TURNSTILE_PROTECT": "register, login,bogus"}):
            self.assertEqual(turnstile.public_config(), {"siteKey": "site-key", "actions": ["register", "login"]})
            self.assertFalse(turnstile.protects("2fa"))

    def test_verify_posts_the_token(self):
        sent = []

        def fake_urlopen(request, timeout):
            sent.append((request.full_url, urllib.parse.parse_qs(request.data.decode())))
            return FakeResponse(json.dumps({"success": True}).encode())

        with mock.patch.dict(os.environ, KEYS), mock.patch.object(turnstile.urllib.request, "urlopen", fake_urlopen):
            self.assertEqual(turnstile.verify("tok", "203.0.113.5"), (True, []))
        url, fields = sent[0]
        self.assertEqual(url, turnstile.VERIFY_URL)
        self.assertEqual(fields, {"secret": ["secret-key"], "response": ["tok"], "remoteip": ["203.0.113.5"]})

    def test_verify_failures(self):
        with mock.patch.dict(os.environ, KEYS):
            self.assertEqual(turnstile.verify(""), (False, ["missing-input-response"]))
            self.assertEqual(turnstile.verify("x" * 3000), (False, ["invalid-input-response"]))
            refused = FakeResponse(json.dumps({"success": False, "error-codes": ["timeout-or-duplicate"]}).encode())
            with mock.patch.object(turnstile.urllib.request, "urlopen", lambda *a, **k: refused):
                self.assertEqual(turnstile.verify("tok"), (False, ["timeout-or-duplicate"]))
            with mock.patch.object(turnstile.urllib.request, "urlopen", side_effect=urllib.error.URLError("down")):
                self.assertEqual(turnstile.verify("tok"), (False, ["verification-unavailable"]))


class TurnstileEndpointsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        global server
        os.environ.setdefault("WORKER_JOBS_DIR", tempfile.mkdtemp(prefix="turnstile-test-jobs-"))
        import server as worker_server
        server = worker_server
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        cls.base = f"http://127.0.0.1:{cls.httpd.server_address[1]}"
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="turnstile-test-"))
        self.auth = AuthStore(self.tmp / ".auth", mode="required", registration="open", secret="test-secret")
        self.checked = []

        def fake_verify(token, remote_ip="", timeout=10.0):
            self.checked.append(token)
            if token == "down":
                return False, ["verification-unavailable"]
            return (token == "good"), ([] if token == "good" else ["invalid-input-response"])

        for patch in (
            mock.patch.object(server, "AUTH", self.auth),
            mock.patch.object(server, "AUDIT", AuditLog(self.tmp / ".audit")),
            mock.patch.object(server, "JOBS_DIR", self.tmp),
            mock.patch.object(server, "ADMIN_2FA", True),
            mock.patch.object(server.turnstile, "verify", fake_verify),
            mock.patch.object(server.mailer, "send_new_account", lambda *args, **kwargs: None),
            mock.patch.dict(os.environ, KEYS),
        ):
            patch.start()
            self.addCleanup(patch.stop)
        self.auth.register("alice", PASSWORD, "alice@example.org")

    def request(self, method, path, body=None, token=None):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(self.base + path, data=data, method=method)
        if data:
            req.add_header("Content-Type", "application/json")
        if token:
            req.add_header("Authorization", f"Bearer {token}")
        try:
            with urllib.request.urlopen(req) as response:
                return response.status, json.loads(response.read())
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read())

    def test_config_names_the_site_key(self):
        status, body = self.request("GET", "/api/auth/config")
        self.assertEqual(body["turnstile"]["siteKey"], "site-key")
        self.assertIn("login", body["turnstile"]["actions"])

    def test_login(self):
        status, body = self.request("POST", "/api/auth/login", {"username": "alice", "password": PASSWORD})
        self.assertEqual((status, body["code"]), (403, "turnstile_failed"))
        status, body = self.request("POST", "/api/auth/login", {"username": "alice", "password": PASSWORD, "turnstileToken": "bad"})
        self.assertEqual(status, 403)
        status, body = self.request("POST", "/api/auth/login", {"username": "alice", "password": PASSWORD, "turnstileToken": "good"})
        self.assertEqual((status, body["username"]), (200, "alice"))

    def test_the_check_comes_before_the_password(self):
        # A wrong password without the check is not counted (no lockout from bots).
        for _ in range(6):
            self.request("POST", "/api/auth/login", {"username": "alice", "password": "wrong-one"})
        status, _ = self.request("POST", "/api/auth/login", {"username": "alice", "password": PASSWORD, "turnstileToken": "good"})
        self.assertEqual(status, 200)

    def test_cloudflare_down(self):
        status, body = self.request("POST", "/api/auth/login", {"username": "alice", "password": PASSWORD, "turnstileToken": "down"})
        self.assertEqual((status, body["code"]), (503, "turnstile_failed"))

    def test_register_and_forgot_password(self):
        new = {"username": "bob", "password": PASSWORD, "email": "bob@example.org"}
        self.assertEqual(self.request("POST", "/api/auth/register", new)[0], 403)
        self.assertEqual(self.request("POST", "/api/auth/register", {**new, "turnstileToken": "good"})[0], 201)
        self.assertEqual(self.request("POST", "/api/auth/forgot-password", {"identifier": "bob"})[0], 403)

    def test_only_the_listed_actions(self):
        with mock.patch.dict(os.environ, {"WORKER_TURNSTILE_PROTECT": "register"}):
            status, _ = self.request("POST", "/api/auth/login", {"username": "alice", "password": PASSWORD})
        self.assertEqual(status, 200)
        self.assertEqual(self.checked, [])

    def test_second_step(self):
        self.auth.ensure_admin("admin", PASSWORD)
        token = self.auth.issue_token("admin")
        status, setup = self.request("POST", "/api/auth/2fa/setup", {}, token)
        self.assertEqual(status, 200)
        code = totp.code_at(setup["secret"], int(time.time() // 30))
        status, body = self.request("POST", "/api/auth/2fa/enable", {"code": code}, token)
        self.assertEqual((status, body["code"]), (403, "turnstile_failed"))
        status, _ = self.request("POST", "/api/auth/2fa/enable", {"code": code, "turnstileToken": "good"}, token)
        self.assertEqual(status, 200)


if __name__ == "__main__":
    unittest.main()
