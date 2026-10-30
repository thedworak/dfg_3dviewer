#!/usr/bin/env python3
"""Renders the preview images of a converted model (Blender + scripts/render.py
under xvfb-run) into <input dir>/views/."""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

from script_env import (
    BLENDER_MISSING, die, exclusive_lock, fmt_bool, load_env, parse_bool, resolve_blender_bin,
    resolve_spath, split_input,
)


def parse_args(argv):
    parser = argparse.ArgumentParser(prog="render_thumbnails.py", description="Render model thumbnails.")
    parser.add_argument("-i", "--input", default="", metavar="FILE", help="Original input model path.")
    parser.add_argument("-g", "--glb-input", default="", metavar="FILE", help="Optional explicit GLB path.")
    parser.add_argument("-a", "--archive", type=parse_bool, default=False, metavar="true|false")
    parser.add_argument("-d", "--device", default="", metavar="CPU|GPU|AUTO",
                        help="Render device (default: CPU, or $RENDER_DEVICE). GPU/AUTO fall back to CPU "
                             "silently if no GPU is found - see scripts/render.py's try_enable_gpu().")
    return parser.parse_args(argv)


def main(argv=None) -> int:
    args = parse_args(argv)
    load_env()
    spath = resolve_spath()

    if not args.input:
        die("No --input argument provided")
    if not Path(args.input).is_file():
        die(f"Input file not found: {args.input}")

    inpath, _, name, ext = split_input(args.input)
    ext = ext.lower()
    glb_input = args.glb_input or (f"{inpath}/{name}.glb" if ext == "glb" else f"{inpath}/gltf/{name}.glb")
    if not Path(glb_input).is_file():
        die(f"Render input not found: {glb_input}")

    views = Path(inpath, "views")
    views.mkdir(parents=True, exist_ok=True)
    with exclusive_lock(views / f"{name}.lock") as acquired:
        if not acquired:
            print(f"Render already running for {name}")
            return 0

        blender = resolve_blender_bin(spath)
        if not blender:
            print(BLENDER_MISSING)
            die("Blender validation failed")
        print("Blender exists and be used for next steps...")
        if not shutil.which("xvfb-run"):
            print("xvfb-run doesn't exist, install it by 'apt install xvfb'")
            die("xvfb-run validation failed")
        print("xvfb-run exists and be used for next steps...")
        if not (spath / "scripts").is_dir():
            print("Can't find dependencies directory. Did you change your SPATH value in scripts/.env?")
            die("Dependency scripts directory not found")

        resolution = os.environ.get("RENDER_RESOLUTION") or "1024x1024x16"
        samples = os.environ.get("RENDER_SAMPLES") or "20"
        device = args.device or os.environ.get("RENDER_DEVICE") or "CPU"

        print(f"Rendering thumbnails... (device: {device})", flush=True)
        result = subprocess.run([
            "xvfb-run", "--auto-servernum", f"--server-args=-screen 0 {resolution}",
            blender, "-b", "-P", str(spath / "scripts/render.py"), "--",
            "--input", glb_input,
            "--ext", "glb",
            "--org_ext", ext,
            "--output", f"{inpath}/views/",
            "--is_archive", fmt_bool(args.archive),
            "--resolution", resolution,
            "--samples", samples,
            "--hdri", str(spath / "scripts/maps/default.exr"),
            "--device", device,
            "-E", "BLENDER_EEVEE", "-f", "1",
        ])
        print(f"Blender exit code: {result.returncode}")
        return result.returncode


if __name__ == "__main__":
    sys.exit(main())
