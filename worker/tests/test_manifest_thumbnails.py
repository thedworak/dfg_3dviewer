"""Tests of the thumbnails of the viewer's bundled AIM3D manifests (POST
/api/manifests/<name>/thumbnails, worker/manifests.py):

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
import uuid
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

WORKER_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(WORKER_DIR))
os.environ.setdefault("WORKER_JOBS_DIR", tempfile.mkdtemp(prefix="manifest-test-jobs-"))

import manifests  # noqa: E402
import server  # noqa: E402
from http.server import ThreadingHTTPServer  # noqa: E402

USERS = {
    "alice": {"username": "alice", "role": "user"},
    "admin": {"username": "admin", "role": "admin"},
}
PNG = b"\x89PNG\r\n\x1a\n" + b"\0" * 16
BASE = "https://viewer.example/viewer/api/manifests/tempietto-night/"
MANIFEST = {
    "id": "./manifests/tempietto-night.json",
    "type": "Manifest",
    "modified": "2026-01-01T00:00:00.000Z",
    "AIM3DViewer": {"thumbnails": ["./examples/gallery/tempietto/Tempietto_side0.png"]},
}


def multipart(fields, files):
    boundary = uuid.uuid4().hex
    body = b""
    for name, value in fields.items():
        body += f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode()
    for name, data in files.items():
        body += (f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"; filename="{name}.png"\r\n'
                 "Content-Type: image/png\r\n\r\n").encode() + data + b"\r\n"
    return body + f"--{boundary}--\r\n".encode(), f"multipart/form-data; boundary={boundary}"


class ManifestThumbnailsTest(unittest.TestCase):
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
        auth = SimpleNamespace(enabled=True)
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

    def post(self, name, user, views, manifest=MANIFEST, base_url=BASE):
        body, content_type = multipart(
            {"manifest": json.dumps(manifest), "baseUrl": base_url}, {view: PNG for view in views})
        req = urllib.request.Request(
            f"{self.base}/api/manifests/{name}/thumbnails", data=body, method="POST",
            headers={"Content-Type": content_type, "X-Test-User": user or ""})
        try:
            with urllib.request.urlopen(req) as response:
                return response.status, json.loads(response.read())
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read())

    def get(self, path):
        try:
            with urllib.request.urlopen(self.base + path) as response:
                return response.status, response.read()
        except urllib.error.HTTPError as error:
            return error.code, error.read()

    def test_admins_only(self):
        self.assertEqual(self.post("tempietto-night", None, ["side45"])[0], 401)
        self.assertEqual(self.post("tempietto-night", "alice", ["side45"])[0], 403)

    def test_main_thumbnail_then_all_views(self):
        status, body = self.post("tempietto-night", "admin", ["side45"])
        self.assertEqual(status, 200)
        thumbnails = body["manifest"]["AIM3DViewer"]["thumbnails"]
        # The main thumbnail first, the manifest's own gallery after it.
        self.assertTrue(thumbnails[0]["src"].startswith(BASE + "tempietto-night_side45.png?v="))
        self.assertEqual(thumbnails[1:], MANIFEST["AIM3DViewer"]["thumbnails"])
        self.assertNotEqual(body["manifest"]["modified"], MANIFEST["modified"])

        status, stored = self.get("/api/manifests/tempietto-night.json")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(stored), body["manifest"])
        self.assertEqual(self.get("/api/manifests/tempietto-night/tempietto-night_side45.png")[1], PNG)

        # All the views, from the stored manifest: they replace the gallery.
        status, body = self.post("tempietto-night", "admin", manifests.VIEWS, manifest=body["manifest"])
        self.assertEqual(status, 200)
        srcs = [entry["src"].split("?")[0] for entry in body["manifest"]["AIM3DViewer"]["thumbnails"]]
        self.assertEqual(srcs, [f"{BASE}tempietto-night_{view}.png" for view in manifests.VIEWS])

    def test_rejected(self):
        self.assertEqual(self.post("index", "admin", ["side45"])[0], 400)
        self.assertEqual(self.post("..", "admin", ["side45"])[0], 400)
        self.assertEqual(self.post("box", "admin", ["side45"], base_url="https://evil.example/x/")[0], 400)
        self.assertEqual(self.post("box", "admin", ["front"])[0], 400)
        self.assertEqual(self.post("box", "admin", ["side45"], manifest=[1, 2])[0], 400)
        self.assertEqual(self.get("/api/manifests/missing.json")[0], 404)
        self.assertEqual(self.get("/api/manifests/box/../../.auth/x.png")[0], 404)


if __name__ == "__main__":
    unittest.main()
