"""Tests of shared live sessions (live_sessions.py, /api/live/<room>):

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
from pathlib import Path

WORKER_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(WORKER_DIR))
os.environ.setdefault("WORKER_JOBS_DIR", tempfile.mkdtemp(prefix="live-test-jobs-"))

import live_sessions  # noqa: E402
import server  # noqa: E402
from http.server import ThreadingHTTPServer  # noqa: E402

ROOM = "room-abcdef12"


class LiveSessionsTest(unittest.TestCase):
    def test_publish_and_wait(self):
        sessions = live_sessions.LiveSessions()
        # Nothing published yet: the wait ends without a state.
        self.assertEqual(sessions.wait(ROOM, "b", 0, 0), {"version": 0, "peers": 1})
        self.assertEqual(sessions.publish(ROOM, "a", {"year": 1730}), {"version": 1, "peers": 2})
        self.assertEqual(sessions.wait(ROOM, "b", 0, 0), {"version": 1, "state": {"year": 1730}, "sender": "a", "peers": 2})
        # Up to date: nothing new.
        self.assertEqual(sessions.wait(ROOM, "b", 1, 0), {"version": 1, "peers": 2})

    def test_wait_is_answered_when_someone_publishes(self):
        sessions = live_sessions.LiveSessions()
        got = {}
        waiter = threading.Thread(target=lambda: got.update(sessions.wait(ROOM, "b", 0, 10)))
        started = time.monotonic()
        waiter.start()
        time.sleep(0.1)
        sessions.publish(ROOM, "a", {"camera": [1, 2, 3]})
        waiter.join(5)
        self.assertFalse(waiter.is_alive())
        self.assertLess(time.monotonic() - started, 3)
        self.assertEqual(got["state"], {"camera": [1, 2, 3]})

    def test_rooms_are_apart_and_checked(self):
        sessions = live_sessions.LiveSessions()
        sessions.publish(ROOM, "a", {"n": 1})
        self.assertEqual(sessions.wait("another-room-1", "b", 0, 0)["version"], 0)
        for room, client, state in [("short", "a", {}), ("bad/room/name", "a", {}), (ROOM, "", {}), (ROOM, "a", [1])]:
            with self.assertRaises(live_sessions.LiveError):
                sessions.publish(room, client, state)

    def test_idle_rooms_and_viewers_are_forgotten(self):
        now = [0.0]
        sessions = live_sessions.LiveSessions(clock=lambda: now[0])
        sessions.publish(ROOM, "a", {"n": 1})
        sessions.wait(ROOM, "b", 1, 0)
        now[0] += live_sessions.PEER_TTL + 1
        self.assertEqual(sessions.wait(ROOM, "b", 1, 0)["peers"], 1)
        now[0] += live_sessions.ROOM_TTL + 1
        sessions.publish("another-room-1", "a", {})
        self.assertEqual(sessions.wait(ROOM, "b", 0, 0), {"version": 0, "peers": 1})


class LiveEndpointTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        cls.base = f"http://127.0.0.1:{cls.httpd.server_address[1]}"
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()

    def call(self, path, body=None):
        request = urllib.request.Request(self.base + path, data=None if body is None else json.dumps(body).encode(),
                                         headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                return response.status, json.loads(response.read())
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read())

    def test_relay(self):
        room = "endpoint-room-1"
        self.assertEqual(self.call(f"/api/live/{room}?since=0&wait=0&client=b"), (200, {"version": 0, "peers": 1}))
        status, published = self.call(f"/api/live/{room}", {"client": "a", "state": {"camera": {"position": [1, 2, 3]}}})
        self.assertEqual((status, published["version"]), (200, 1))
        status, got = self.call(f"/api/live/{room}?since=0&wait=5&client=b")
        self.assertEqual((status, got["state"], got["sender"]), (200, {"camera": {"position": [1, 2, 3]}}, "a"))

    def test_refusals(self):
        self.assertEqual(self.call("/api/live/x?since=0&wait=0&client=b")[0], 400)
        self.assertEqual(self.call("/api/live/endpoint-room-2?since=zero&client=b")[0], 400)
        self.assertEqual(self.call("/api/live/endpoint-room-2", {"client": "a", "state": "no"})[0], 400)
        big = {"client": "a", "state": {"blob": "x" * (live_sessions.MAX_STATE_BYTES + 1)}}
        self.assertEqual(self.call("/api/live/endpoint-room-2", big)[0], 400)


if __name__ == "__main__":
    unittest.main()
