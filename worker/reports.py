"""Reports of objectionable models (stdlib only).

Anyone who sees a model in the list can report it (POST
/api/jobs/<id>/report): the App Store's guideline 1.2 asks apps with
user-generated content for a way to report it, and for the operator to act
on reports within 24 hours. A report is stored, mailed to the moderators
(WORKER_REPORTS_EMAIL, see mailer.py) and listed in the admin panel (GET
/api/admin/reports), where an admin dismisses it, removes the model or
disables its uploader (POST /api/admin/reports/<id>).

A model reported by WORKER_REPORT_HIDE_THRESHOLD different people (default
3; 0 = never) leaves the list for everyone but its owner and admins until an
admin decides - so a clearly objectionable model disappears even before a
moderator gets to it. Its files stay where they are.

Storage: JOBS_DIR/.reports/reports.json (a dot directory, so the job listing
skips it), on the same volume as the jobs.
"""

import json
import os
import secrets
import tempfile
import threading
import time
from pathlib import Path

REASONS = ("offensive", "sexual", "violence", "hate", "copyright", "spam", "other")
ACTIONS = ("dismiss", "remove-model", "disable-user")
MAX_DETAILS = 1000
# Per reporter (account, app user or IP), rolling hour, in memory.
MAX_REPORTS_PER_HOUR = 20


def _env_int(name: str, default: int) -> int:
    try:
        return max(0, int(os.environ.get(name, str(default))))
    except ValueError:
        return default


class ReportError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


class ReportStore:
    def __init__(self, base_dir: Path, hide_threshold: int = None):
        self.dir = Path(base_dir)
        self.path = self.dir / "reports.json"
        self.hide_threshold = (
            _env_int("WORKER_REPORT_HIDE_THRESHOLD", 3) if hide_threshold is None else hide_threshold
        )
        self._lock = threading.Lock()
        self._recent = {}  # reporter key -> [timestamps]

    # ---- storage -------------------------------------------------------

    def _load(self) -> list:
        try:
            data = json.loads(self.path.read_text("utf-8"))
            return data if isinstance(data, list) else []
        except (OSError, ValueError):
            return []

    def _save(self, reports: list) -> None:
        self.dir.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=self.dir, prefix=".reports-")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                json.dump(reports, handle, indent=2)
            os.chmod(tmp, 0o600)
            os.replace(tmp, self.path)
        except BaseException:
            try:
                os.unlink(tmp)
            except OSError:
                pass
            raise

    # ---- reporting -----------------------------------------------------

    def _check_rate(self, reporter: str) -> None:
        now = time.time()
        recent = [stamp for stamp in self._recent.get(reporter, []) if now - stamp < 3600]
        if len(recent) >= MAX_REPORTS_PER_HOUR:
            raise ReportError(429, "Too many reports. Try again later.")
        recent.append(now)
        self._recent[reporter] = recent

    def add(self, job_id: str, owner, reporter: str, reporter_user, reason: str, details: str = "") -> dict:
        """Stores a report. The same reporter reporting the same model again
        updates their open report instead of adding another one."""
        if reason not in REASONS:
            raise ReportError(400, f"reason must be one of {', '.join(REASONS)}")
        if not isinstance(details, str):
            details = ""
        details = details.strip()[:MAX_DETAILS]
        with self._lock:
            self._check_rate(reporter)
            reports = self._load()
            existing = next((r for r in reports if r["jobId"] == job_id and r["reporter"] == reporter
                             and r["status"] == "open"), None)
            if existing:
                existing.update(reason=reason, details=details, updatedAt=int(time.time()))
                report = existing
            else:
                report = {
                    "id": secrets.token_hex(8),
                    "jobId": job_id,
                    "owner": owner,
                    "reporter": reporter,
                    "reporterUser": reporter_user,
                    "reason": reason,
                    "details": details,
                    "status": "open",
                    "createdAt": int(time.time()),
                }
                reports.append(report)
            self._save(reports)
            return dict(report)

    # ---- moderation ----------------------------------------------------

    def list(self, status: str = None) -> list:
        reports = self._load()
        if status:
            reports = [r for r in reports if r["status"] == status]
        return sorted(reports, key=lambda r: r["createdAt"], reverse=True)

    def get(self, report_id: str):
        return next((r for r in self._load() if r["id"] == report_id), None)

    def resolve(self, report_id: str, action: str, admin: str) -> dict:
        """Closes a report and every other open report of the same model
        (the decision is about the model). Returns the report."""
        if action not in ACTIONS:
            raise ReportError(400, f"action must be one of {', '.join(ACTIONS)}")
        with self._lock:
            reports = self._load()
            report = next((r for r in reports if r["id"] == report_id), None)
            if report is None:
                raise ReportError(404, "No such report.")
            now = int(time.time())
            for other in reports:
                if other["jobId"] == report["jobId"] and other["status"] == "open":
                    other.update(status="resolved", action=action, resolvedBy=admin, resolvedAt=now)
            self._save(reports)
            return dict(report)

    def hidden_jobs(self) -> set:
        """Models with open reports from at least hide_threshold different
        reporters: out of the list until an admin decides."""
        if not self.hide_threshold:
            return set()
        reporters = {}
        for report in self._load():
            if report["status"] == "open":
                reporters.setdefault(report["jobId"], set()).add(report["reporter"])
        return {job_id for job_id, who in reporters.items() if len(who) >= self.hide_threshold}

    def open_counts(self) -> dict:
        counts = {}
        for report in self._load():
            if report["status"] == "open":
                counts[report["jobId"]] = counts.get(report["jobId"], 0) + 1
        return counts

    def forget_reporter_user(self, username: str) -> None:
        """A deleted account: its name leaves the reports it sent (the
        reports themselves stay, for the moderators)."""
        with self._lock:
            reports = self._load()
            changed = False
            for report in reports:
                if report.get("reporterUser") == username:
                    report["reporterUser"] = None
                    report["reporter"] = f"deleted:{report['id']}"
                    changed = True
            if changed:
                self._save(reports)
