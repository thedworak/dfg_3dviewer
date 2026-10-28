"""Tests of a model's metadata (model_metadata.py): validated, stored by its
owner or an admin (POST /api/jobs/<id>/metadata), handed out with
GET /api/jobs and GET /api/jobs/<id>/metadata:

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
os.environ.setdefault("WORKER_JOBS_DIR", tempfile.mkdtemp(prefix="metadata-test-jobs-"))

import model_metadata  # noqa: E402
import server  # noqa: E402
from http.server import ThreadingHTTPServer  # noqa: E402

USERS = {
    "alice": {"username": "alice", "role": "user"},
    "bob": {"username": "bob", "role": "user"},
    "admin": {"username": "admin", "role": "admin"},
}
JOB = "m" * 32
PRIVATE_JOB = "n" * 32
VALID = {"name": "Kościół w Woli", "type": "building", "license": "CC-BY-4.0", "date": "XVIII w."}


class ValidateTest(unittest.TestCase):
    def test_required_fields(self):
        with self.assertRaisesRegex(model_metadata.MetadataError, "name"):
            model_metadata.validate({"type": "building"})
        with self.assertRaisesRegex(model_metadata.MetadataError, "type"):
            model_metadata.validate({"name": "A"})
        with self.assertRaisesRegex(model_metadata.MetadataError, "name"):
            model_metadata.validate({"name": "   ", "type": "building"})

    def test_choices_and_lengths(self):
        with self.assertRaisesRegex(model_metadata.MetadataError, "type"):
            model_metadata.validate({"name": "A", "type": "spaceship"})
        with self.assertRaisesRegex(model_metadata.MetadataError, "license"):
            model_metadata.validate({"name": "A", "type": "object", "license": "GPL"})
        with self.assertRaisesRegex(model_metadata.MetadataError, "author"):
            model_metadata.validate({"name": "A", "type": "object", "author": "x" * 201})
        with self.assertRaisesRegex(model_metadata.MetadataError, "date"):
            model_metadata.validate({"name": "A", "type": "object", "date": 1890})

    def test_cleaned(self):
        clean = model_metadata.validate({
            "name": "  Wola \n Justowska ", "type": "site", "description": "Line one\r\nLine  two ",
            "unknown": "dropped",
        })
        self.assertEqual(clean["name"], "Wola Justowska")
        self.assertEqual(clean["description"], "Line one\nLine two")
        self.assertEqual(clean["author"], "")
        self.assertEqual(clean["license"], "")
        self.assertNotIn("unknown", clean)
        self.assertEqual(set(clean), set(model_metadata.FIELDS))


class MetadataEndpointsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        cls.base = f"http://127.0.0.1:{cls.httpd.server_address[1]}"
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()

    def setUp(self):
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
        for job_id, private in ((JOB, False), (PRIVATE_JOB, True)):
            model_dir = server.JOBS_DIR / job_id / "input"
            model_dir.mkdir(parents=True, exist_ok=True)
            (model_dir / "model.glb").write_bytes(b"glTF")
            server.write_owner(job_id, "alice", "model.glb", 4, private=private)
            model_metadata.path(server.JOBS_DIR / job_id).unlink(missing_ok=True)

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

    def test_owner_saves_and_everyone_reads(self):
        status, body = self.request("POST", f"/api/jobs/{JOB}/metadata", "alice", VALID)
        self.assertEqual(status, 200)
        self.assertEqual(body["metadata"]["name"], "Kościół w Woli")
        self.assertEqual(body["metadata"]["updatedBy"], "alice")

        status, body = self.request("GET", f"/api/jobs/{JOB}/metadata")
        self.assertEqual(status, 200)
        self.assertEqual(body["metadata"]["type"], "building")
        self.assertFalse(body["canEdit"])
        self.assertTrue(self.request("GET", f"/api/jobs/{JOB}/metadata", "alice")[1]["canEdit"])

        status, body = self.request("GET", "/api/jobs")
        listed = {job["id"]: job for job in body["jobs"]}
        self.assertEqual(listed[JOB]["metadata"]["license"], "CC-BY-4.0")

    def test_only_owner_or_admin_edits(self):
        self.assertEqual(self.request("POST", f"/api/jobs/{JOB}/metadata", None, VALID)[0], 401)
        self.assertEqual(self.request("POST", f"/api/jobs/{JOB}/metadata", "bob", VALID)[0], 403)
        self.assertEqual(self.request("POST", f"/api/jobs/{JOB}/metadata", "admin", VALID)[0], 200)

    def test_invalid_metadata_refused(self):
        status, body = self.request("POST", f"/api/jobs/{JOB}/metadata", "alice", {"name": "A"})
        self.assertEqual(status, 400)
        self.assertIn("type", body["error"])
        self.assertIsNone(self.request("GET", f"/api/jobs/{JOB}/metadata")[1]["metadata"])

    def test_private_model_hidden(self):
        self.request("POST", f"/api/jobs/{PRIVATE_JOB}/metadata", "alice", VALID)
        self.assertEqual(self.request("GET", f"/api/jobs/{PRIVATE_JOB}/metadata", "bob")[0], 404)
        self.assertEqual(self.request("GET", f"/api/jobs/{PRIVATE_JOB}/metadata", "alice")[0], 200)

    def test_unknown_job(self):
        self.assertEqual(self.request("GET", "/api/jobs/nope/metadata")[0], 404)
        self.assertEqual(self.request("POST", "/api/jobs/nope/metadata", "alice", VALID)[0], 404)


if __name__ == "__main__":
    unittest.main()
