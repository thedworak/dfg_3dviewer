#!/usr/bin/env python3
"""Converts every file listed in scripts/convert_files.txt (one path per line,
# comments allowed) with convert.py, one after another, logging to
convert_<timestamp>.log in the current directory."""

from __future__ import annotations

import subprocess
import sys
import time
from datetime import datetime

from script_env import SCRIPT_DIR

FILES_LIST = SCRIPT_DIR / "convert_files.txt"


def main() -> int:
    if not FILES_LIST.is_file():
        print(f"Missing file: {FILES_LIST}")
        return 1
    files = [line for line in FILES_LIST.read_text(encoding="utf-8").splitlines()
             if line.strip() and not line.strip().startswith("#")]
    if not files:
        print("No files to process.")
        return 1

    log_path = f"convert_{datetime.now():%Y-%m-%d_%H-%M-%S}.log"
    with open(log_path, "a", encoding="utf-8") as log_file:
        def out(message: str = "", stamped: bool = False, to_log: bool = True) -> None:
            if stamped:
                message = f"[{datetime.now():%Y-%m-%d %H:%M:%S}] {message}"
            print(message, flush=True)
            if to_log:
                log_file.write(message + "\n")
                log_file.flush()

        out(f"Conversion started: {datetime.now():%c}")
        out(f"Log: {log_path}")
        out()

        success, failed = [], []
        for file in files:
            start = time.time()
            out(f"Start: {file}", stamped=True)
            proc = subprocess.Popen(
                [sys.executable, str(SCRIPT_DIR / "convert.py"), "--input", file, "--compression", "true",
                 "--compression-level", "3", "--binary", "true", "--force", "false"],
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, errors="replace",
            )
            for line in proc.stdout:
                out(line.rstrip("\n"))
            if proc.wait() == 0:
                out(f"OK: {file}", stamped=True)
                success.append(file)
            else:
                out(f"FAIL: {file}", stamped=True)
                failed.append(file)
            out(f"{int(time.time() - start)}s", stamped=True, to_log=False)
            out()

        out("================ SUMMARY ================")
        out(f"Success: {len(success)}", stamped=True)
        out(f"Errors: {len(failed)}", stamped=True)
        if failed:
            out("Failed files:")
            for file in failed:
                out(f" - {file}")
        out(f"End: {datetime.now():%c}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
