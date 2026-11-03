"""Tests of the thumbnails the viewer renders for its bundled example models
(/api/examples/thumbnails, worker/example_thumbnails.py):

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
os.environ.setdefault("WORKER_JOBS_DIR", tempfile.mkdtemp(prefix="example-thumbs-test-jobs-"))

import example_thumbnails  # noqa: E402
import server  # noqa: E402
from http.server import ThreadingHTTPServer  # noqa: E402

USERS = {
    "alice": {"username": "alice", "role": "user"},
    "admin": {"username": "admin", "role": "admin"},
}
PNG = b"\x89PNG\r\n\x1a\n" + b"\0" * 16


def multipart(fields, files):
    boundary = uuid.uuid4().hex
    body = b""
    for name, value in fields.items():
        body += f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode()
    for name, data in files.items():
        body += (f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"; filename="{name}.png"\r\n'
                 "Content-Type: image/png\r\n\r\n").encode() + data + b"\r\n"
    return body + f"--{boundary}--\r\n".encode(), f"multipart/form-data; boundary={boundary}"


class ExampleThumbnailsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        cls.base = f"http://127.0.0.1:{cls.httpd.server_address[1]}"
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()

    def setUp(self):
        root = Path(tempfile.mkdtemp(prefix="example-thumbs-"))
        patches = [
            mock.patch.object(server, "AUTH", SimpleNamespace(enabled=True)),
            mock.patch.object(server, "EXAMPLE_THUMBNAILS_DIR", root),
            mock.patch.object(
                server.Handler, "_current_user",
                lambda handler: USERS.get(handler.headers.get("X-Test-User", "")),
            ),
        ]
        for patch in patches:
            patch.start()
            self.addCleanup(patch.stop)

    def request(self, path, method="GET", user=None, data=None, content_type=None):
        headers = {"X-Test-User": user or ""}
        if content_type:
            headers["Content-Type"] = content_type
        req = urllib.request.Request(self.base + path, data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req) as response:
                return response.status, response.read(), response.headers
        except urllib.error.HTTPError as error:
            return error.code, error.read(), error.headers

    def post(self, user, views, folder="tempietto", basename="Tempietto", image=PNG):
        body, content_type = multipart({"dir": folder, "basename": basename}, {view: image for view in views})
        status, data, _ = self.request("/api/examples/thumbnails", "POST", user, body, content_type)
        return status, json.loads(data)

    def listing(self):
        status, data, _ = self.request("/api/examples/thumbnails")
        self.assertEqual(status, 200)
        return json.loads(data)["thumbnails"]

    def test_admins_only(self):
        self.assertEqual(self.post(None, ["side45"])[0], 401)
        self.assertEqual(self.post("alice", ["side45"])[0], 403)
        self.assertEqual(self.listing(), {})

    def test_all_views_listed_and_served(self):
        status, body = self.post("admin", example_thumbnails.VIEWS)
        self.assertEqual(status, 200)
        self.assertEqual(body["key"], "tempietto/Tempietto")
        self.assertEqual(body["views"], example_thumbnails.VIEWS)
        self.assertGreater(body["version"], 0)
        # A file directly in examples/: its filename is the folder.
        self.assertEqual(self.post("admin", ["side45"], "animated.glb", "animated")[0], 200)

        listing = self.listing()
        self.assertEqual(set(listing), {"tempietto/Tempietto", "animated.glb/animated"})
        self.assertEqual(listing["animated.glb/animated"]["views"], ["side45"])

        status, data, headers = self.request(f"/api/examples/thumbnails/tempietto/Tempietto_top.png?v={body['version']}")
        self.assertEqual((status, data), (200, PNG))
        self.assertEqual(headers["Content-Type"], "image/png")
        self.assertIn("max-age=2592000", headers["Cache-Control"])
        self.assertEqual(self.request("/api/examples/thumbnails/animated.glb/animated_side45.png")[:2], (200, PNG))
        self.assertEqual(self.request("/api/examples/thumbnails/animated.glb/animated_side0.png")[0], 404)

    def test_delete(self):
        self.post("admin", ["side45", "top"])
        path = "/api/examples/thumbnails?dir=tempietto&basename=Tempietto"
        self.assertEqual(self.request(path, "DELETE", "alice")[0], 403)
        status, data, _ = self.request(path, "DELETE", "admin")
        self.assertEqual((status, json.loads(data)), (200, {"removed": 2}))
        self.assertEqual(self.listing(), {})
        self.assertEqual(self.request(path, "DELETE", "admin")[0], 404)

    def test_rejected(self):
        self.assertEqual(self.post("admin", ["side45"], folder="..")[0], 400)
        self.assertEqual(self.post("admin", ["side45"], folder="a/b")[0], 400)
        self.assertEqual(self.post("admin", ["side45"], basename=".hidden")[0], 400)
        self.assertEqual(self.post("admin", ["front"])[0], 400)
        self.assertEqual(self.post("admin", ["side45"], image=b"GIF89a")[0], 415)
        self.assertEqual(self.request("/api/examples/thumbnails/../.auth/x_side45.png")[0], 404)
        self.assertEqual(self.request("/api/examples/thumbnails/tempietto/Tempietto_front.png")[0], 404)


if __name__ == "__main__":
    unittest.main()
