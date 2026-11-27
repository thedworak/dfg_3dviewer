"""Shared live sessions: a relay between viewers that show one scene.

A session is a room with the last state one of its viewers published (the
camera, the section, the year on the timeline ...: JSON the worker does not
read), and the people in it.

  POST /api/live/<room>/join    {client, nick, hostKey?, title?} - comes in
                                under a nickname. The first one in a room
                                that does not exist yet starts it and is its
                                host: they get the room's hostKey (and, when
                                signed in, the room is kept in their history).
  POST /api/live/<room>         publishes a state (active members only).
  GET  /api/live/<room>?since=<version>&roster=<n>&client=<id>
                                waits for the next state - a long poll,
                                answered as soon as someone publishes, the
                                people change, or after `wait` seconds.
  POST /api/live/<room>/manage  {action, target?, approval?, hostKey?} - the
                                host lets people in or not, closes the room
                                or opens it again, and chooses whether new
                                people come in at once ("auto") or wait for
                                them ("manual").
  GET  /api/live/mine           a signed-in host's rooms, with how many took
                                part and how many are there now.

The host can also make it a presentation (only the host leads, and those
the host lets lead), ask for a passcode at the door, and - signed in -
rename a room in the history or forget it. Joining is limited per address
(and a wrong passcode more so), and so is the number of people waiting.

The states are not stored: rooms live in memory and are dropped after an
idle while. What a signed-in host's history needs is kept on disk (the
room's id, title, dates, settings and counts; never a state, never a
nickname). A room's id is its key - whoever knows it can ask to join, so
viewers make it long and random. A member's client id stays between that
viewer and the worker: the others see a public id derived from it.
"""

import hashlib
import json
import os
import re
import secrets
import tempfile
import threading
import time
import unicodedata
from pathlib import Path

ROOM_PATTERN = re.compile(r"[A-Za-z0-9_-]{8,64}")
CLIENT_PATTERN = re.compile(r"[A-Za-z0-9_-]{8,64}")
MAX_STATE_BYTES = 64 * 1024
MAX_ROOMS = 2000
MAX_MEMBERS = 300
ROOM_TTL = 2 * 3600
PEER_TTL = 45
MAX_WAIT = 25
MAX_NICK = 40
MAX_TITLE = 80
# A host's history: at most this many rooms, the ones used last kept.
MAX_OWNED = 100
# The public ids a kept room remembers, to count everyone once.
MAX_PEOPLE = 2000
# How often a kept room's last use is written (not with every state).
TOUCH_INTERVAL = 60
APPROVALS = ("auto", "manual")
LEADS = ("all", "host")
ACTIONS = ("approve", "reject", "close", "reopen", "approval", "lead", "grant", "passcode", "title", "forget")
# Joins one address may make (a class behind one router counts as one),
# and wrong passcodes it may give to one room,
# in a window of seconds; people waiting in one room at most.
JOIN_LIMIT = (120, 60)
PASSCODE_LIMIT = (20, 600)
MAX_PENDING = 50
MIN_PASSCODE, MAX_PASSCODE = 4, 64


class LiveError(Exception):
    def __init__(self, status: int, message: str, **extra):
        super().__init__(message)
        self.status = status
        self.message = message
        self.extra = extra

    def payload(self) -> dict:
        return {"error": self.message, **self.extra}


def normalize_nick(value, limit: int = MAX_NICK) -> str:
    """A nickname (or a title) as shown to the others: printable, one line,
    trimmed."""
    text = unicodedata.normalize("NFC", str(value or ""))
    text = "".join(" " if ch.isspace() else ch for ch in text if ch.isspace() or unicodedata.category(ch)[0] != "C")
    text = re.sub(r"\s+", " ", text).strip()
    return text[:limit].strip()


def _hash_key(key: str) -> str:
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


