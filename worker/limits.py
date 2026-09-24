"""Upload limits for the standalone worker (stdlib only).

Four kinds of limit, all checked in POST /api/model/create before the upload
body is read (and again, atomically, right before the job is created):

  uploadsPerHour / uploadsPerDay  rolling-window upload counts
  storageMb / maxModels           disk space and number of models an account owns
  concurrentJobs                  the caller's own queued + running jobs

plus one global setting, WORKER_MAX_CONCURRENT_CONVERSIONS, the number of
Blender/OpenCASCADE conversions running at once - further jobs wait in the
"queued" status for a free slot (see conversion_slot()).

A value of 0 means unlimited. Defaults come from WORKER_LIMIT_* environment
variables; an admin can override any of them per account (stored as
"limits" in the account's users.json record, see auth.py). Admin accounts
are never limited.

With accounts off (WORKER_AUTH_MODE=off) uploads are keyed by client IP:
rate and concurrency limits still apply, storage/model quotas do not (there
is no owner to charge them to).

The upload log lives in JOBS_DIR/.limits/uploads.json, so rate limits
survive a restart and deleting a model does not give an upload back.
"""

import json
import os
import tempfile
import threading
import time
from contextlib import contextmanager
from pathlib import Path

LIMIT_KEYS = ("uploadsPerHour", "uploadsPerDay", "storageMb", "maxModels", "concurrentJobs")
HOUR = 3600
DAY = 24 * HOUR
MB = 1024 * 1024


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name, "").strip()
    if raw == "":
        return default
    try:
        return max(0, int(raw))
    except ValueError:
        raise ValueError(f"{name} must be a non-negative integer, got {raw!r}")


def default_limits() -> dict:
    return {
        "uploadsPerHour": _env_int("WORKER_LIMIT_UPLOADS_PER_HOUR", 20),
        "uploadsPerDay": _env_int("WORKER_LIMIT_UPLOADS_PER_DAY", 100),
        "storageMb": _env_int("WORKER_LIMIT_STORAGE_MB", 0),
        "maxModels": _env_int("WORKER_LIMIT_MAX_MODELS", 0),
        "concurrentJobs": _env_int("WORKER_LIMIT_CONCURRENT_JOBS", 1),
    }


def normalize_overrides(raw) -> dict:
    """Validates a per-account override object: known keys only, each a
    non-negative integer, or None to fall back to the default."""
    if not isinstance(raw, dict):
        raise ValueError("Limits must be a JSON object")
    result = {}
    for key, value in raw.items():
        if key not in LIMIT_KEYS:
            raise ValueError(f"Unknown limit: {key}")
        if value is None or value == "":
            result[key] = None
            continue
        if isinstance(value, bool) or not isinstance(value, (int, float, str)):
            raise ValueError(f"{key} must be a non-negative integer")
        try:
            number = int(value)
        except ValueError:
            raise ValueError(f"{key} must be a non-negative integer")
        if number < 0 or number != float(value):
            raise ValueError(f"{key} must be a non-negative integer")
        result[key] = number
    return result


class LimitError(Exception):
    def __init__(self, status: int, code: str, message: str, retry_after: int = 0, limit: int = 0):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.retry_after = retry_after
        self.limit = limit

    def payload(self) -> dict:
        data = {"error": self.message, "code": self.code, "limit": self.limit}
        if self.retry_after:
            data["retryAfter"] = self.retry_after
        return data


def _dir_size(path: Path) -> int:
    total = 0
    for root, _dirs, files in os.walk(path):
        for name in files:
            try:
                total += os.lstat(os.path.join(root, name)).st_size
            except OSError:
                pass
    return total


