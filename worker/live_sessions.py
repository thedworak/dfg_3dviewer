"""Shared live sessions: a relay between viewers that show one scene.

A session is a room with the last state one of its viewers published (the
camera, the section, the year on the timeline ...: JSON the worker does not
read). Viewers publish with POST /api/live/<room> and wait for the next
state with GET /api/live/<room>?since=<version> - a long poll, answered as
soon as someone publishes, or after `wait` seconds with nothing new.

Nothing is stored: rooms live in memory and are dropped after an idle
while. A room's id is its key - whoever knows it can join, so viewers make
it long and random.
"""

import re
import threading
import time

ROOM_PATTERN = re.compile(r"[A-Za-z0-9_-]{8,64}")
CLIENT_PATTERN = re.compile(r"[A-Za-z0-9_-]{1,64}")
MAX_STATE_BYTES = 64 * 1024
MAX_ROOMS = 2000
ROOM_TTL = 2 * 3600
PEER_TTL = 45
MAX_WAIT = 25


class LiveError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


class LiveSessions:
    def __init__(self, clock=time.monotonic):
        self._clock = clock
        self._changed = threading.Condition()
        # room -> {"version", "state", "sender", "touched", "peers": {client: seen}}
        self._rooms = {}

    def _room(self, room: str, create: bool):
        if not ROOM_PATTERN.fullmatch(room or ""):
            raise LiveError(400, "Invalid session id")
        now = self._clock()
        found = self._rooms.get(room)
        if found is None:
            if not create:
                return None
            self._forget_idle(now)
            if len(self._rooms) >= MAX_ROOMS:
                raise LiveError(503, "Too many sessions")
            found = self._rooms[room] = {"version": 0, "state": None, "sender": "", "touched": now, "peers": {}}
        found["touched"] = now
        return found

    def _forget_idle(self, now: float) -> None:
        for name in [name for name, room in self._rooms.items() if now - room["touched"] > ROOM_TTL]:
            del self._rooms[name]

    @staticmethod
    def _client(client: str) -> str:
        if not CLIENT_PATTERN.fullmatch(client or ""):
            raise LiveError(400, "Invalid client id")
        return client

    def _peers(self, room: dict, client: str) -> int:
        now = self._clock()
        room["peers"][client] = now
        for name in [name for name, seen in room["peers"].items() if now - seen > PEER_TTL]:
            del room["peers"][name]
        return len(room["peers"])

    def publish(self, room: str, client: str, state) -> dict:
        """A viewer's new state: everyone waiting in the room gets it."""
        client = self._client(client)
        if not isinstance(state, dict):
            raise LiveError(400, "state must be an object")
        with self._changed:
            found = self._room(room, create=True)
            found["version"] += 1
            found["state"] = state
            found["sender"] = client
            peers = self._peers(found, client)
            self._changed.notify_all()
            return {"version": found["version"], "peers": peers}

    def wait(self, room: str, client: str, since: int, wait: float) -> dict:
        """The room's state once it is newer than `since`, or - after `wait`
        seconds without one - only its version and the number of viewers."""
        client = self._client(client)
        deadline = self._clock() + max(0.0, min(float(wait), MAX_WAIT))
        with self._changed:
            found = self._room(room, create=True)
            while found["version"] <= since:
                remaining = deadline - self._clock()
                if remaining <= 0:
                    break
                self._peers(found, client)
                self._changed.wait(min(remaining, 5.0))
                found = self._room(room, create=True)
            peers = self._peers(found, client)
            if found["version"] > since and found["state"] is not None:
                return {"version": found["version"], "state": found["state"], "sender": found["sender"], "peers": peers}
            return {"version": found["version"], "peers": peers}
