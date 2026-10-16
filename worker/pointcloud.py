"""Point clouds -> streamed 3D Tiles, for the standalone worker.

Uploaded scans are turned into a 3D Tiles tileset (pnts octree) with
py3dtiles, which the viewer streams level by level (viewer/tiles.js) instead
of downloading millions of points at once:

  .las        converted directly
  .laz        decompressed to LAS first (laspy + lazrs; py3dtiles would need
              the external LAStools "laszip" for it)
  .e57        every scan, with its pose applied, merged into one LAS (pye57)
  .ply        only when it has no faces (a point cloud), converted to LAS
              with trimesh; meshes still go through Blender

Output: <input dir>/tiles/<name>/tileset.json. No thumbnails are rendered for
point clouds (Blender renders meshes).

Before the tiles, a quick preview is written next to them,
<input dir>/tiles/<name>.preview.las: a random subsample of the cloud in
random order, uncompressed. The viewer shows it while py3dtiles runs - it
decodes LAS while downloading, and since the points are shuffled the first
100 000 already show the whole object, the rest only make it denser.

Configuration (environment):
  WORKER_POINTCLOUD_JOBS  parallel py3dtiles workers (default: number of CPUs, at most 8)
  WORKER_POINTCLOUD_TIMEOUT  seconds per conversion (default 3600)
  WORKER_POINTCLOUD_PREVIEW_POINTS  points in the preview (default 1000000; 0: no preview)

Also usable on its own: python3 pointcloud.py scan.e57 out_dir
"""

import os
import shutil
import subprocess
import sys
from pathlib import Path

POINTCLOUD_JOBS = int(os.environ.get("WORKER_POINTCLOUD_JOBS", str(min(os.cpu_count() or 1, 8))))
POINTCLOUD_TIMEOUT = int(os.environ.get("WORKER_POINTCLOUD_TIMEOUT", "3600"))
POINTCLOUD_PREVIEW_POINTS = int(os.environ.get("WORKER_POINTCLOUD_PREVIEW_POINTS", "1000000"))

POINTCLOUD_FORMATS = {"las", "laz", "e57"}


def read_ply_header(path: Path) -> str:
    try:
        with open(path, "rb") as handle:
            header = b""
            while b"end_header" not in header and len(header) < 65536:
                line = handle.readline()
                if not line:
                    break
                header += line
    except OSError:
        return ""
    return header.decode("latin-1")


def is_gaussian_splat_ply(path: Path) -> bool:
    """True for a PLY of Gaussian splats (3D Gaussian Splatting: f_dc_*, scale_*,
    rot_* per vertex, or a PlayCanvas compressed PLY). The viewer draws these
    itself (viewer/splats.js), so they are kept as uploaded."""
    properties = set()
    for line in read_ply_header(path).splitlines():
        parts = line.split()
        if len(parts) >= 3 and parts[0] == "property":
            properties.add(parts[-1])
    return {"f_dc_0", "scale_0", "rot_0"} <= properties or "packed_position" in properties


def is_point_cloud_ply(path: Path) -> bool:
    """True for a PLY without faces (header "element face 0" or no face element),
    other than Gaussian splats."""
    header = read_ply_header(path)
    if not header or is_gaussian_splat_ply(path):
        return False
    vertices = faces = 0
    for line in header.splitlines():
        parts = line.split()
        if len(parts) == 3 and parts[0] == "element":
            if parts[1] == "vertex":
                vertices = int(parts[2])
            elif parts[1] == "face":
                faces = int(parts[2])
    return vertices > 0 and faces == 0


def is_point_cloud(path: Path) -> bool:
    ext = path.suffix.lower().lstrip(".")
    return ext in POINTCLOUD_FORMATS or (ext == "ply" and is_point_cloud_ply(path))


def laz_to_las(source: Path, target: Path) -> None:
    import laspy  # installed in the worker base image

    with laspy.open(source) as reader, laspy.open(target, mode="w", header=reader.header) as writer:
        for chunk in reader.chunk_iterator(2_000_000):
            writer.write_points(chunk)


def write_las(target: Path, xyz, rgb=None, intensity=None) -> int:
    """Writes points (N x 3), optional 16-bit colours and intensity to LAS."""
    import laspy
    import numpy as np

    header = laspy.LasHeader(point_format=2, version="1.2")
    header.scales = [0.001, 0.001, 0.001]
    header.offsets = xyz.min(axis=0)
    las = laspy.LasData(header)
    las.x, las.y, las.z = xyz[:, 0], xyz[:, 1], xyz[:, 2]
    if rgb is not None:
        las.red, las.green, las.blue = rgb[:, 0], rgb[:, 1], rgb[:, 2]
    if intensity is not None:
        las.intensity = intensity
    las.write(target)
    return len(xyz)