def _hash_passcode(room: str, passcode: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", passcode.encode("utf-8"), f"live:{room}".encode("utf-8"), 120_000).hex()


def public_id(room: str, client: str) -> str:
    return hashlib.sha256(f"{room}:{client}".encode("utf-8")).hexdigest()[:12]


class LiveSessionStore:
    """The rooms of signed-in hosts, as their history shows them (JSON file)."""

    def __init__(self, path=None):
        self.path = Path(path) if path else None
        self._lock = threading.Lock()
        self._records = None

    def _load(self) -> dict:
        if self._records is None:
            self._records = {}
            if self.path:
                try:
                    data = json.loads(self.path.read_text(encoding="utf-8"))
                    if isinstance(data, dict) and isinstance(data.get("rooms"), dict):
                        self._records = data["rooms"]
                except (OSError, ValueError):
                    pass
        return self._records

    def _save(self) -> None:
        if not self.path:
            return
        self.path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=self.path.parent, prefix=".live-")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                json.dump({"rooms": self._records}, handle, indent=1, sort_keys=True)
            os.chmod(tmp, 0o600)
            os.replace(tmp, self.path)
        except BaseException:
            try:
                os.unlink(tmp)
            except OSError:
                pass
            raise

    def get(self, room: str):
        with self._lock:
            record = self._load().get(room)
            return dict(record) if record else None

    def put(self, room: str, record: dict) -> None:
        with self._lock:
            records = self._load()
            records[room] = dict(record)
            owned = sorted((name for name, item in records.items() if item.get("owner") == record.get("owner")),
                           key=lambda name: records[name].get("lastActiveAt") or 0, reverse=True)
            for name in owned[MAX_OWNED:]:
                del records[name]
            self._save()

    def forget(self, room: str) -> None:
        with self._lock:
            if self._load().pop(room, None) is not None:
                self._save()

    def owned(self, owner: str) -> dict:
        with self._lock:
            return {name: dict(item) for name, item in self._load().items() if item.get("owner") == owner}


