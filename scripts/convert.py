#!/usr/bin/env python3
"""Converts a 3D model to glTF/GLB with Blender (or IfcConvert for .ifc).

Ubuntu way
  apt install xvfb libxkbcommon0 blender python3-pip
  apt install python3-lxml python3-shapely python3-matplotlib (for CityGML converter)
  apt install libxi6 libgconf-2-4
OR Debian way
  wget https://ftp.halifax.rwth-aachen.de/blender/release/Blender4.4/blender-4.4.3-linux-x64.tar.xz
  tar -xvf blender-4.4.3-linux-x64.tar.xz
  change .env BLENDER_BIN or make symlink to it
  `ln -s PATH_TO_YOUR_UNCOMPRESSED_BLENDER/blender-4.4.3-linux64/blender /usr/local/bin/blender`
pip install numpy (or apt install python3-numpy), pip install triangle
apt install -y libxi6 libxrender1 libxrandr2 libxinerama1 libxcursor1 libxcomposite1 libxdamage1 \
  libxtst6 libglib2.0-0 libsm6 libice6 libgl1 libxkbcommon0

usage: ./convert.py -c COMPRESS -l COMPRESSION_LEVEL -i 'INPUT' -o 'OUTPUT' -b BINARY -f FORCE_OVERRIDE

Handled extensions: abc dae fbx obj ply stl wrl x3d usd usda usdc usdz (Blender importers via
2gltf2.py; the usd* ones need a Blender build with USD support, e.g. the official release), ifc,
blend, gml, glb (already GLB).
step/stp/iges/igs/3mf are NOT handled here: the standalone worker converts them with
scripts/convert_mesh.py (cascadio/trimesh).

TESTING:
  blender -b -P ./scripts/2gltf2/2gltf2.py -- --input "/opt/drupal/web/sites/default/files/{NAME}" \
    --ext glb --compression true --compression_level 3 --output "/opt/drupal/web/sites/default/files/test.glb"
"""

from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

from script_env import (
    BLENDER_MISSING, MODULE_ROOT, SCRIPT_DIR, die, exclusive_lock, fmt_bool, load_env,
    parse_bool, resolve_blender_bin, resolve_spath, split_input,
)

BLENDER_FORMATS = ("abc", "dae", "fbx", "obj", "ply", "stl", "wrl", "x3d", "usd", "usda", "usdc", "usdz")


def compression_level(value: str) -> str:
    if not re.fullmatch(r"[0-9]", value):
        raise argparse.ArgumentTypeError("compression-level must be 0–9")
    return value


def parse_args(argv):
    parser = argparse.ArgumentParser(prog="convert.py", description="Convert a 3D model to glTF/GLB.")
    parser.add_argument("-c", "--compression", type=parse_bool, default=False, metavar="true|false")
    parser.add_argument("-l", "--compression-level", type=compression_level, default="3", metavar="0-9")
    parser.add_argument("-i", "--input", default="", metavar="FILE")
    parser.add_argument("-o", "--output", default="", metavar="DIR")
    parser.add_argument("-b", "--binary", type=parse_bool, default=False, metavar="true|false",
                        help="true = glb, false = gltf")
    parser.add_argument("-f", "--force", type=parse_bool, default=False, metavar="true|false")
    parser.add_argument("-t", "--lightweight", type=parse_bool, default=False, metavar="true|false")
    parser.add_argument("-a", "--archive", type=parse_bool, default=False, metavar="true|false")
    return parser.parse_args(argv)