def to_uint16_colors(rgb):
    import numpy as np

    rgb = np.asarray(rgb, dtype=np.float64)[:, :3]
    # Usually 0-255 (E57, PLY); LAS expects 16 bit.
    scale = 256.0 if rgb.max() <= 255 else 1.0
    return np.clip(rgb * scale, 0, 65535).astype(np.uint16)


def ply_to_las(source: Path, target: Path) -> int:
    import numpy as np
    import trimesh

    cloud = trimesh.load(source, process=False)
    xyz = np.asarray(cloud.vertices, dtype=np.float64)
    if len(xyz) == 0:
        raise RuntimeError("The PLY file contains no points.")
    colors = getattr(getattr(cloud, "visual", None), "vertex_colors", None)
    if colors is None:
        colors = getattr(cloud, "colors", None)
    rgb = to_uint16_colors(colors) if colors is not None and len(colors) == len(xyz) else None
    return write_las(target, xyz, rgb)


def e57_to_las(source: Path, target: Path) -> int:
    """Merges every scan (pose applied) into one LAS; returns the point count."""
    import numpy as np
    import pye57

    e57 = pye57.E57(str(source))
    xyz_parts, rgb_parts, intensity_parts = [], [], []
    has_color = has_intensity = True
    for index in range(e57.scan_count):
        header = e57.get_header(index)
        fields = set(header.point_fields)
        scan_color = {"colorRed", "colorGreen", "colorBlue"} <= fields
        scan_intensity = "intensity" in fields
        data = e57.read_scan(index, colors=scan_color, intensity=scan_intensity, ignore_missing_fields=True, transform=True)
        count = len(data["cartesianX"])
        if count == 0:
            continue
        xyz_parts.append(np.column_stack([data["cartesianX"], data["cartesianY"], data["cartesianZ"]]))
        has_color = has_color and scan_color
        has_intensity = has_intensity and scan_intensity
        rgb_parts.append(
            np.column_stack([data["colorRed"], data["colorGreen"], data["colorBlue"]]) if scan_color else None
        )
        intensity_parts.append(data["intensity"] if scan_intensity else None)
    if not xyz_parts:
        raise RuntimeError("The E57 file contains no points.")

    xyz = np.vstack(xyz_parts)
    rgb = to_uint16_colors(np.vstack(rgb_parts)) if has_color else None
    intensity = None
    if has_intensity:
        intensity = np.concatenate(intensity_parts).astype(np.float64)
        if intensity.max() <= 1.0:
            intensity = intensity * 65535
        intensity = np.clip(intensity, 0, 65535).astype(np.uint16)
    return write_las(target, xyz, rgb, intensity)


def write_preview(source: Path, target: Path, max_points: int = POINTCLOUD_PREVIEW_POINTS, seed: int = 0) -> int:
    """Writes a random subsample of the LAS/LAZ file source (about max_points,
    all of them for a smaller cloud) to target as uncompressed LAS, in random
    order; returns the number of points. Read in chunks, so the source may be
    larger than memory. Keeps the standard dimensions of the point format
    (position, intensity, classification, colour ...), not extra bytes."""
    import laspy
    import numpy as np

    rng = np.random.default_rng(seed)
    with laspy.open(source) as reader:
        total = reader.header.point_count
        fraction = min(1.0, max_points / total) if total else 1.0
        point_format = laspy.PointFormat(reader.header.point_format.id)
        dtype = point_format.dtype()
        parts = []
        for chunk in reader.chunk_iterator(2_000_000):
            array = chunk.array
            if fraction < 1.0:
                array = array[rng.random(len(array)) < fraction]
            part = np.zeros(len(array), dtype=dtype)
            for name in dtype.names:
                part[name] = array[name]
            parts.append(part)
        points = np.concatenate(parts) if parts else np.zeros(0, dtype=dtype)
        points = points[rng.permutation(len(points))][:max_points]

        header = laspy.LasHeader(point_format=point_format, version=reader.header.version)
        header.scales = reader.header.scales
        header.offsets = reader.header.offsets
        target.parent.mkdir(parents=True, exist_ok=True)
        partial = target.with_name(target.name + ".tmp")
        # Bounds and counts in the header are filled in by the writer.
        with laspy.open(partial, mode="w", header=header) as writer:
            writer.write_points(laspy.PackedPointRecord(points, point_format))
        # Published only once complete: the viewer may fetch it right away.
        partial.replace(target)
    return len(points)