class LiveSessions:
    def __init__(self, clock=time.monotonic, store=None, wall=time.time):
        self._clock = clock
        self._wall = wall
        self._store = store if store is not None else LiveSessionStore()
        self._changed = threading.Condition()
        self._rooms = {}
        # (kind, key) -> times of recent attempts (join, wrong passcode).
        self._attempts = {}

    # ---- rooms ----

    def _new_room(self, room: str, now: float, record=None) -> dict:
        record = record or {}
        return {
            "id": room,
            "version": 0,
            "state": None,
            "sender": "",
            "touched": now,
            # client -> {"id", "nick", "status", "user", "seen", "host"}
            "members": {},
            # Bumped when the people, the approval or closed change: a wait
            # given an older roster is answered at once.
            "roster": 1,
            "approval": record.get("approval") if record.get("approval") in APPROVALS else "auto",
            # "host": a presentation - only the host leads (and those it
            # lets lead: a member's "lead").
            "lead": record.get("lead") if record.get("lead") in LEADS else "all",
            "passcode": record.get("passcode") or "",
            "closed": bool(record.get("closed")),
            "owner": record.get("owner"),
            "hostKey": record.get("hostKey") or "",
            "title": record.get("title") or "",
            # The public ids of everyone let in so far (kept with the
            # history: opaque, no nickname), and how many they are.
            "participants": set(record.get("people") or []),
            "participantCount": int(record.get("participants") or 0),
            "peak": int(record.get("peak") or 0),
            "createdAt": record.get("createdAt") or self._wall(),
            "written": 0.0,
        }

    def _room(self, room: str):
        if not ROOM_PATTERN.fullmatch(room or ""):
            raise LiveError(400, "Invalid session id")
        found = self._rooms.get(room)
        if found is not None:
            found["touched"] = self._clock()
        return found

    def _room_or_record(self, room: str, create: bool = False):
        """The room in memory, or brought back from a host's history."""
        found = self._room(room)
        if found is not None:
            return found
        record = self._store.get(room)
        if record is None and not create:
            return None
        now = self._clock()
        self._forget_idle(now)
        if len(self._rooms) >= MAX_ROOMS:
            raise LiveError(503, "Too many sessions")
        found = self._rooms[room] = self._new_room(room, now, record)
        return found

    def _forget_idle(self, now: float) -> None:
        for name in [name for name, room in self._rooms.items() if now - room["touched"] > ROOM_TTL]:
            del self._rooms[name]

    def _record(self, room: dict) -> dict:
        return {
            "owner": room["owner"],
            "hostKey": room["hostKey"],
            "title": room["title"],
            "approval": room["approval"],
            "lead": room["lead"],
            "passcode": room["passcode"],
            "closed": room["closed"],
            "createdAt": room["createdAt"],
            "lastActiveAt": self._wall(),
            "participants": room["participantCount"],
            "people": sorted(room["participants"])[:MAX_PEOPLE],
            "peak": room["peak"],
            **({"closedAt": room.get("closedAt")} if room.get("closedAt") else {}),
        }

    def _keep(self, room: dict, force: bool = True) -> None:
        """Writes a signed-in host's room to their history."""
        if not room["owner"]:
            return
        now = self._clock()
        if not force and now - room["written"] < TOUCH_INTERVAL:
            return
        room["written"] = now
        self._store.put(room["id"], self._record(room))

    # ---- limits ----

    def _limited(self, kind: str, key: str, limit) -> bool:
        """True when `key` made `limit[0]` attempts of `kind` in the last
        `limit[1]` seconds (the attempts are not counted here)."""
        now = self._clock()
        times = [at for at in self._attempts.get((kind, key), []) if now - at < limit[1]]
        if times:
            self._attempts[(kind, key)] = times
        else:
            self._attempts.pop((kind, key), None)
        return len(times) >= limit[0]

    def _attempt(self, kind: str, key: str) -> None:
        if len(self._attempts) > 20000:
            self._attempts.clear()
        self._attempts.setdefault((kind, key), []).append(self._clock())

    # ---- people ----

    @staticmethod
    def _can_lead(room: dict, member: dict) -> bool:
        return member["host"] or room["lead"] == "all" or bool(member.get("lead"))

    @staticmethod
    def _client(client: str) -> str:
        if not CLIENT_PATTERN.fullmatch(client or ""):
            raise LiveError(400, "Invalid client id")
        return client

    def _is_host(self, room: dict, user=None, host_key=None) -> bool:
        if user and room["owner"] and user == room["owner"]:
            return True
        return bool(host_key and room["hostKey"] and secrets.compare_digest(_hash_key(str(host_key)), room["hostKey"]))

    def _present(self, room: dict, now: float):
        return [member for member in room["members"].values() if now - member["seen"] <= PEER_TTL]

    def _count(self, room: dict, now: float):
        present = self._present(room, now)
        active = sum(1 for member in present if member["status"] == "active")
        pending = sum(1 for member in present if member["status"] == "pending")
        return active, pending

    def _admit(self, room: dict, client: str, member: dict) -> None:
        member["status"] = "active"
        if member["id"] not in room["participants"]:
            room["participants"].add(member["id"])
            room["participantCount"] += 1
        active, _ = self._count(room, self._clock())
        room["peak"] = max(room["peak"], active)

    def _seen(self, room: dict, client: str) -> dict:
        """The member, seen now; one who had gone and is back changes the roster."""
        member = room["members"].get(client)
        if member is None:
            raise LiveError(403, "Join the session first", rejoin=True)
        now = self._clock()
        if now - member["seen"] > PEER_TTL:
            room["roster"] += 1
        member["seen"] = now
        return member

    def _drop_gone(self, room: dict, now: float) -> None:
        """Members long gone are forgotten (but for those not let in)."""
        if len(room["members"]) <= MAX_MEMBERS:
            return
        gone = sorted((client for client, member in room["members"].items()
                       if member["status"] != "rejected" and now - member["seen"] > PEER_TTL),
                      key=lambda client: room["members"][client]["seen"])
        for client in gone[:len(room["members"]) - MAX_MEMBERS]:
            del room["members"][client]
        if len(room["members"]) > MAX_MEMBERS:
            raise LiveError(503, "Too many people in this session")

    def _summary(self, room: dict, member=None) -> dict:
        now = self._clock()
        active, pending = self._count(room, now)
        out = {
            "version": room["version"],
            "roster": room["roster"],
            "peers": active,
            "pending": pending,
            "approval": room["approval"],
            "lead": room["lead"],
            "closed": room["closed"],
        }
        if member is not None:
            out["status"] = member["status"]
            out["host"] = member["host"]
            out["you"] = member["id"]
            out["nick"] = member["nick"]
            out["canLead"] = self._can_lead(room, member)
            if member["host"]:
                out["passcode"] = bool(room["passcode"])
            if member["status"] == "active":
                # Everyone in sees who is there; the host also who waits.
                out["members"] = [
                    {"id": item["id"], "nick": item["nick"], "status": item["status"], "host": item["host"],
                     "lead": self._can_lead(room, item)}
                    for item in self._present(room, now)
                    if item["status"] == "active" or (member["host"] and item["status"] == "pending")
                ]
        return out

    def _unique_nick(self, room: dict, client: str, nick: str) -> str:
        """Two people present under one name: the later one is "Anna (2)"."""
        taken = {item["nick"].casefold() for key, item in room["members"].items()
                 if key != client and item["status"] != "rejected" and self._clock() - item["seen"] <= PEER_TTL}
        if nick.casefold() not in taken:
            return nick
        number = 2
        while True:
            suffix = f" ({number})"
            candidate = nick[:MAX_NICK - len(suffix)].rstrip() + suffix
            if candidate.casefold() not in taken:
                return candidate
            number += 1

    # ---- the calls ----

    def join(self, room: str, client: str, nick, user=None, host_key=None, title=None, passcode=None, ip="") -> dict:
        """A viewer comes in under a nickname (and the passcode, when the
        host set one): let in, or waiting for the host."""
        client = self._client(client)
        nick = normalize_nick(nick)
        if not nick:
            raise LiveError(400, "A nickname is needed")
        with self._changed:
            if self._limited("join", ip, JOIN_LIMIT):
                raise LiveError(429, "Too many attempts to join: wait a minute", retryAfter=JOIN_LIMIT[1])
            self._attempt("join", ip)
            existed = self._room(room) is not None or self._store.get(room) is not None
            found = self._room_or_record(room, create=True)
            created_key = None
            if not existed:
                created_key = secrets.token_urlsafe(18)
                found["hostKey"] = _hash_key(created_key)
                found["owner"] = user or None
            is_host = created_key is not None or self._is_host(found, user, host_key)
            if found["closed"] and not is_host:
                raise LiveError(410, "The session is closed", closed=True)
            member = found["members"].get(client)
            if member is not None and member["status"] == "rejected" and not is_host:
                raise LiveError(403, "The host did not let you in", rejected=True)
            # The passcode: asked of whoever is not in yet (a member let in
            # comes back without it, the host never needs it).
            if found["passcode"] and not is_host and (member is None or member["status"] != "active"):
                if self._limited("passcode", f"{ip}:{room}", PASSCODE_LIMIT):
                    raise LiveError(429, "Too many wrong passcodes: wait a few minutes", retryAfter=PASSCODE_LIMIT[1])
                given = str(passcode or "")
                if not given:
                    raise LiveError(401, "This session asks for a passcode", passcode=True)
                if not secrets.compare_digest(_hash_passcode(room, given[:MAX_PASSCODE]), found["passcode"]):
                    self._attempt("passcode", f"{ip}:{room}")
                    raise LiveError(401, "Wrong passcode", passcode=True, wrong=True)
            if member is None:
                if not is_host and found["approval"] == "manual" and self._count(found, self._clock())[1] >= MAX_PENDING:
                    raise LiveError(429, "Too many people are waiting to be let in")
                self._drop_gone(found, self._clock())
                member = found["members"][client] = {"id": public_id(room, client), "status": "pending", "seen": 0.0}
            nick = self._unique_nick(found, client, nick)
            member.update({"nick": nick, "user": user or None, "host": is_host, "seen": self._clock()})
            if is_host or member["status"] == "active" or found["approval"] == "auto":
                self._admit(found, client, member)
            else:
                member["status"] = "pending"
            if is_host and normalize_nick(title, MAX_TITLE):
                found["title"] = normalize_nick(title, MAX_TITLE)
            found["roster"] += 1
            self._keep(found)
            self._changed.notify_all()
            answer = self._summary(found, member)
            if created_key:
                answer["hostKey"] = created_key
            return answer

    def publish(self, room: str, client: str, state) -> dict:
        """A viewer's new state: everyone waiting in the room gets it."""
        client = self._client(client)
        if not isinstance(state, dict):
            raise LiveError(400, "state must be an object")
        with self._changed:
            found = self._room(room)
            if found is None:
                raise LiveError(403, "Join the session first", rejoin=True)
            member = self._seen(found, client)
            if member["status"] != "active":
                raise LiveError(403, "Not let in yet", member=member["status"])
            if found["closed"]:
                raise LiveError(410, "The session is closed", closed=True)
            if not self._can_lead(found, member):
                raise LiveError(403, "Only the host leads now", lead=found["lead"])
            found["version"] += 1
            found["state"] = state
            found["sender"] = member["id"]
            self._keep(found, force=False)
            self._changed.notify_all()
            return self._summary(found, member)

    def wait(self, room: str, client: str, since: int, wait: float, roster: int = -1) -> dict:
        """The room's state once it is newer than `since` (or the people
        once they changed since `roster`), or - after `wait` seconds with
        nothing new - only the counts."""
        client = self._client(client)
        deadline = self._clock() + max(0.0, min(float(wait), MAX_WAIT))
        with self._changed:
            found = self._room(room)
            if found is None:
                raise LiveError(403, "Join the session first", rejoin=True)
            member = self._seen(found, client)
            if roster >= 0:
                active, pending = self._count(found, self._clock())
            while True:
                found = self._room(room)
                if found is None or found["members"].get(client) is not member:
                    raise LiveError(403, "Join the session first", rejoin=True)
                if member["status"] == "active" and found["version"] > since:
                    break
                if 0 <= roster < found["roster"]:
                    break
                if roster >= 0 and self._count(found, self._clock()) != (active, pending):
                    # Someone's last call is too long ago: gone.
                    found["roster"] += 1
                    break
                remaining = deadline - self._clock()
                if remaining <= 0:
                    break
                member["seen"] = self._clock()
                self._changed.wait(min(remaining, 5.0))
            member["seen"] = self._clock()
            answer = self._summary(found, member)
            if member["status"] == "active" and found["version"] > since and found["state"] is not None:
                answer["state"] = found["state"]
                answer["sender"] = found["sender"]
            return answer

    def manage(self, room: str, action: str, user=None, host_key=None, client=None, target=None, approval=None, value=None) -> dict:
        """The host's say: let someone in or not, close or open the room
        again, new people in at once or after a yes, a presentation (who
        leads), the passcode; signed in, the title and forgetting it."""
        if action not in ACTIONS:
            raise LiveError(400, "Unknown action")
        with self._changed:
            found = self._room_or_record(room)
            if found is None:
                raise LiveError(404, "No such session")
            if not self._is_host(found, user, host_key):
                raise LiveError(403, "Only the session's host can do this")
            if action == "forget":
                # Out of the history; the room itself goes on, nobody's.
                if not (user and user == found["owner"]):
                    raise LiveError(403, "Only the signed-in owner can forget a session")
                self._store.forget(room)
                found["owner"] = None
                return {"forgotten": True}
            if action in ("approve", "reject", "grant"):
                match = [(key, item) for key, item in found["members"].items() if item["id"] == target]
                if not match or match[0][1]["host"]:
                    raise LiveError(404, "No such person")
                key, member = match[0]
                if action == "grant":
                    member["lead"] = bool(value)
                elif action == "approve":
                    self._admit(found, key, member)
                else:
                    member["status"] = "rejected"
                    # Someone sent away would come straight back with a new
                    # viewer: from now on the host lets people in.
                    if found["approval"] == "auto":
                        found["approval"] = "manual"
            elif action == "close":
                found["closed"] = True
                found["closedAt"] = self._wall()
            elif action == "reopen":
                found["closed"] = False
                found.pop("closedAt", None)
            elif action == "approval":
                if approval not in APPROVALS:
                    raise LiveError(400, "approval must be auto or manual")
                found["approval"] = approval
                if approval == "auto":
                    for key, member in found["members"].items():
                        if member["status"] == "pending":
                            self._admit(found, key, member)
            elif action == "lead":
                if value not in LEADS:
                    raise LiveError(400, "lead must be all or host")
                found["lead"] = value
            elif action == "passcode":
                code = str(value or "").strip()
                if code and not MIN_PASSCODE <= len(code) <= MAX_PASSCODE:
                    raise LiveError(400, f"A passcode has {MIN_PASSCODE} to {MAX_PASSCODE} characters")
                found["passcode"] = _hash_passcode(room, code) if code else ""
            elif action == "title":
                found["title"] = normalize_nick(value, MAX_TITLE)
            found["roster"] += 1
            self._keep(found)
            self._changed.notify_all()
            member = found["members"].get(client) if client else None
            return self._summary(found, member if member and member["host"] else None)

    def owned(self, user: str) -> list:
        """A signed-in host's rooms, the one used last first."""
        with self._changed:
            now = self._clock()
            rooms = []
            for room, record in self._store.owned(user).items():
                found = self._rooms.get(room)
                active, pending = self._count(found, now) if found else (0, 0)
                rooms.append({
                    "id": room,
                    "title": (found or record).get("title") or "",
                    "createdAt": record.get("createdAt"),
                    "lastActiveAt": record.get("lastActiveAt"),
                    "closed": found["closed"] if found else bool(record.get("closed")),
                    "closedAt": (found or record).get("closedAt"),
                    "approval": found["approval"] if found else record.get("approval") or "auto",
                    "lead": found["lead"] if found else record.get("lead") or "all",
                    "passcode": bool(found["passcode"] if found else record.get("passcode")),
                    "participants": found["participantCount"] if found else int(record.get("participants") or 0),
                    "peak": found["peak"] if found else int(record.get("peak") or 0),
                    "active": active,
                    "pending": pending,
                })
            rooms.sort(key=lambda item: item["lastActiveAt"] or 0, reverse=True)
            return rooms
