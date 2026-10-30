#!/usr/bin/env python3
"""Extracts a model archive and converts the models found directly in its root.

zip/tar/gz/xz are extracted with the standard library; rar needs `unrar`
(Ubuntu: apt install unrar-free) or `7z`.

usage: ./uncompress.py -t zip|rar|tar|gz|xz -i ARCHIVE -o OUTPUT_DIR/ [-n NAME] [-f true|false]
"""

from __future__ import annotations

import argparse
import glob
import shutil
import subprocess
import sys
import tarfile
import zipfile
from pathlib import Path

import convert
from script_env import die, load_env

CONVERTIBLE = ("abc", "blend", "dae", "fbx", "obj", "ply", "stl", "wrl", "x3d", "ifc")
TAR_MODES = {"tar": "r:", "gz": "r:gz", "xz": "r:xz"}


def parse_args(argv):
    parser = argparse.ArgumentParser(prog="uncompress.py", description="Extract and convert a model archive.")
    parser.add_argument("-t", dest="type", default="", help="Archive type: zip, rar, tar, gz, xz")
    parser.add_argument("-i", dest="input", default="", help="Input archive")
    parser.add_argument("-o", dest="output", default="", help="Output directory (with a trailing slash)")
    parser.add_argument("-n", dest="name", default="", help="Archive name (unused, kept for callers)")
    parser.add_argument("-f", dest="force", default="", help="Unused, kept for callers")
    return parser.parse_args(argv)


def extract_rar(archive: str, output: str) -> None:
    if shutil.which("unrar"):
        subprocess.run(["unrar", "x", "-o+", archive, output.rstrip("/") + "/"], check=True)
    elif shutil.which("7z"):
        subprocess.run(["7z", "x", "-y", f"-o{output}", archive], check=True)
    else:
        die("RAR extraction requires 'unrar' or '7z'")


def extract(archive_type: str, archive: str, output: str) -> None:
    if archive_type == "zip":
        with zipfile.ZipFile(archive) as zf:
            zf.extractall(output)
    elif archive_type in TAR_MODES:
        with tarfile.open(archive, TAR_MODES[archive_type]) as tf:
            if hasattr(tarfile, "data_filter"):
                tf.extractall(output, filter="data")
            else:
                tf.extractall(output)
    elif archive_type == "rar":
        extract_rar(archive, output)
    else:
        die(f"Unsupported archive type: {archive_type}")


def main(argv=None) -> int:
    args = parse_args(argv)
    load_env()
    if not args.type:
        die("Missing archive type (-t)")
    if not args.input:
        die("Missing input archive (-i)")
    if not args.output:
        die("Missing output directory (-o)")
    if not Path(args.input).is_file():
        die(f"Archive file not found: {args.input}")

    Path(args.output).mkdir(parents=True, exist_ok=True)
    try:
        extract(args.type.lower(), args.input, args.output)
    except (OSError, zipfile.BadZipFile, tarfile.TarError, subprocess.CalledProcessError) as e:
        die(f"Extraction of {args.input} failed: {e}")

    # Legacy archive layout: the model sits directly in the extraction root
    # ("<output>*", so -o needs its trailing slash) and is converted from here.
    for filename in sorted(glob.glob(glob.escape(args.output) + "*")):
        ext = filename.rpartition(".")[2].lower()
        if ext in CONVERTIBLE:
            code = convert.main(["-c", "true", "-l", "3", "-b", "true", "-i", filename,
                                 "-o", args.output, "-f", "true", "-a", "true"])
            if code != 0:
                return code
    return 0


if __name__ == "__main__":
    sys.exit(main())
