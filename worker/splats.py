"""Gaussian splats -> Spark's .rad level-of-detail files, for the standalone worker.

Uploaded splat captures (.spz .splat .ksplat .sog and a .ply of splats) are
usually a million splats and more. The viewer draws them with Spark
(viewer/splats.js), which renders a budget of them per frame from a
level-of-detail tree: near splats in full, merged ones further away. Spark
can build that tree in the browser on every load, or read it ready-made from
a .rad file, Spark's own format, written by its build-lod tool (Rust, from
the Spark repository, built into the Docker image by Dockerfile.base). Here
each upload is turned into one: <name>-lod.rad next to it, built with the
"quality" method (bhatt-lod), which looks better than the quick one the
browser uses. The upload stays in the job folder as it was.

Without build-lod, or when it fails, the upload is served as it is and the
viewer builds the tree itself.

Configuration (environment):
  WORKER_SPLAT_LOD          auto (default: when build-lod is found), off
  WORKER_SPLAT_LOD_BIN      the build-lod executable (default: build-lod on PATH)
  WORKER_SPLAT_LOD_ARGS     its options (default: --quality); e.g. "--quality
                            --max-sh=1" leaves out the higher spherical
                            harmonics for smaller files
  WORKER_SPLAT_LOD_TIMEOUT  seconds per conversion (default 1800)

Also usable on its own: python3 splats.py capture.spz
Uploads from before (or rebuilt with new options): server.py admin
rebuild-splats, see rebuild().
"""

import os
import shlex
import shutil
import subprocess
import sys
from pathlib import Path

SPLAT_LOD = os.environ.get("WORKER_SPLAT_LOD", "auto").strip().lower()
BUILD_LOD = os.environ.get("WORKER_SPLAT_LOD_BIN", "build-lod")
BUILD_LOD_ARGS = shlex.split(os.environ.get("WORKER_SPLAT_LOD_ARGS", "--quality"))
BUILD_LOD_TIMEOUT = int(os.environ.get("WORKER_SPLAT_LOD_TIMEOUT", "1800"))

# Inputs build-lod reads (a .ply only when it holds splats, which the caller
# checks with pointcloud.is_gaussian_splat_ply()).
LOD_SOURCE_FORMATS = {"spz", "splat", "ksplat", "sog", "ply"}


def available() -> bool:
    return SPLAT_LOD not in ("off", "false", "0", "no") and shutil.which(BUILD_LOD) is not None


def rad_path_for(path: Path) -> Path:
    """Where build-lod writes the tree of `path`: Angel.spz -> Angel-lod.rad."""
    return path.with_name(path.stem + "-lod.rad")


def build_rad(path: Path, log_prefix: str = "") -> Path | None:
    """Builds <name>-lod.rad next to `path`. Returns it, or None when
    build-lod is missing or fails (the upload is then used as it is)."""
    if not available() or path.suffix.lower().lstrip(".") not in LOD_SOURCE_FORMATS:
        return None
    output = rad_path_for(path)
    # build-lod skips inputs already named *-lod.spz / *-lod.rad.
    source = path
    if path.stem.endswith("-lod"):
        source = path.with_name(path.stem + "-src" + path.suffix)
        shutil.copyfile(path, source)
        output = rad_path_for(source)
    try:
        result = subprocess.run(
            [BUILD_LOD, *BUILD_LOD_ARGS, "--rad", source.name],
            cwd=source.parent, capture_output=True, text=True, timeout=BUILD_LOD_TIMEOUT,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        print(f"{log_prefix} build-lod failed: {exc}", file=sys.stderr)
        output.unlink(missing_ok=True)
        return None
    finally:
        if source != path:
            source.unlink(missing_ok=True)
    print(
        f"{log_prefix} build-lod exit={result.returncode}:\n"
        f"--- stdout ---\n{result.stdout[-4000:]}\n--- stderr ---\n{result.stderr[-4000:]}",
        file=sys.stderr,
    )
    if result.returncode != 0 or not output.is_file() or output.stat().st_size == 0:
        output.unlink(missing_ok=True)
        return None
    return output


def expected_rad(path: Path) -> Path:
    """The .rad build_rad() writes for `path` (an upload named *-lod is
    copied to *-lod-src first, see there)."""
    if path.stem.endswith("-lod"):
        return rad_path_for(path.with_name(path.stem + "-src" + path.suffix))
    return rad_path_for(path)


def sources(job_root: Path, is_splat_ply) -> list:
    """The splat uploads under job_root: the LOD_SOURCE_FORMATS, a .ply only
    when is_splat_ply(path) says it holds splats."""
    found = []
    for path in sorted(job_root.rglob("*")):
        ext = path.suffix.lower().lstrip(".")
        if not path.is_file() or ext not in LOD_SOURCE_FORMATS or path.stem.endswith("-lod-src"):
            continue
        if ext == "ply" and not is_splat_ply(path):
            continue
        found.append(path)
    return found


def rebuild(path: Path, force: bool = False, log_prefix: str = "[splats]"):
    """("kept" | "built" | "failed", rad) for the upload `path`: an existing
    .rad stays unless force, and a failed rebuild keeps the old one."""
    rad = expected_rad(path)
    if rad.is_file() and not force:
        return "kept", rad
    backup = rad.with_name(rad.name + ".bak")
    if rad.is_file():
        rad.replace(backup)
    built = build_rad(path, log_prefix=log_prefix)
    if not built:
        if backup.is_file():
            backup.replace(rad)
        return "failed", rad if rad.is_file() else None
    backup.unlink(missing_ok=True)
    # The gzip copy of the old tree (static_files.py) would be served instead.
    for stale in (built.with_name(built.name + ".gz"), built.with_name(built.name + ".nogz")):
        stale.unlink(missing_ok=True)
    return "built", built


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python3 splats.py capture.spz", file=sys.stderr)
        sys.exit(2)
    rad = build_rad(Path(sys.argv[1]).resolve(), log_prefix="[splats]")
    print(rad or "not converted")
    sys.exit(0 if rad else 1)
