"""Watches the server for the administrators (stdlib only): the disk
filling up, and the periodic summary mail.

A daemon thread started by server.py main() looks every CHECK_SECONDS:

  - disk: once the jobs volume is WORKER_DISK_WARN_PERCENT full (default
    85; 0 turns it off), the administrators get a mail - again a day later
    while it stays above. The admin pages show the same warning
    (GET /api/admin/summary, Statistics).

  - digest: WORKER_ADMIN_DIGEST=daily or weekly (default off) mails the
    administrators a summary - new accounts, those waiting, models
    uploaded and failed, open reports, the disk - every day, or every
    Monday, from WORKER_ADMIN_DIGEST_HOUR (default 8, the server's local
    time). It covers the time since the previous one; the first one comes
    a period after the worker starts with it on.

What was sent when is kept in JOBS_DIR/.admin/state.json, so a restart
does not send it again.
"""

import datetime
import json
import os
import shutil
import sys
import threading
import time
from pathlib import Path

CHECK_SECONDS = 600
DISK_WARNING_REPEAT = 24 * 3600
DIGEST_MODES = ("off", "daily", "weekly")


def digest_mode() -> str:
    mode = (os.environ.get("WORKER_ADMIN_DIGEST") or "off").strip().lower()
    return mode if mode in DIGEST_MODES else "off"


def digest_hour() -> int:
    try:
        return max(0, min(23, int(os.environ.get("WORKER_ADMIN_DIGEST_HOUR", "8"))))
    except ValueError:
        return 8


def digest_period_key(mode: str, now: float) -> str:
    """The day (daily) or ISO week (weekly) a digest belongs to."""
    local = time.localtime(now)
    if mode == "weekly":
        year, week, _ = datetime.date(local.tm_year, local.tm_mon, local.tm_mday).isocalendar()
        return f"{year}-W{week:02d}"
    return time.strftime("%Y-%m-%d", local)


def digest_due(mode: str, now: float, state: dict) -> bool:
    """Whether a digest is to be sent now; the first check only notes the
    period (state is updated by the caller after sending)."""
    if mode == "off":
        return False
    key = digest_period_key(mode, now)
    if "lastDigestKey" not in state:
        state["lastDigestKey"] = key
        state["lastDigestAt"] = int(now)
        return False
    return state["lastDigestKey"] != key and time.localtime(now).tm_hour >= digest_hour()


def disk_warn_percent() -> float:
    try:
        return float(os.environ.get("WORKER_DISK_WARN_PERCENT", "85"))
    except ValueError:
        return 85.0


def disk_usage(path: Path) -> dict:
    """{total, used, free, percent, warning} of the volume holding path."""
    try:
        usage = shutil.disk_usage(path)
    except OSError:
        return None
    percent = round(usage.used / usage.total * 100, 1) if usage.total else 0.0
    threshold = disk_warn_percent()
    return {
        "total": usage.total,
        "used": usage.used,
        "free": usage.free,
        "percent": percent,
        "warnPercent": threshold,
        "warning": bool(threshold) and percent >= threshold,
    }


class AdminWatch:
    def __init__(self, base_dir: Path, jobs_dir: Path, recipients, mailer, digest=None):
        """recipients(): the administrators' addresses; digest(since, now):
        the numbers of the summary mail (server.py admin_digest)."""
        self.state_path = Path(base_dir) / "state.json"
        self.jobs_dir = Path(jobs_dir)
        self.recipients = recipients
        self.mailer = mailer
        self.digest = digest
        self._lock = threading.Lock()

    def load_state(self) -> dict:
        try:
            return json.loads(self.state_path.read_text("utf-8"))
        except (OSError, ValueError):
            return {}

    def save_state(self, state: dict) -> None:
        try:
            self.state_path.parent.mkdir(parents=True, exist_ok=True)
            tmp = self.state_path.with_suffix(".tmp")
            tmp.write_text(json.dumps(state), "utf-8")
            os.replace(tmp, self.state_path)
        except OSError as exc:
            print(f"admin watch: could not save its state: {exc}", file=sys.stderr)

    def check(self, now: float = None) -> None:
        now = now or time.time()
        with self._lock:
            state = self.load_state()
            disk = disk_usage(self.jobs_dir)
            last_warning = state.get("lastDiskWarningAt")
            if disk and disk["warning"] and (last_warning is None or now - last_warning >= DISK_WARNING_REPEAT):
                recipients = self.recipients()
                if recipients and self.mailer.enabled():
                    self.mailer.send_disk_warning(disk, recipients, background=False)
                    state["lastDiskWarningAt"] = int(now)
            mode = digest_mode()
            if self.digest and digest_due(mode, now, state):
                recipients = self.recipients()
                if recipients and self.mailer.enabled():
                    since = state.get("lastDigestAt") or now - (7 if mode == "weekly" else 1) * 86400
                    self.mailer.send_admin_digest(self.digest(since, now), mode, recipients, background=False)
                state["lastDigestKey"] = digest_period_key(mode, now)
                state["lastDigestAt"] = int(now)
            self.save_state(state)

    def start(self) -> None:
        def loop() -> None:
            while True:
                try:
                    self.check()
                except Exception as exc:  # noqa: BLE001 - the watch never stops the worker
                    print(f"admin watch: {exc}", file=sys.stderr)
                time.sleep(CHECK_SECONDS)

        threading.Thread(target=loop, daemon=True, name="admin-watch").start()