class Converter:
    def __init__(self, args, blender: str, spath: Path):
        self.args = args
        self.blender = blender
        self.spath = spath
        self.gltf = "glb" if args.binary else "gltf"

    def run(self, cmd, quiet: bool = False) -> None:
        subprocess.run([str(c) for c in cmd], check=True,
                       stdout=subprocess.DEVNULL if quiet else None,
                       stderr=subprocess.DEVNULL if quiet else None)

    def gltf2(self, input_path, output_path=None, quiet: bool = False) -> None:
        cmd = [self.blender, "-b", "-P", self.spath / "scripts/2gltf2/2gltf2.py", "--",
               "--input", input_path, "--ext", self.gltf,
               "--compression", fmt_bool(self.args.compression),
               "--compression_level", self.args.compression_level]
        if output_path:
            cmd += ["--output", output_path]
        self.run(cmd, quiet=quiet)

    def create_dirs(self, inpath: str) -> None:
        Path(inpath, "gltf").mkdir(parents=True, exist_ok=True)
        Path(inpath, "metadata").mkdir(parents=True, exist_ok=True)

    def handle_file(self, inpath, filename, name, output, outputpath) -> None:
        self.gltf2(f"{inpath}/{filename}", f"{output}{outputpath}" if outputpath else None)

    def handle_ifc_file(self, inpath, filename, name, output, outputpath) -> None:
        self.create_dirs(inpath)
        # Node names in the GLB = IFC GlobalIds, so they match the keys of the metadata JSON.
        self.run([self.spath / "scripts/IfcConvert", "--use-element-guids",
                  f"{inpath}/{filename}", f"{inpath}/gltf/{name}.glb"], quiet=True)
        # glTF cannot carry psets/quantities/relations: export them next to the GLB.
        # Best effort - a missing ifcopenshell must not fail the geometry conversion.
        subprocess.run([sys.executable, str(self.spath / "scripts/ifc_metadata.py"),
                        f"{inpath}/{filename}", f"{inpath}/metadata/{name}_ifc.json"],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    def handle_blend_file(self, inpath, filename, name, output, outputpath) -> None:
        self.create_dirs(inpath)
        self.run([self.blender, "-b", "-P", self.spath / "scripts/convert-blender-to-gltf.py", "--",
                  f"{inpath}/{filename}", f"{inpath}/gltf/{name}.glb"], quiet=True)

    def handle_gml_file(self, inpath, filename, name, output, outputpath) -> None:
        glb_path = Path(inpath, f"{name}_GLB")
        glb_path.mkdir(parents=True, exist_ok=True)
        shutil.copy2(f"{inpath}/{filename}", glb_path)
        self.run([sys.executable, self.spath / "scripts/CityGML2OBJv2/CityGML2OBJs.py",
                  "-i", glb_path, "-o", glb_path], quiet=True)
        self.create_dirs(inpath)
        self.gltf2(glb_path / f"{name}.obj", f"{inpath}/gltf/{name}.glb", quiet=True)
        shutil.rmtree(glb_path, ignore_errors=True)


def main(argv=None) -> int:
    args = parse_args(argv)
    load_env()
    spath = resolve_spath()
    blender = resolve_blender_bin(spath)
    if not blender:
        print(BLENDER_MISSING)
        return 1
    print("Blender exists and be used for next steps...")
    if not (spath / "scripts").is_dir():
        print(f"Can't find dependencies directory. Resolved SPATH={spath}. SCRIPT_DIR={SCRIPT_DIR}. "
              f"MODULE_ROOT={MODULE_ROOT}. Did you change your SPATH value in scripts/.env?")
        return 1

    converter = Converter(args, blender, spath)
    print()
    print("======== Parameters ========")
    print(f"  INPUT: {args.input}")
    print(f"  OUTPUT: {args.output}")
    print(f"  COMPRESSION: {fmt_bool(args.compression)}")
    print(f"  LEVEL: {args.compression_level}")
    print(f"  FORMAT: {converter.gltf}")
    print(f"  FORCE: {fmt_bool(args.force)}")
    print(f"  LIGHTWEIGHT: {fmt_bool(args.lightweight)}")
    print(f"  ARCHIVE: {fmt_bool(args.archive)}")
    print("===========================")
    print(flush=True)

    if not args.input:
        die("No --input argument provided")
    if not Path(args.input).is_file():
        print(f"Given file '{args.input}' not found")
        return 1

    inpath, filename, name, ext = split_input(args.input)
    if ext == filename:
        print(f"No extension found on {filename}")
        return 2
    ext = ext.lower()

    if not args.output:
        output, outputpath = f"{inpath}/gltf", ""
    else:
        # Archive extraction dirs (".../<name>_ZIP/") name the converted file.
        outfilename = args.output.rpartition("/")[0].rpartition("/")[2]
        outfilename = re.sub(r"_(ZIP|RAR|TAR|XZ|GZ)$", "", outfilename, flags=re.IGNORECASE)
        output, outputpath = f"{args.output}gltf/", f"{outfilename}.{converter.gltf}"
    Path(output).mkdir(parents=True, exist_ok=True)

    # No "output already exists" check: convert.sh's one never fired (it tested
    # the non-empty string "$FORCE"), so --force is accepted but conversion
    # always runs - callers rely on that.
    if ext == "glb":
        print("Given file was already compressed.")
        return 0
    handlers = {"ifc": converter.handle_ifc_file, "blend": converter.handle_blend_file,
                "gml": converter.handle_gml_file}
    handler = converter.handle_file if ext in BLENDER_FORMATS else handlers.get(ext)
    if handler is None:
        return 0

    start = time.time()
    with exclusive_lock(Path(inpath, f"{filename}.lock")) as acquired:
        if not acquired:
            print(f"Process already running for {filename}")
            return 0
        print(f"Converting {ext} file...", flush=True)
        try:
            handler(inpath, filename, name, output, outputpath)
        except subprocess.CalledProcessError as e:
            print(f"Conversion of {filename} failed: {e}", file=sys.stderr)
            return e.returncode or 1
    print(f"File {filename} compressed successfully. Runtime: {int(time.time() - start)}s.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