class Limits:
    def __init__(self, jobs_dir: Path, job_id_re, max_concurrent_conversions: int):
        self.jobs_dir = Path(jobs_dir)
        self.job_id_re = job_id_re
        self.log_path = self.jobs_dir / ".limits" / "uploads.json"
        self._lock = threading.Lock()
        self._log = None  # key -> [timestamps], loaded lazily
        self.max_concurrent_conversions = max_concurrent_conversions
        self._slots = (
            threading.BoundedSemaphore(max_concurrent_conversions) if max_concurrent_conversions > 0 else None
        )

    # ---- identity --------------------------------------------------------

    @staticmethod
    def key_for(user, client_ip: str) -> str:
        if user and user.get("username"):
            return f"user:{user['username']}"
        return f"ip:{client_ip or 'unknown'}"

    @staticmethod
    def effective_limits(user, overrides=None) -> dict:
        """Admins are unlimited; everyone else gets the defaults with the
        account's own overrides applied."""
        if user and user.get("role") == "admin":
            return {key: 0 for key in LIMIT_KEYS}
        limits = default_limits()
        for key, value in (overrides or {}).items():
            if key in LIMIT_KEYS and value is not None:
                limits[key] = int(value)
        return limits

    # ---- upload log ------------------------------------------------------

    def _load_log(self) -> dict:
        if self._log is None:
            try:
                data = json.loads(self.log_path.read_text("utf-8"))
                self._log = {k: [float(t) for t in v] for k, v in data.items() if isinstance(v, list)}
            except (OSError, ValueError, TypeError):
                self._log = {}
        return self._log

    def _save_log(self) -> None:
        self.log_path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=self.log_path.parent, prefix=".uploads-")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                json.dump(self._log, handle)
            os.replace(tmp, self.log_path)
        except BaseException:
            try:
                os.unlink(tmp)
            except OSError:
                pass
            raise

    def _recent_uploads(self, key: str, now: float) -> list:
        log = self._load_log()
        recent = [stamp for stamp in log.get(key, []) if stamp > now - DAY]
        if recent:
            log[key] = recent
        else:
            log.pop(key, None)
        return recent

    # ---- usage -----------------------------------------------------------

    def owned_storage(self, username: str):
        """(bytes on disk, number of models) of the jobs owned by username."""
        total, count = 0, 0
        if not username or not self.jobs_dir.is_dir():
            return total, count
        for job_dir in self.jobs_dir.iterdir():
            if not job_dir.is_dir() or not self.job_id_re.fullmatch(job_dir.name):
                continue
            try:
                owner = json.loads((job_dir / "owner.json").read_text("utf-8"))
            except (OSError, ValueError):
                continue
            if owner.get("user") != username:
                continue
            total += _dir_size(job_dir)
            count += 1
        return total, count

    def usage(self, key: str, username, active_jobs: int) -> dict:
        now = time.time()
        with self._lock:
            recent = self._recent_uploads(key, now)
        storage_bytes, models = self.owned_storage(username)
        return {
            "uploadsLastHour": sum(1 for stamp in recent if stamp > now - HOUR),
            "uploadsLastDay": len(recent),
            "storageBytes": storage_bytes,
            "models": models,
            "activeJobs": active_jobs,
        }

    # ---- checks ----------------------------------------------------------

    def _check_rate(self, key: str, limits: dict, now: float) -> None:
        recent = self._recent_uploads(key, now)
        for limit_key, window, code, label in (
            ("uploadsPerHour", HOUR, "rate_hour", "hour"),
            ("uploadsPerDay", DAY, "rate_day", "day"),
        ):
            limit = limits[limit_key]
            if not limit:
                continue
            in_window = sorted(stamp for stamp in recent if stamp > now - window)
            if len(in_window) >= limit:
                # The oldest upload in the window has to age out first.
                retry_after = max(1, int(in_window[-limit] + window - now) + 1)
                raise LimitError(
                    429, code,
                    f"Upload limit reached: {limit} uploads per {label}. Try again in {(retry_after + 59) // 60} min.",
                    retry_after=retry_after, limit=limit,
                )

    @staticmethod
    def _check_concurrency(limits: dict, active_jobs: int) -> None:
        limit = limits["concurrentJobs"]
        if limit and active_jobs >= limit:
            raise LimitError(
                429, "concurrent",
                f"You already have {active_jobs} model(s) being converted. Wait until they finish.",
                retry_after=30, limit=limit,
            )

    def _check_quota(self, username, limits: dict, incoming_bytes: int) -> None:
        if not username or not (limits["storageMb"] or limits["maxModels"]):
            return
        storage_bytes, models = self.owned_storage(username)
        if limits["maxModels"] and models >= limits["maxModels"]:
            raise LimitError(
                507, "models",
                f"Model limit reached: {limits['maxModels']} models. Delete a model to upload a new one.",
                limit=limits["maxModels"],
            )
        if limits["storageMb"] and storage_bytes + incoming_bytes > limits["storageMb"] * MB:
            raise LimitError(
                507, "storage",
                f"Storage limit reached: {limits['storageMb']} MB. Delete a model to free space.",
                limit=limits["storageMb"],
            )

    def check(self, key: str, username, limits: dict, incoming_bytes: int, active_jobs: int) -> None:
        """Raises LimitError when this upload is not allowed. Records nothing."""
        with self._lock:
            self._check_rate(key, limits, time.time())
        self._check_concurrency(limits, active_jobs)
        self._check_quota(username, limits, incoming_bytes)

    def reserve(self, key: str, username, limits: dict, incoming_bytes: int, active_jobs_fn, create_job):
        """Re-checks every limit and records the upload in one locked step,
        so parallel requests cannot all slip under the same limit, then
        returns create_job()'s result. active_jobs_fn is evaluated inside the
        lock for the same reason."""
        with self._lock:
            now = time.time()
            self._check_rate(key, limits, now)
            self._check_concurrency(limits, active_jobs_fn())
            self._check_quota(username, limits, incoming_bytes)
            result = create_job()
            self._recent_uploads(key, now)
            self._load_log().setdefault(key, []).append(now)
            try:
                self._save_log()
            except OSError:
                pass  # the in-memory log still enforces the limit until restart
            return result

    # ---- conversion slots -----------------------------------------------

    @contextmanager
    def conversion_slot(self, on_wait=None):
        """Holds one of the WORKER_MAX_CONCURRENT_CONVERSIONS slots for the
        duration of the block; calls on_wait() once if it has to queue."""
        if self._slots is None:
            yield
            return
        if not self._slots.acquire(blocking=False):
            if on_wait:
                on_wait()
            self._slots.acquire()
        try:
            yield
        finally:
            self._slots.release()
