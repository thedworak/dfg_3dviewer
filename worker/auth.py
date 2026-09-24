"""Optional accounts for the standalone worker (stdlib only).

Off by default (WORKER_AUTH_MODE=off keeps the worker's original, open
behavior). With WORKER_AUTH_MODE=required, uploading and deleting need a
logged-in account; browsing/serving finished models stays public so shared
portfolio links keep working.

Storage lives next to the jobs (JOBS_DIR/.auth/, on the same persistent
volume; the dot prefix keeps it out of the job listing):

  users.json  accounts (scrypt password hashes, role, status)
  secret      HMAC key for session tokens (or WORKER_AUTH_SECRET)

Sessions are stateless signed tokens in an HttpOnly cookie, so they survive a
worker restart, and are re-checked against users.json on every request, so
disabling an account takes effect immediately.

Supervision is done from the command line inside the container - there is
deliberately no admin HTTP API to attack:

  docker compose exec worker python3 /app/worker/server.py admin users
"""

import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import tempfile
import threading
import time
from pathlib import Path

USERNAME_RE = re.compile(r"[A-Za-z0-9_.-]{3,32}")
# Sanity check, not full RFC 5322 validation - just enough to catch typos and
# empty submissions before the address is stored.
EMAIL_RE = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")
MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 256
COOKIE_NAME = "dfg3d_session"
SESSION_TTL = int(os.environ.get("WORKER_AUTH_SESSION_TTL", str(7 * 24 * 3600)))
MAX_FAILED_LOGINS = 5
LOCKOUT_SECONDS = 300

MODES = ("off", "required")
REGISTRATION_MODES = ("open", "approval", "closed")
STATUSES = ("active", "pending", "disabled")
ROLES = ("user", "admin")


class AuthError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def _hash_password(password: str, salt: bytes = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2 ** 14, r=8, p=1, dklen=32)
    return f"scrypt${salt.hex()}${digest.hex()}"


def _verify_password(password: str, stored: str) -> bool:
    try:
        scheme, salt_hex, digest_hex = stored.split("$")
        if scheme != "scrypt":
            return False
        candidate = _hash_password(password, bytes.fromhex(salt_hex)).split("$")[2]
        return hmac.compare_digest(candidate, digest_hex)
    except (ValueError, TypeError):
        return False


# Verified against when the username doesn't exist, so a missing account
# costs the same time as a wrong password.
_DUMMY_HASH = _hash_password("dummy-password-for-timing")


