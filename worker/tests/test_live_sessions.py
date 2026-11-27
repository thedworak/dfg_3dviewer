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
A, B, C = "client-aaaa", "client-bbbb", "client-cccc"


def joined(sessions, room=ROOM, *clients):
    for client in clients:
        sessions.join(room, client, client.upper())


class LiveSessionsTest(unittest.TestCase):
    def test_publish_and_wait(self):
        sessions = live_sessions.LiveSessions()
        first = sessions.join(ROOM, B, "Bea")
        self.assertTrue(first["host"] and first["hostKey"])
        self.assertEqual((first["status"], first["peers"]), ("active", 1))
        joined(sessions, ROOM, A)
        # Nothing published yet: the wait ends without a state.
        self.assertNotIn("state", sessions.wait(ROOM, B, 0, 0))
        self.assertEqual(sessions.publish(ROOM, A, {"year": 1730})["version"], 1)
        got = sessions.wait(ROOM, B, 0, 0)
        self.assertEqual((got["version"], got["state"], got["peers"]), (1, {"year": 1730}, 2))
        # The sender is the public id, not the client id.
        self.assertEqual(got["sender"], live_sessions.public_id(ROOM, A))
        self.assertEqual(sorted(item["nick"] for item in got["members"]), ["Bea", "CLIENT-AAAA"])
        # Up to date: nothing new.
        self.assertNotIn("state", sessions.wait(ROOM, B, 1, 0))

    def test_wait_is_answered_when_someone_publishes(self):
        sessions = live_sessions.LiveSessions()
        joined(sessions, ROOM, A, B)
        got = {}
        waiter = threading.Thread(target=lambda: got.update(sessions.wait(ROOM, B, 0, 10)))
        started = time.monotonic()
        waiter.start()
        time.sleep(0.1)
        sessions.publish(ROOM, A, {"camera": [1, 2, 3]})
        waiter.join(5)
        self.assertFalse(waiter.is_alive())
        self.assertLess(time.monotonic() - started, 3)
        self.assertEqual(got["state"], {"camera": [1, 2, 3]})

    def test_rooms_are_apart_and_checked(self):
        sessions = live_sessions.LiveSessions()
        joined(sessions, ROOM, A)
        sessions.publish(ROOM, A, {"n": 1})
        joined(sessions, "another-room-1", B)
        self.assertEqual(sessions.wait("another-room-1", B, 0, 0)["version"], 0)
        for room, client, state in [("short", A, {}), ("bad/room/name", A, {}), (ROOM, "", {}), (ROOM, A, [1])]:
            with self.assertRaises(live_sessions.LiveError):
                sessions.publish(room, client, state)
        # Not joined: told to join first.
        with self.assertRaises(live_sessions.LiveError) as caught:
            sessions.wait(ROOM, C, 0, 0)
        self.assertEqual((caught.exception.status, caught.exception.extra), (403, {"rejoin": True}))

    def test_a_nickname_is_needed(self):
        sessions = live_sessions.LiveSessions()
        for nick in ["", "   ", "\u0000\u0007"]:
            with self.assertRaises(live_sessions.LiveError):
                sessions.join(ROOM, A, nick)
        self.assertEqual(live_sessions.normalize_nick("  Anna \n  Nowak\t "), "Anna Nowak")
        self.assertEqual(len(live_sessions.normalize_nick("x" * 100)), live_sessions.MAX_NICK)

    def test_idle_rooms_and_viewers_are_forgotten(self):
        now = [0.0]
        sessions = live_sessions.LiveSessions(clock=lambda: now[0])
        joined(sessions, ROOM, A, B)
        sessions.publish(ROOM, A, {"n": 1})
        self.assertEqual(sessions.wait(ROOM, B, 1, 0)["peers"], 2)
        now[0] += live_sessions.PEER_TTL + 1
        self.assertEqual(sessions.wait(ROOM, B, 1, 0)["peers"], 1)
        now[0] += live_sessions.ROOM_TTL + 1
        joined(sessions, "another-room-1", A)
        with self.assertRaises(live_sessions.LiveError):
            sessions.wait(ROOM, B, 0, 0)
        # Joined again: a new room.
        self.assertEqual(sessions.join(ROOM, B, "Bea")["version"], 0)

    def test_manual_approval(self):
        sessions = live_sessions.LiveSessions()
        host = sessions.join(ROOM, A, "Host")
        key = host["hostKey"]
        sessions.manage(ROOM, "approval", host_key=key, approval="manual")
        waiting = sessions.join(ROOM, B, "Guest")
        self.assertEqual(waiting["status"], "pending")
        self.assertNotIn("members", waiting)
        sessions.publish(ROOM, A, {"n": 1})
        # Waiting: no state, cannot publish.
        self.assertNotIn("state", sessions.wait(ROOM, B, 0, 0))
        with self.assertRaises(live_sessions.LiveError):
            sessions.publish(ROOM, B, {"n": 2})
        # The host sees who waits; the others do not.
        seen = sessions.wait(ROOM, A, 1, 0)
        self.assertEqual((seen["peers"], seen["pending"]), (1, 1))
        self.assertEqual([item["status"] for item in seen["members"] if item["nick"] == "Guest"], ["pending"])
        # Only the host decides.
        with self.assertRaises(live_sessions.LiveError):
            sessions.manage(ROOM, "approve", host_key="wrong", target=waiting["you"])
        sessions.manage(ROOM, "approve", host_key=key, target=waiting["you"])
        got = sessions.wait(ROOM, B, 0, 0)
        self.assertEqual((got["status"], got["state"]), ("active", {"n": 1}))
        # Someone not let in stays out.
        third = sessions.join(ROOM, C, "Third")
        sessions.manage(ROOM, "reject", host_key=key, target=third["you"])
        self.assertEqual(sessions.wait(ROOM, C, 0, 0)["status"], "rejected")
        with self.assertRaises(live_sessions.LiveError) as caught:
            sessions.join(ROOM, C, "Third")
        self.assertTrue(caught.exception.extra.get("rejected"))
        # Back to automatic: those waiting come in.
        fourth = sessions.join(ROOM, "client-dddd", "Fourth")
        self.assertEqual(fourth["status"], "pending")
        sessions.manage(ROOM, "approval", host_key=key, approval="auto")
        self.assertEqual(sessions.wait(ROOM, "client-dddd", 0, 0)["status"], "active")

    def test_the_same_name_twice(self):
        sessions = live_sessions.LiveSessions()
        self.assertEqual(sessions.join(ROOM, A, "Anna")["nick"], "Anna")
        self.assertEqual(sessions.join(ROOM, B, "anna")["nick"], "anna (2)")
        self.assertEqual(sessions.join(ROOM, C, "Anna")["nick"], "Anna (3)")
        # Coming in again keeps one's own name.
        self.assertEqual(sessions.join(ROOM, A, "Anna")["nick"], "Anna")
        long = sessions.join(ROOM, "client-dddd", "x" * 60)["nick"]
        self.assertEqual(sessions.join(ROOM, "client-eeee", "x" * 60)["nick"], "x" * 36 + " (2)")
        self.assertEqual(len(long), live_sessions.MAX_NICK)

    def test_removing_someone_turns_to_letting_in(self):
        sessions = live_sessions.LiveSessions()
        key = sessions.join(ROOM, A, "Host")["hostKey"]
        guest = sessions.join(ROOM, B, "Guest")
        self.assertEqual(sessions.manage(ROOM, "reject", host_key=key, target=guest["you"])["approval"], "manual")
        # Back with a new viewer: waits.
        self.assertEqual(sessions.join(ROOM, C, "Guest")["status"], "pending")

    def test_a_presentation(self):
        sessions = live_sessions.LiveSessions()
        key = sessions.join(ROOM, A, "Host")["hostKey"]
        guest = sessions.join(ROOM, B, "Guest")
        self.assertTrue(guest["canLead"])
        sessions.manage(ROOM, "lead", host_key=key, value="host")
        # Only the host leads: the guest watches.
        with self.assertRaises(live_sessions.LiveError) as caught:
            sessions.publish(ROOM, B, {"n": 1})
        self.assertEqual((caught.exception.status, caught.exception.extra), (403, {"lead": "host"}))
        self.assertEqual(sessions.publish(ROOM, A, {"n": 1})["version"], 1)
        got = sessions.wait(ROOM, B, 0, 0)
        self.assertEqual((got["lead"], got["canLead"], got["state"]), ("host", False, {"n": 1}))
        # The host lets the guest lead too, and takes it back.
        sessions.manage(ROOM, "grant", host_key=key, target=guest["you"], value=True)
        self.assertEqual(sessions.publish(ROOM, B, {"n": 2})["version"], 2)
        self.assertEqual([item["lead"] for item in sessions.wait(ROOM, A, 2, 0)["members"]], [True, True])
        sessions.manage(ROOM, "grant", host_key=key, target=guest["you"], value=False)
        with self.assertRaises(live_sessions.LiveError):
            sessions.publish(ROOM, B, {"n": 3})
        with self.assertRaises(live_sessions.LiveError):
            sessions.manage(ROOM, "lead", host_key=key, value="nobody")

    def test_a_passcode(self):
        sessions = live_sessions.LiveSessions()
        key = sessions.join(ROOM, A, "Host")["hostKey"]
        with self.assertRaises(live_sessions.LiveError):
            sessions.manage(ROOM, "passcode", host_key=key, value="123")
        self.assertTrue(sessions.manage(ROOM, "passcode", host_key=key, value="4711", client=A)["passcode"])
        for given, wrong in [(None, False), ("0000", True)]:
            with self.assertRaises(live_sessions.LiveError) as caught:
                sessions.join(ROOM, B, "Guest", passcode=given, ip="1.2.3.4")
            self.assertEqual(caught.exception.status, 401)
            self.assertEqual(caught.exception.extra.get("wrong", False), wrong)
        self.assertEqual(sessions.join(ROOM, B, "Guest", passcode="4711", ip="1.2.3.4")["status"], "active")
        # In: back without it. The host never needs it.
        self.assertEqual(sessions.join(ROOM, B, "Guest", ip="1.2.3.4")["status"], "active")
        self.assertTrue(sessions.join(ROOM, "client-host2", "Host", host_key=key)["host"])
        # Guessing is stopped.
        for _ in range(live_sessions.PASSCODE_LIMIT[0]):
            with self.assertRaises(live_sessions.LiveError):
                sessions.join(ROOM, C, "Guesser", passcode="nope", ip="6.6.6.6")
        with self.assertRaises(live_sessions.LiveError) as caught:
            sessions.join(ROOM, C, "Guesser", passcode="4711", ip="6.6.6.6")
        self.assertEqual(caught.exception.status, 429)
        # Removed: open to all again.
        sessions.manage(ROOM, "passcode", host_key=key, value="")
        self.assertEqual(sessions.join(ROOM, "client-dddd", "Open", ip="7.7.7.7")["status"], "active")

    def test_joining_is_limited(self):
        now = [0.0]
        sessions = live_sessions.LiveSessions(clock=lambda: now[0])
        for index in range(live_sessions.JOIN_LIMIT[0]):
            sessions.join(f"room-many-{index:04d}", A, "Anna", ip="9.9.9.9")
        with self.assertRaises(live_sessions.LiveError) as caught:
            sessions.join(ROOM, A, "Anna", ip="9.9.9.9")
        self.assertEqual(caught.exception.status, 429)
        # Another address, or a minute later: fine.
        sessions.join(ROOM, A, "Anna", ip="8.8.8.8")
        now[0] += live_sessions.JOIN_LIMIT[1] + 1
        sessions.join(ROOM, B, "Bea", ip="9.9.9.9")

    def test_waiting_is_limited(self):
        sessions = live_sessions.LiveSessions()
        key = sessions.join(ROOM, A, "Host")["hostKey"]
        sessions.manage(ROOM, "approval", host_key=key, approval="manual")
        for index in range(live_sessions.MAX_PENDING):
            sessions.join(ROOM, f"client-wait{index:04d}", f"W{index}", ip=f"10.0.{index}.1")
        with self.assertRaises(live_sessions.LiveError) as caught:
            sessions.join(ROOM, "client-toomany", "Late", ip="10.1.0.1")
        self.assertEqual(caught.exception.status, 429)

    def test_wait_is_answered_when_the_people_change(self):
        sessions = live_sessions.LiveSessions()
        host = sessions.join(ROOM, A, "Host")
        got = {}
        waiter = threading.Thread(target=lambda: got.update(sessions.wait(ROOM, A, 0, 10, host["roster"])))
        started = time.monotonic()
        waiter.start()
        time.sleep(0.1)
        sessions.join(ROOM, B, "Guest")
        waiter.join(5)
        self.assertLess(time.monotonic() - started, 3)
        self.assertEqual(got["peers"], 2)

    def test_close_and_reopen(self):
        sessions = live_sessions.LiveSessions()
        key = sessions.join(ROOM, A, "Host")["hostKey"]
        joined(sessions, ROOM, B)
        sessions.manage(ROOM, "close", host_key=key)
        self.assertTrue(sessions.wait(ROOM, B, 0, 0)["closed"])
        for call in (lambda: sessions.publish(ROOM, B, {"n": 1}), lambda: sessions.join(ROOM, C, "Late")):
            with self.assertRaises(live_sessions.LiveError) as caught:
                call()
            self.assertEqual(caught.exception.status, 410)
        # The host comes back in, and opens it again.
        self.assertTrue(sessions.join(ROOM, "client-host2", "Host", host_key=key)["host"])
        sessions.manage(ROOM, "reopen", host_key=key)
        self.assertEqual(sessions.join(ROOM, C, "Late")["status"], "active")
        self.assertEqual(sessions.publish(ROOM, B, {"n": 1})["version"], 1)

    def test_a_signed_in_hosts_history(self):
        now = [0.0]
        path = Path(tempfile.mkdtemp(prefix="live-store-")) / "sessions.json"
        sessions = live_sessions.LiveSessions(clock=lambda: now[0], store=live_sessions.LiveSessionStore(path))
        sessions.join(ROOM, A, "Anna", user="anna", title="Tempietto")
        joined(sessions, ROOM, B, C)
        sessions.join("someone-elses-1", A, "Anna")
        mine = sessions.owned("anna")
        self.assertEqual(len(mine), 1)
        self.assertEqual({key: mine[0][key] for key in ("id", "title", "participants", "peak", "active", "closed")},
                         {"id": ROOM, "title": "Tempietto", "participants": 3, "peak": 3, "active": 3, "closed": False})
        # The owner closes it from the history, without being in the room.
        sessions.manage(ROOM, "close", user="anna")
        with self.assertRaises(live_sessions.LiveError):
            sessions.manage(ROOM, "reopen", user="bob")
        # The worker starts again: the room comes back from the file.
        sessions = live_sessions.LiveSessions(clock=lambda: now[0], store=live_sessions.LiveSessionStore(path))
        mine = sessions.owned("anna")
        self.assertEqual((mine[0]["closed"], mine[0]["participants"], mine[0]["active"]), (True, 3, 0))
        with self.assertRaises(live_sessions.LiveError):
            sessions.join(ROOM, B, "Bea")
        sessions.manage(ROOM, "reopen", user="anna")
        again = sessions.join(ROOM, A, "Anna", user="anna")
        self.assertTrue(again["host"])
        self.assertNotIn("hostKey", again)
        self.assertFalse(sessions.join(ROOM, B, "Bea")["host"])
        self.assertEqual(sessions.owned("anna")[0]["participants"], 3)
        self.assertNotIn("Bea", path.read_text())
        # Renamed, then forgotten: out of the history, the room goes on.
        sessions.manage(ROOM, "title", user="anna", value="  Lecture  ")
        self.assertEqual(sessions.owned("anna")[0]["title"], "Lecture")
        with self.assertRaises(live_sessions.LiveError):
            sessions.manage(ROOM, "forget", host_key="whatever")
        self.assertEqual(sessions.manage(ROOM, "forget", user="anna"), {"forgotten": True})
        self.assertEqual(sessions.owned("anna"), [])
        self.assertNotIn(ROOM, path.read_text())
        self.assertEqual(sessions.publish(ROOM, B, {"n": 1})["version"], 1)


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
        self.assertEqual(self.call(f"/api/live/{room}?since=0&wait=0&client=client-bbbb")[0], 403)
        status, host = self.call(f"/api/live/{room}/join", {"client": "client-aaaa", "nick": "Anna"})
        self.assertEqual((status, host["host"], host["status"]), (200, True, "active"))
        self.assertEqual(self.call(f"/api/live/{room}/join", {"client": "client-bbbb", "nick": "Bea"})[1]["status"], "active")
        status, published = self.call(f"/api/live/{room}", {"client": "client-aaaa", "state": {"camera": {"position": [1, 2, 3]}}})
        self.assertEqual((status, published["version"]), (200, 1))
        status, got = self.call(f"/api/live/{room}?since=0&wait=5&client=client-bbbb")
        self.assertEqual((status, got["state"], got["sender"]), (200, {"camera": {"position": [1, 2, 3]}}, host["you"]))
        status, managed = self.call(f"/api/live/{room}/manage", {"action": "close", "hostKey": host["hostKey"]})
        self.assertEqual((status, managed["closed"]), (200, True))
        self.assertEqual(self.call(f"/api/live/{room}/manage", {"action": "reopen", "hostKey": "nope"})[0], 403)
        # Accounts off: no history.
        self.assertEqual(self.call("/api/live/mine"), (200, {"sessions": [], "accounts": False}))

    def test_refusals(self):
        self.assertEqual(self.call("/api/live/x?since=0&wait=0&client=client-bbbb")[0], 400)
        self.assertEqual(self.call("/api/live/endpoint-room-2/join", {"client": "client-aaaa", "nick": ""})[0], 400)
        self.call("/api/live/endpoint-room-2/join", {"client": "client-aaaa", "nick": "Anna"})
        self.assertEqual(self.call("/api/live/endpoint-room-2?since=zero&client=client-aaaa")[0], 400)
        self.assertEqual(self.call("/api/live/endpoint-room-2", {"client": "client-aaaa", "state": "no"})[0], 400)
        big = {"client": "client-aaaa", "state": {"blob": "x" * (live_sessions.MAX_STATE_BYTES + 1)}}
        self.assertEqual(self.call("/api/live/endpoint-room-2", big)[0], 400)
        self.assertEqual(self.call("/api/live/endpoint-room-2/manage", {"action": "explode"})[0], 400)


if __name__ == "__main__":
    unittest.main()
