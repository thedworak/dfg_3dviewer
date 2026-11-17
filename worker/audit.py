"""What the administrators did, and when (stdlib only).

One JSON object a line in JOBS_DIR/.audit/log.jsonl (on the jobs volume,
the dot keeps it out of the job listing): {"at", "admin", "action",
"target", "details"}. Written by server.py's admin handlers and the admin
command line (admin "(command line)"), read by the admin pages' History
(GET /api/admin/audit, viewer/exadmin/sections/history.js).

Actions: approve, reject, disable, promote, demote, delete-user, plan,
limits, edit-model, delete-model, visibility, report.
"""

import json
import sys
import threading
import time
from pathlib import Path

CLI_ADMIN = "(command line)"


class AuditLog:
    def __init__(self, base_dir: Path):
        self.path = Path(base_dir) / "log.jsonl"
        self._lock = threading.Lock()

    def record(self, admin: str, action: str, target: str = "", details=None) -> None:
        """Best effort: a write that fails is logged, never fails the action."""
        entry = {"at": int(time.time()), "admin": admin, "action": action, "target": target or ""}
        if details:
            entry["details"] = details
        try:
            with self._lock:
                self.path.parent.mkdir(parents=True, exist_ok=True)
                with self.path.open("a", encoding="utf-8") as handle:
                    handle.write(json.dumps(entry, sort_keys=True) + "\n")
        except OSError as exc:
            print(f"audit: could not record {action} {target}: {exc}", file=sys.stderr)

    def entries(self, limit: int = 100, before: int = None, admin: str = None, action: str = None) -> list:
        """Newest first; `before` (an "at") pages further back."""
        try:
            lines = self.path.read_text("utf-8").splitlines()
        except OSError:
            return []
        result = []
        for line in reversed(lines):
            try:
                entry = json.loads(line)
            except ValueError:
                continue
            if before is not None and entry.get("at", 0) >= before:
                continue
            if admin and entry.get("admin") != admin:
                continue
            if action and entry.get("action") != action:
                continue
            result.append(entry)
            if len(result) >= limit:
                break
        return result
