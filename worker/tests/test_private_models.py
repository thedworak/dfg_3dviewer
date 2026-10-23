"""Tests of private models: left out of GET /api/jobs for everyone but their
owner and admins, switched by POST /api/jobs/<id>/visibility:

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
from types import SimpleNamespace
from unittest import mock

WORKER_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(WORKER_DIR))
os.environ.setdefault("WORKER_JOBS_DIR", tempfile.mkdtemp(prefix="private-test-jobs-"))

import server  # noqa: E402
from http.server import ThreadingHTTPServer  # noqa: E402

USERS = {
    "alice": {"username": "alice", "role": "user"},
    "bob": {"username": "bob", "role": "user"},
    "admin": {"username": "admin", "role": "admin"},
}
PRIVATE_JOB = "p" * 32
PUBLIC_JOB = "q" * 32


class PrivateModelsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        cls.base = f"http://127.0.0.1:{cls.httpd.server_address[1]}"
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()

    def setUp(self):
        # Accounts on; the caller named by an X-Test-User header.
        auth = SimpleNamespace(enabled=True, list_users=lambda: list(USERS.values()))
        patches = [
            mock.patch.object(server, "AUTH", auth),
            mock.patch.object(
                server.Handler, "_current_user",
                lambda handler: USERS.get(handler.headers.get("X-Test-User", "")),
            ),
        ]
        for patch in patches:
            patch.start()
            self.addCleanup(patch.stop)
        for job_id, private in ((PRIVATE_JOB, True), (PUBLIC_JOB, False)):
            model_dir = server.JOBS_DIR / job_id / "input"
            model_dir.mkdir(parents=True, exist_ok=True)
            (model_dir / "model.glb").write_bytes(b"glTF")
            server.write_owner(job_id, "alice", "model.glb", 4, private=private)

    def request(self, method, path, user=None, body=None):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(self.base + path, data=data, method=method)
        if user:
            req.add_header("X-Test-User", user)
        if data:
            req.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(req) as response:
                return response.status, json.loads(response.read())
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read())

    def listed(self, user=None):
        status, body = self.request("GET", "/api/jobs", user)
        self.assertEqual(status, 200)
        return {job["id"]: job["private"] for job in body["jobs"] if job["id"] in (PRIVATE_JOB, PUBLIC_JOB)}

    def test_private_listed_only_to_its_owner_and_admins(self):
        self.assertEqual(self.listed(), {PUBLIC_JOB: False})
        self.assertEqual(self.listed("bob"), {PUBLIC_JOB: False})
        self.assertEqual(self.listed("alice"), {PRIVATE_JOB: True, PUBLIC_JOB: False})
        self.assertEqual(self.listed("admin"), {PRIVATE_JOB: True, PUBLIC_JOB: False})

    def test_switched_by_its_owner_or_an_admin(self):
        path = f"/api/jobs/{PUBLIC_JOB}/visibility"
        self.assertEqual(self.request("POST", path, None, {"private": True})[0], 401)
        self.assertEqual(self.request("POST", path, "bob", {"private": True})[0], 403)
        self.assertEqual(self.request("POST", path, "alice", {"private": "yes"})[0], 400)
        self.assertEqual(self.request("POST", path, "alice", {"private": True}), (200, {"status": "ok", "private": True}))
        self.assertNotIn(PUBLIC_JOB, self.listed("bob"))
        self.assertEqual(self.request("POST", path, "admin", {"private": False})[0], 200)
        self.assertIn(PUBLIC_JOB, self.listed("bob"))

    def test_an_anonymous_upload_cannot_be_private(self):
        server.write_owner(PUBLIC_JOB, None, "model.glb", 4, private=True)
        self.assertEqual(self.listed("bob"), {PUBLIC_JOB: False})
        path = f"/api/jobs/{PUBLIC_JOB}/visibility"
        self.assertEqual(self.request("POST", path, "admin", {"private": True})[0], 400)


if __name__ == "__main__":
    unittest.main()
