"""Tests of the viewer's saved settings (POST /api/model/settings):

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

WORKER_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(WORKER_DIR))
os.environ.setdefault("WORKER_JOBS_DIR", tempfile.mkdtemp(prefix="settings-test-jobs-"))

import server  # noqa: E402
from http.server import ThreadingHTTPServer  # noqa: E402

JOB = "c" * 32


class SettingsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        cls.base = f"http://127.0.0.1:{cls.httpd.server_address[1]}"
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()
        cls.model_dir = server.JOBS_DIR / JOB / "input" / "parts"
        cls.model_dir.mkdir(parents=True, exist_ok=True)
        (cls.model_dir / "Church model.glb").write_bytes(b"glTF")

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()

    def post(self, body):
        req = urllib.request.Request(
            self.base + "/api/model/settings", data=json.dumps(body).encode(),
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req) as response:
                return response.status, json.loads(response.read())
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read())

    def test_saved_next_to_the_model_and_served_fresh(self):
        settings = {"objPosition": [1, 2, 3], "cameraPosition": [0, 5, 10]}
        status, body = self.post({"path": f"/files/{JOB}/parts/", "filename": "Church model.glb", "content": settings})
        self.assertEqual(status, 200)
        saved = self.model_dir / "metadata" / "Church model.glb_viewer.json"
        self.assertEqual(json.loads(saved.read_text("utf-8")), settings)
        self.assertEqual(body["url"], f"/files/{JOB}/parts/metadata/Church model.glb_viewer.json")
        # Again, as a string (the Drupal module's form): replaced in place.
        status, _ = self.post({"path": f"http://host/files/{JOB}/parts/", "filename": "Church model.glb", "content": json.dumps({"objScale": [2, 2, 2]})})
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(saved.read_text("utf-8")), {"objScale": [2, 2, 2]})
        with urllib.request.urlopen(self.base + urllib.request.quote(body["url"])) as response:
            self.assertEqual(response.headers["Cache-Control"], "no-cache")
            self.assertEqual(json.loads(response.read()), {"objScale": [2, 2, 2]})

    def test_rejected(self):
        ok = {"path": f"/files/{JOB}/parts/", "filename": "Church model.glb", "content": {}}
        self.assertEqual(self.post({**ok, "path": "/examples/"})[0], 400)
        self.assertEqual(self.post({**ok, "path": f"/files/{JOB}/../../"})[0], 404)
        self.assertEqual(self.post({**ok, "filename": "../Church model.glb"})[0], 400)
        self.assertEqual(self.post({**ok, "filename": "other.glb"})[0], 404)
        self.assertEqual(self.post({**ok, "content": "[1, 2]"})[0], 400)


if __name__ == "__main__":
    unittest.main()