def convert_to_tiles(source: Path, out_dir: Path, work_dir: Path, log_prefix: str = "",
                     preview: Path = None, on_preview=None) -> Path:
    """Converts a point cloud to a 3D Tiles tileset in out_dir; returns the
    path of its tileset.json. work_dir holds intermediate files.

    With preview (a .las path), a quick preview is written there first (see
    write_preview) and on_preview(preview) is called once it exists; a
    preview that fails is only logged."""
    source, out_dir, work_dir = Path(source).resolve(), Path(out_dir).resolve(), Path(work_dir).resolve()
    work_dir.mkdir(parents=True, exist_ok=True)
    ext = source.suffix.lower().lstrip(".")
    py3dtiles_input = source
    intermediate = None
    if ext == "laz":
        intermediate = work_dir / (source.stem + ".las")
        print(f"{log_prefix} decompressing LAZ -> {intermediate.name}", file=sys.stderr)
        laz_to_las(source, intermediate)
        py3dtiles_input = intermediate
    elif ext in ("e57", "ply"):
        intermediate = work_dir / (source.stem + ".las")
        count = (e57_to_las if ext == "e57" else ply_to_las)(source, intermediate)
        print(f"{log_prefix} {ext.upper()} -> {intermediate.name}: {count} points", file=sys.stderr)
        py3dtiles_input = intermediate

    py3dtiles = shutil.which("py3dtiles")
    if not py3dtiles:
        raise RuntimeError("py3dtiles is not installed")

    if preview is not None and POINTCLOUD_PREVIEW_POINTS > 0:
        try:
            count = write_preview(py3dtiles_input, Path(preview))
            print(f"{log_prefix} preview {Path(preview).name}: {count} points", file=sys.stderr)
            if on_preview is not None:
                on_preview(Path(preview))
        except Exception as exc:  # noqa: BLE001 - the preview is optional
            print(f"{log_prefix} preview failed: {exc}", file=sys.stderr)
    shutil.rmtree(out_dir, ignore_errors=True)
    out_dir.parent.mkdir(parents=True, exist_ok=True)
    # --disable-processpool: Docker's default /dev/shm (64 MB) is too small for
    # py3dtiles' shared-memory pool; conversion still runs in parallel workers.
    command = [
        py3dtiles, "convert", str(py3dtiles_input), "--out", str(out_dir), "--overwrite",
        "--jobs", str(POINTCLOUD_JOBS), "--disable-processpool",
    ]
    try:
        result = subprocess.run(command, capture_output=True, text=True, timeout=POINTCLOUD_TIMEOUT, cwd=work_dir)
    finally:
        if intermediate is not None:
            intermediate.unlink(missing_ok=True)
    print(
        f"{log_prefix} py3dtiles exit={result.returncode}:\n"
        f"--- stdout ---\n{result.stdout[-4000:]}\n--- stderr ---\n{result.stderr[-4000:]}",
        file=sys.stderr,
    )
    tileset = out_dir / "tileset.json"
    if result.returncode != 0 or not tileset.is_file():
        detail = (result.stderr.strip() or result.stdout.strip())[-300:]
        raise RuntimeError(f"py3dtiles failed (exit={result.returncode}): {detail}")
    shutil.rmtree(out_dir / "tmp", ignore_errors=True)
    try:
        work_dir.rmdir()  # only when empty
    except OSError:
        pass
    return tileset


def preview_path_for(out_dir: Path) -> Path:
    """tiles/<name>/ -> tiles/<name>.preview.las"""
    return Path(out_dir).parent / (Path(out_dir).name + ".preview.las")


def main(argv) -> None:
    if len(argv) != 2:
        sys.exit("usage: pointcloud.py <scan.las|laz|e57|ply> <out_dir>")
    source, out_dir = Path(argv[0]), Path(argv[1])
    tileset = convert_to_tiles(
        source, out_dir, out_dir.parent / (out_dir.name + ".work"), log_prefix="[pointcloud]",
        preview=preview_path_for(out_dir),
    )
    print(f"tileset: {tileset}")


if __name__ == "__main__":
    main(sys.argv[1:])
