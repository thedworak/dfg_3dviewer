#!/usr/bin/env python3
"""Builds the test bundle and runs the Playwright viewer tests; extra
arguments are passed on to `playwright test` (e.g. --grep @smoke)."""

import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent


def tool(name: str) -> str:
    # shutil.which also finds npm.cmd/npx.cmd on Windows.
    return shutil.which(name) or name


def main() -> int:
    os.chdir(ROOT_DIR)
    print("[local-tests] building test bundle", flush=True)
    subprocess.run([tool("npm"), "run", "build:test"], check=True)
    print("[local-tests] running Playwright viewer tests", flush=True)
    return subprocess.run(
        [tool("npx"), "playwright", "test", "tests/viewer.spec.ts", "--project", "chromium-webgl",
         "--workers=1", *sys.argv[1:]],
        env={**os.environ, "CI": "1"},
    ).returncode


if __name__ == "__main__":
    try:
        sys.exit(main())
    except subprocess.CalledProcessError as e:
        sys.exit(e.returncode)
