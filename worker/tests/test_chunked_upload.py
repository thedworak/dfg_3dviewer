"""Tests of uploads sent in pieces (POST /api/model/upload/start, PUT
/api/model/upload/<id>?offset=N, POST /api/model/upload/<id>/finish):

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
os.environ.setdefault("WORKER_JOBS_DIR", tempfile.mkdtemp(prefix="chunked-upload-test-jobs-"))

import server  # noqa: E402
from http.server import ThreadingHTTPServer  # noqa: E402

CONTENT = b"solid box\nendsolid box\n" * 3


class ChunkedUploadTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        cls.base = f"http://127.0.0.1:{cls.httpd.server_address[1]}"
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()

    def setUp(self):
        # Small pieces; no conversion (the pipeline is tested elsewhere).
        patches = [
            mock.patch.object(server, "UPLOAD_CHUNK_BYTES", 16),
            mock.patch.object(server, "run_pipeline", lambda *args: None),
        ]
        for patch in patches:
            patch.start()
            self.addCleanup(patch.stop)

    def request(self, method, path, body=None, json_body=None):
        data = json.dumps(json_body).encode() if json_body is not None else body
        req = urllib.request.Request(self.base + path, data=data, method=method)
        if json_body is not None:
            req.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(req) as response:
                return response.status, json.loads(response.read())
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read())

    def start(self, name="box.stl", size=len(CONTENT)):
        return self.request("POST", "/api/model/upload/start", json_body={"name": name, "size": size})

    def put(self, upload_id, offset, piece):
        return self.request("PUT", f"/api/model/upload/{upload_id}?offset={offset}", body=piece)

    def test_pieces_make_the_file_a_job_converts(self):
        status, body = self.start(name="my box.stl")
        self.assertEqual(status, 200)
        upload_id, chunk = body["uploadId"], body["chunkBytes"]
        self.assertEqual(chunk, 16)

        for offset in range(0, len(CONTENT), chunk):
            status, body = self.put(upload_id, offset, CONTENT[offset:offset + chunk])
            self.assertEqual(status, 200)
            self.assertEqual(body["received"], min(offset + chunk, len(CONTENT)))

        status, body = self.request("POST", f"/api/model/upload/{upload_id}/finish")
        self.assertEqual(status, 200)
        job_input = server.JOBS_DIR / body["entity_id"] / "input" / "my_box.stl"
        self.assertEqual(job_input.read_bytes(), CONTENT)
        self.assertFalse((server.UPLOADS_DIR / upload_id).exists())

    def test_a_piece_sent_again_is_accepted_a_gap_is_not(self):
        upload_id = self.start()[1]["uploadId"]
        self.assertEqual(self.put(upload_id, 0, CONTENT[:16])[0], 200)
        # A retry of the same piece: nothing changes.
        self.assertEqual(self.put(upload_id, 0, CONTENT[:16]), (200, {"received": 16}))
        # A piece after a gap: 409, with what the worker has.
        status, body = self.put(upload_id, 32, CONTENT[32:48])
        self.assertEqual(status, 409)
        self.assertEqual(body["received"], 16)
        # Finishing early: 409 as well.
        status, body = self.request("POST", f"/api/model/upload/{upload_id}/finish")
        self.assertEqual((status, body["received"]), (409, 16))

    def test_checked_before_any_piece_is_sent(self):
        self.assertEqual(self.start(name="notes.txt")[0], 400)
        self.assertEqual(self.start(size=0)[0], 400)
        with mock.patch.object(server, "MAX_UPLOAD_BYTES", 10):
            self.assertEqual(self.start()[0], 413)
        # A piece larger than the worker takes, an unknown upload.
        upload_id = self.start()[1]["uploadId"]
        self.assertEqual(self.put(upload_id, 0, CONTENT[:17])[0], 413)
        self.assertEqual(self.put("0" * 32, 0, CONTENT[:16])[0], 404)


if __name__ == "__main__":
    unittest.main()