class AuthStore:
    def __init__(self, base_dir: Path, mode: str = "off", registration: str = "approval", secret: str = ""):
        if mode not in MODES:
            raise ValueError(f"WORKER_AUTH_MODE must be one of {MODES}, got {mode!r}")
        if registration not in REGISTRATION_MODES:
            raise ValueError(f"WORKER_AUTH_REGISTRATION must be one of {REGISTRATION_MODES}, got {registration!r}")
        self.mode = mode
        self.registration = registration
        self.dir = Path(base_dir)
        self.users_path = self.dir / "users.json"
        self._lock = threading.Lock()
        self._failures = {}  # username -> (count, locked_until)
        self._secret = secret.encode("utf-8") if secret else None

    @property
    def enabled(self) -> bool:
        return self.mode == "required"

    # ---- storage -------------------------------------------------------

    def _ensure_dir(self) -> None:
        self.dir.mkdir(parents=True, exist_ok=True)

    def _load(self) -> dict:
        try:
            return json.loads(self.users_path.read_text("utf-8"))
        except FileNotFoundError:
            return {}

    def _save(self, users: dict) -> None:
        self._ensure_dir()
        fd, tmp = tempfile.mkstemp(dir=self.dir, prefix=".users-")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                json.dump(users, handle, indent=2, sort_keys=True)
            os.chmod(tmp, 0o600)
            os.replace(tmp, self.users_path)
        except BaseException:
            try:
                os.unlink(tmp)
            except OSError:
                pass
            raise

    def _key(self) -> bytes:
        if self._secret:
            return self._secret
        secret_path = self.dir / "secret"
        with self._lock:
            if not secret_path.is_file():
                self._ensure_dir()
                secret_path.write_text(secrets.token_hex(32), "utf-8")
                os.chmod(secret_path, 0o600)
            self._secret = secret_path.read_text("utf-8").strip().encode("utf-8")
        return self._secret

    # ---- validation ----------------------------------------------------

    @staticmethod
    def _validate_credentials(username: str, password: str) -> None:
        if not isinstance(username, str) or not USERNAME_RE.fullmatch(username):
            raise AuthError(400, "Username must be 3-32 characters: letters, digits, '.', '_' or '-'.")
        if not isinstance(password, str) or not (MIN_PASSWORD_LENGTH <= len(password) <= MAX_PASSWORD_LENGTH):
            raise AuthError(400, f"Password must be {MIN_PASSWORD_LENGTH}-{MAX_PASSWORD_LENGTH} characters.")

    @staticmethod
    def _validate_email(email: str) -> None:
        if not isinstance(email, str) or not EMAIL_RE.fullmatch(email.strip()):
            raise AuthError(400, "A valid email address is required.")

    # ---- accounts ------------------------------------------------------

    def register(self, username: str, password: str, email: str) -> dict:
        if not self.enabled:
            raise AuthError(404, "Accounts are not enabled.")
        if self.registration == "closed":
            raise AuthError(403, "Registration is closed.")
        self._validate_credentials(username, password)
        self._validate_email(email)
        password_hash = _hash_password(password)
        with self._lock:
            users = self._load()
            if username.lower() in {name.lower() for name in users}:
                raise AuthError(409, "That username is taken.")
            status = "active" if self.registration == "open" else "pending"
            users[username] = {
                "passwordHash": password_hash,
                "email": email.strip(),
                "role": "user",
                "status": status,
                "createdAt": int(time.time()),
            }
            self._save(users)
        return {"username": username, "status": status}

    def ensure_admin(self, username: str, password: str) -> None:
        """Creates or resets the bootstrap admin (WORKER_ADMIN_USER/PASSWORD)."""
        self._validate_credentials(username, password)
        with self._lock:
            users = self._load()
            existing = users.get(username, {})
            users[username] = {
                "passwordHash": _hash_password(password),
                "role": "admin",
                "status": "active",
                "createdAt": existing.get("createdAt", int(time.time())),
            }
            self._save(users)

    def login(self, username: str, password: str) -> dict:
        if not self.enabled:
            raise AuthError(404, "Accounts are not enabled.")
        key = str(username).lower()
        count, locked_until = self._failures.get(key, (0, 0))
        if locked_until > time.time():
            raise AuthError(429, "Too many failed attempts. Try again in a few minutes.")

        users = self._load()
        match = next((name for name in users if name.lower() == key), None)
        record = users.get(match) if match else None
        valid = _verify_password(str(password), record["passwordHash"] if record else _DUMMY_HASH)
        if not (record and valid):
            count += 1
            self._failures[key] = (count, time.time() + LOCKOUT_SECONDS if count >= MAX_FAILED_LOGINS else 0)
            raise AuthError(401, "Invalid username or password.")

        self._failures.pop(key, None)
        if record["status"] == "pending":
            raise AuthError(403, "Your account is waiting for approval.")
        if record["status"] != "active":
            raise AuthError(403, "This account is disabled.")
        return {"username": match, "role": record["role"]}

    # ---- sessions ------------------------------------------------------

    def issue_token(self, username: str) -> str:
        payload = base64.urlsafe_b64encode(
            json.dumps({"u": username, "exp": int(time.time()) + SESSION_TTL}).encode("utf-8")
        ).decode("ascii")
        signature = hmac.new(self._key(), payload.encode("ascii"), hashlib.sha256).hexdigest()
        return f"{payload}.{signature}"

    def user_from_cookie_header(self, cookie_header: str):
        """Returns {"username", "role"} for a valid, unexpired session of an
        active account, else None."""
        if not self.enabled or not cookie_header:
            return None
        token = None
        for part in cookie_header.split(";"):
            name, _, value = part.strip().partition("=")
            if name == COOKIE_NAME:
                token = value
        if not token or "." not in token:
            return None
        payload, _, signature = token.rpartition(".")
        expected = hmac.new(self._key(), payload.encode("ascii", "ignore"), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            return None
        try:
            data = json.loads(base64.urlsafe_b64decode(payload.encode("ascii")))
            username, expires = data["u"], int(data["exp"])
        except (ValueError, KeyError, TypeError):
            return None
        if expires < time.time():
            return None
        record = self._load().get(username)
        if not record or record["status"] != "active":
            return None
        return {"username": username, "role": record["role"]}

    def cookie_header(self, token: str, secure: bool, clear: bool = False) -> str:
        parts = [f"{COOKIE_NAME}={'' if clear else token}", "Path=/", "HttpOnly", "SameSite=Lax",
                 f"Max-Age={0 if clear else SESSION_TTL}"]
        if secure:
            parts.append("Secure")
        return "; ".join(parts)

    # ---- administration (CLI) -----------------------------------------

    def list_users(self) -> list:
        return [
            {
                "username": name,
                "email": rec.get("email", ""),
                "role": rec["role"],
                "status": rec["status"],
                "createdAt": rec.get("createdAt", 0),
                "limits": rec.get("limits", {}),
            }
            for name, rec in sorted(self._load().items())
        ]

    def get_limits(self, username: str) -> dict:
        """Per-account limit overrides (see limits.py); {} = defaults."""
        record = self._load().get(username) or {}
        return dict(record.get("limits") or {})

    def set_limits(self, username: str, overrides: dict) -> dict:
        """Merges validated overrides (limits.normalize_overrides) into the
        account; a None value removes that override. Returns the result."""
        with self._lock:
            users = self._load()
            if username not in users:
                raise AuthError(404, f"No such user: {username}")
            limits = dict(users[username].get("limits") or {})
            for key, value in overrides.items():
                if value is None:
                    limits.pop(key, None)
                else:
                    limits[key] = value
            if limits:
                users[username]["limits"] = limits
            else:
                users[username].pop("limits", None)
            self._save(users)
            return limits

    def update_user(self, username: str, **changes) -> None:
        with self._lock:
            users = self._load()
            if username not in users:
                raise AuthError(404, f"No such user: {username}")
            if "status" in changes and changes["status"] not in STATUSES:
                raise AuthError(400, f"status must be one of {STATUSES}")
            if "role" in changes and changes["role"] not in ROLES:
                raise AuthError(400, f"role must be one of {ROLES}")
            users[username].update(changes)
            self._save(users)

    def approve_user(self, username: str):
        """Sets the account active. Returns {"username", "email"} when this
        moved it out of *pending* (i.e. a first-time approval worth telling
        the user about), else None - re-enabling a disabled account is silent."""
        with self._lock:
            users = self._load()
            record = users.get(username)
            if record is None:
                raise AuthError(404, f"No such user: {username}")
            was_pending = record.get("status") == "pending"
            record["status"] = "active"
            self._save(users)
        if was_pending and record.get("email"):
            return {"username": username, "email": record["email"]}
        return None

    def delete_user(self, username: str) -> None:
        with self._lock:
            users = self._load()
            if users.pop(username, None) is None:
                raise AuthError(404, f"No such user: {username}")
            self._save(users)
