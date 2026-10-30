"""Shared helpers for the pipeline scripts (convert.py, render_thumbnails.py,
uncompress.py): scripts/.env loading, Blender lookup, true/false flags and
the per-file locks that keep two runs from working on the same model."""

from __future__ import annotations

import argparse
import fcntl
import os
import shutil
import sys
from contextlib import contextmanager
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
MODULE_ROOT = SCRIPT_DIR.parent

BLENDER_MISSING = (
    "Blender doesn't exist, install it by 'apt install blender python3-pip' "
    "then 'pip install numpy' or set BLENDER_BIN in scripts/.env"
)


def load_env() -> None:
    """Loads scripts/.env (KEY=value lines, optionally quoted) into os.environ.
    Like the old `source scripts/.env`, its values win over the environment."""
    env_file = SCRIPT_DIR / ".env"
    if not env_file.is_file():
        return
    for raw in env_file.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        if line.startswith("export "):
            line = line[len("export "):]
        key, value = line.split("=", 1)
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "'\"":
            value = value[1:-1]
        elif " #" in value:
            value = value.split(" #", 1)[0].rstrip()
        os.environ[key.strip()] = value


def die(message: str, code: int = 1):
    print(f"Error: {message}", file=sys.stderr)
    sys.exit(code)


def parse_bool(value: str) -> bool:
    """argparse type for the true|false flags the PHP/worker callers pass."""
    if value not in ("true", "false"):
        raise argparse.ArgumentTypeError(f"Value must be true/false (is: {value})")
    return value == "true"


def fmt_bool(value: bool) -> str:
    return "true" if value else "false"


def resolve_spath() -> Path:
    """SPATH from the environment/.env, or the module root this file lives in."""
    spath = os.environ.get("SPATH") or str(MODULE_ROOT)
    if not (Path(spath) / "scripts").is_dir():
        return MODULE_ROOT
    return Path(spath)


def resolve_blender_bin(spath: Path) -> str | None:
    candidate = os.environ.get("BLENDER_BIN") or "blender"
    if os.path.isabs(candidate):
        return candidate if os.path.isfile(candidate) and os.access(candidate, os.X_OK) else None
    for base in (SCRIPT_DIR, spath):
        path = base / candidate
        if path.is_file() and os.access(path, os.X_OK):
            return str(path)
    return shutil.which(candidate)


def split_input(input_path: str):
    """(inpath, filename, name, ext) the way the old shell scripts split a path:
    ext is everything after the last dot (== filename when there is none)."""
    inpath, _, filename = input_path.rpartition("/")
    if not _:
        inpath = "."
    name = filename.rsplit(".", 1)[0] if "." in filename else filename
    ext = filename.rsplit(".", 1)[1] if "." in filename else filename
    return inpath, filename, name, ext


@contextmanager
def exclusive_lock(lock_path: Path):
    """Non-blocking flock on lock_path; yields False when another process holds
    it. The lock file is removed again once the holder is done."""
    handle = open(lock_path, "w")
    try:
        fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        handle.close()
        yield False
        return
    try:
        yield True
    finally:
        fcntl.flock(handle, fcntl.LOCK_UN)
        handle.close()
        lock_path.unlink(missing_ok=True)
