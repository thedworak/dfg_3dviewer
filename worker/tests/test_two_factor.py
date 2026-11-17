"""Tests of an administrator's second step for the admin pages
(totp.py, auth.py two_factor_*, server.py _admin_second_step_ok and
POST /api/auth/2fa/setup|enable|verify):

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

import totp  # noqa: E402
from audit import AuditLog  # noqa: E402
from auth import AuthError, AuthStore  # noqa: E402

server = None  # imported when the tests run, see test_account_and_reports.py

PASSWORD = "correct-horse"


class TotpTest(unittest.TestCase):
    def test_rfc6238_vector(self):
        # RFC 6238 appendix B, SHA1, secret "12345678901234567890", T = 59 s.
        secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
        self.assertEqual(totp.code_at(secret, 59 // 30), "287082")
        self.assertEqual(totp.code_at(secret, 1111111109 // 30), "081804")

    def test_window_and_reuse(self):
        secret = totp.new_secret()
        now = 1_800_000_000
        step = int(now // 30)
        self.assertEqual(totp.matching_step(secret, totp.code_at(secret, step - 1), now), step - 1)
        self.assertIsNone(totp.matching_step(secret, totp.code_at(secret, step - 2), now))
        self.assertIsNone(totp.matching_step(secret, totp.code_at(secret, step), now, after=step))
        self.assertIsNone(totp.matching_step(secret, "12345", now))
        code = totp.code_at(secret, step)
        self.assertEqual(totp.matching_step(secret, f"{code[:3]} {code[3:]}", now), step)

    def test_uri(self):
        uri = totp.provisioning_uri("ABC", "anna", "ExPlora4D")
        self.assertTrue(uri.startswith("otpauth://totp/ExPlora4D%3Aanna?secret=ABC&issuer=ExPlora4D"))


class TwoFactorTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        global server
        os.environ.setdefault("WORKER_JOBS_DIR", tempfile.mkdtemp(prefix="twofactor-test-jobs-"))
        import server as worker_server
        server = worker_server
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        cls.base = f"http://127.0.0.1:{cls.httpd.server_address[1]}"
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="twofactor-test-"))
        self.auth = AuthStore(self.tmp / ".auth", mode="required", registration="open", secret="test-secret")
        self.audit = AuditLog(self.tmp / ".audit")
        for patch in (
            mock.patch.object(server, "AUTH", self.auth),
            mock.patch.object(server, "AUDIT", self.audit),
            mock.patch.object(server, "JOBS_DIR", self.tmp),
            mock.patch.object(server, "ADMIN_2FA", True),
        ):
            patch.start()
            self.addCleanup(patch.stop)
        self.auth.ensure_admin("admin", PASSWORD)
        self.auth.register("alice", PASSWORD, "alice@example.org")
        self.token = self.auth.issue_token("admin")

    def request(self, method, path, token=None, body=None, headers=None):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(self.base + path, data=data, method=method)
        if token:
            req.add_header("Authorization", f"Bearer {token}")
        for name, value in (headers or {}).items():
            req.add_header(name, value)
        if data:
            req.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(req) as response:
                return response.status, json.loads(response.read()), response.headers
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read()), error.headers

    def enable(self):
        status, body, _ = self.request("POST", "/api/auth/2fa/setup", self.token, {})
        self.assertEqual(status, 200)
        self.assertIn("otpauth://totp/", body["uri"])
        secret = body["secret"]
        code = totp.code_at(secret, int(time.time() // 30))
        status, body, headers = self.request("POST", "/api/auth/2fa/enable", self.token, {"code": code, "session": "token"})
        self.assertEqual(status, 200)
        self.assertEqual(len(body["recoveryCodes"]), 8)
        self.assertIn("dfg3d_session=", headers.get("Set-Cookie", ""))
        return secret, body

    def test_admin_pages_ask_for_setup_then_code(self):
        status, body, _ = self.request("GET", "/api/admin/users", self.token)
        self.assertEqual((status, body["code"]), (403, "2fa_setup_required"))
        status, me, _ = self.request("GET", "/api/auth/me", self.token)
        self.assertEqual(me["twoFactor"]["state"], "setup")

        secret, enabled = self.enable()
        # The session from enable passed the second step.
        status, _, _ = self.request("GET", "/api/admin/users", enabled["token"])
        self.assertEqual(status, 200)
        # The old one did not.
        status, body, _ = self.request("GET", "/api/admin/users", self.token)
        self.assertEqual((status, body["code"]), (403, "2fa_required"))

        # A used code is refused; the next step's code is accepted.
        next_code = totp.code_at(secret, int(time.time() // 30) + 1)
        status, verified, _ = self.request("POST", "/api/auth/2fa/verify", self.token, {"code": next_code, "session": "token"})
        self.assertEqual(status, 200)
        status, _, _ = self.request("GET", "/api/admin/summary", verified["token"])
        self.assertEqual(status, 200)
        status, _, _ = self.request("POST", "/api/auth/2fa/verify", self.token, {"code": next_code})
        self.assertEqual(status, 401)

    def test_second_step_expires(self):
        _, enabled = self.enable()
        with mock.patch.object(server, "ADMIN_2FA_TTL", -1):
            status, body, _ = self.request("GET", "/api/admin/users", enabled["token"])
        self.assertEqual((status, body["code"]), (403, "2fa_required"))

    def test_recovery_code_is_used_once(self):
        _, enabled = self.enable()
        recovery = enabled["recoveryCodes"][0]
        status, body, _ = self.request("POST", "/api/auth/2fa/verify", self.token, {"code": recovery.upper(), "session": "token"})
        self.assertEqual((status, body["recoveryLeft"]), (200, 7))
        status, _, _ = self.request("POST", "/api/auth/2fa/verify", self.token, {"code": recovery})
        self.assertEqual(status, 401)

    def test_wrong_codes_lock_out(self):
        self.enable()
        for _ in range(5):
            status, _, _ = self.request("POST", "/api/auth/2fa/verify", self.token, {"code": "000000"})
        status, _, _ = self.request("POST", "/api/auth/2fa/verify", self.token, {"code": "000000"})
        self.assertEqual(status, 429)

    def test_reset_ends_sessions_and_asks_for_setup(self):
        _, enabled = self.enable()
        self.auth.two_factor_reset("admin")
        status, body, _ = self.request("GET", "/api/admin/users", enabled["token"])
        self.assertEqual((status, body["code"]), (403, "2fa_setup_required"))

    def test_another_admin_resets(self):
        self.auth.ensure_admin("boss", PASSWORD)
        self.auth.two_factor_setup("boss", "x")
        secret = self.auth._load()["boss"]["totpPending"]["secret"]
        self.auth.two_factor_enable("boss", totp.code_at(secret, int(time.time() // 30)))
        _, enabled = self.enable()
        status, _, _ = self.request("POST", "/api/admin/users/boss/2fa-reset", enabled["token"], {})
        self.assertEqual(status, 200)
        self.assertFalse(self.auth.two_factor_status("boss")["enabled"])
        self.assertEqual(self.audit.entries(1)[0]["action"], "2fa-reset")

    def test_not_for_users_and_not_twice(self):
        status, _, _ = self.request("POST", "/api/auth/2fa/setup", self.auth.issue_token("alice"), {})
        self.assertEqual(status, 403)
        self.enable()
        with self.assertRaises(AuthError):
            self.auth.two_factor_setup("admin", "x")

    def test_the_viewer_is_not_asked(self):
        # Outside /api/admin/* an admin works as before.
        status, _, _ = self.request("GET", "/api/jobs", self.token)
        self.assertEqual(status, 200)

    # ---- remembered devices -------------------------------------------------

    def remember(self, secret):
        code = totp.code_at(secret, int(time.time() // 30) + 1)
        status, body, headers = self.request("POST", "/api/auth/2fa/verify", self.token,
                                             {"code": code, "remember": True, "session": "token"})
        self.assertEqual(status, 200)
        cookies = headers.get_all("Set-Cookie")
        self.assertTrue(any(c.startswith("dfg3d_admin_device=") and "HttpOnly" in c and "SameSite=Strict" in c
                            for c in cookies))
        return body["deviceToken"]

    def test_remembered_device_skips_the_code(self):
        secret, _ = self.enable()
        device = self.remember(secret)
        fresh = self.auth.issue_token("admin")  # a new login, no code given
        status, body, _ = self.request("GET", "/api/admin/users", fresh)
        self.assertEqual((status, body["code"]), (403, "2fa_required"))
        status, _, _ = self.request("GET", "/api/admin/users", fresh, headers={"X-Admin-Device": device})
        self.assertEqual(status, 200)
        status, _, _ = self.request("GET", "/api/admin/users", fresh, headers={"Cookie": f"dfg3d_admin_device={device}"})
        self.assertEqual(status, 200)
        status, me, _ = self.request("GET", "/api/auth/me", fresh, headers={"X-Admin-Device": device})
        self.assertEqual((me["twoFactor"]["state"], me["twoFactor"]["remembered"], me["twoFactor"]["rememberDays"]),
                         ("ok", True, 30))

    def test_remembered_device_is_not_a_session_nor_anothers(self):
        secret, _ = self.enable()
        device = self.remember(secret)
        status, me, _ = self.request("GET", "/api/auth/me", device)
        self.assertIsNone(me["user"])
        self.assertFalse(self.auth.device_remembered("alice", device))

    def test_forgetting_and_resetting_end_remembered_devices(self):
        secret, _ = self.enable()
        device = self.remember(secret)
        status, _, headers = self.request("POST", "/api/auth/2fa/forget-devices", self.token, {})
        self.assertEqual(status, 200)
        self.assertIn("Max-Age=0", headers.get("Set-Cookie"))
        self.assertFalse(self.auth.device_remembered("admin", device))
        self.assertEqual(self.audit.entries(1)[0]["action"], "2fa-forget-devices")
        # A reset (lost phone) forgets them too.
        secret2, _ = self.enable_again()
        device = self.remember(secret2)
        self.auth.two_factor_reset("admin")
        self.assertFalse(self.auth.device_remembered("admin", device))

    def enable_again(self):
        self.auth.two_factor_reset("admin")
        time.sleep(1.1)  # a device remembered before the new setup must not count
        return self.enable()

    def test_remembering_off(self):
        secret, _ = self.enable()
        device = self.remember(secret)
        with mock.patch.object(server, "ADMIN_2FA_REMEMBER_DAYS", 0):
            fresh = self.auth.issue_token("admin")
            status, _, _ = self.request("GET", "/api/admin/users", fresh, headers={"X-Admin-Device": device})
        self.assertEqual(status, 403)

    def test_off(self):
        with mock.patch.object(server, "ADMIN_2FA", False):
            status, _, _ = self.request("GET", "/api/admin/users", self.token)
        self.assertEqual(status, 200)


if __name__ == "__main__":
    unittest.main()
