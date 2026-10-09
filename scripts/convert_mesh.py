#!/usr/bin/env python3
"""Converts formats Blender can't import to GLB, without Blender.

  STEP/STP, IGES/IGS   B-rep CAD, tessellated with OpenCASCADE (cascadio)
  3MF                  3D-printing container, read with trimesh

Usage: convert_mesh.py -i model.step -o gltf/model.glb [--tol-linear 0.01]

Exit code 0 only when a non-empty GLB was written. Called by
worker/server.py for these extensions (scripts/convert.sh handles the
Blender-importable ones); the worker image installs cascadio and trimesh (see
worker/Dockerfile).
"""

import argparse
import sys
from pathlib import Path

CAD_FORMATS = {"step": "step", "stp": "step", "iges": "iges", "igs": "iges"}
MESH_FORMATS = {"3mf"}
SUPPORTED = set(CAD_FORMATS) | MESH_FORMATS


def convert_cad(source: Path, kind: str, tol_linear: float) -> bytes:
    import cascadio  # noqa: PLC0415 - heavy import, only when needed

    file_type = cascadio.FileType.STEP if kind == "step" else cascadio.FileType.IGES
    # tol_relative: tolerance scales with the part instead of being absolute,
    # so both tiny and huge assemblies get a sensible tessellation.
    return cascadio.to_glb_bytes(
        source.read_bytes(), file_type=file_type, tol_linear=tol_linear, tol_relative=True
    )


def convert_mesh(source: Path) -> bytes:
    import trimesh  # noqa: PLC0415

    scene = trimesh.load(str(source), force="scene")
    if len(scene.geometry) == 0:
        return b""
    return scene.export(file_type="glb")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("-i", "--input", required=True, type=Path)
    parser.add_argument("-o", "--output", required=True, type=Path)
    parser.add_argument("--tol-linear", type=float, default=0.01,
                        help="CAD tessellation tolerance (relative to part size, default 0.01)")
    args = parser.parse_args()

    ext = args.input.suffix.lower().lstrip(".")
    if ext not in SUPPORTED:
        print(f"Unsupported format: .{ext}", file=sys.stderr)
        return 2
    if not args.input.is_file():
        print(f"Input not found: {args.input}", file=sys.stderr)
        return 2

    data = convert_cad(args.input, CAD_FORMATS[ext], args.tol_linear) if ext in CAD_FORMATS else convert_mesh(args.input)
    if not data:
        print(f"Conversion produced no geometry for {args.input.name} (empty or invalid file?)", file=sys.stderr)
        return 1

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(data)
    print(f"Wrote {args.output} ({len(data)} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
