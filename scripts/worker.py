#!/usr/bin/env python3
"""Drupal-side queue worker: runs `drush queue:run dfg_3dviewer_convert` in a
loop, timestamping its output into /opt/drupal/dfg3dworker.log. A PID file
keeps a second instance from starting."""

from __future__ import annotations

import atexit
import os
import signal
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

LOG = Path("/opt/drupal/dfg3dworker.log")
PID_FILE = Path("/opt/drupal/dfg3dworker.pid")
DRUPAL_SITE_URI = os.environ.get("DRUPAL_SITE_URI", "https://repository.covher.eu")
DRUSH_BIN = os.environ.get("DRUSH_BIN", "/opt/drupal/vendor/bin/drush")
MAX_LOG_SIZE = 50_000_000


def stamp() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def log(message: str) -> None:
    with open(LOG, "a", encoding="utf-8") as fh:
        fh.write(f"{stamp()} {message}\n")


def is_pid_running(pid: str) -> bool:
    if not pid.isdigit():
        return False
    try:
        os.kill(int(pid), 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def main() -> int:
    if LOG.is_file() and LOG.stat().st_size > MAX_LOG_SIZE:
        LOG.replace(LOG.with_name(LOG.name + ".old"))

    if PID_FILE.is_file():
        existing = PID_FILE.read_text().strip()
        if is_pid_running(existing):
            log(f"Worker already running with PID {existing}, exiting")
            return 0
        PID_FILE.unlink(missing_ok=True)
        log("Removed stale PID file")

    PID_FILE.write_text(f"{os.getpid()}\n")
    atexit.register(lambda: PID_FILE.unlink(missing_ok=True))
    # atexit only runs on a normal interpreter exit, so turn SIGTERM into one.
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
    log("Worker started")

    while True:
        log("Run started")
        proc = subprocess.Popen(
            [DRUSH_BIN, f"--uri={DRUPAL_SITE_URI}", "queue:run", "dfg_3dviewer_convert", "--time-limit=3600"],
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, errors="replace",
        )
        with open(LOG, "a", encoding="utf-8") as fh:
            for line in proc.stdout:
                fh.write(f"{stamp()} {line}")
                fh.flush()
        proc.wait()
        time.sleep(5)


if __name__ == "__main__":
    sys.exit(main())
