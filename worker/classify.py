"""Point cloud classification (ASPRS classes) before tiling - optional.

A scan straight from a scanner or photogrammetry has no classes: the
viewer's class filter (viewer/editor/point-cloud-tools.js) then has nothing
to offer. With classification on, pointcloud.convert_to_tiles() runs the
cloud through a classifier first, and the tiles carry its classes:

  1 unclassified   2 ground   3/4/5 low/medium/high vegetation
  6 building       7 noise (isolated or far below the ground)

Two classifiers:

  geometric  built in (numpy, no model, no GPU): rules on the geometry
             - ground: a progressive morphological filter (SMRF, Pingel et
               al. 2013) on a grid of lowest points; a cell whose surface
               drops more under an opening than the slope allows is not
               ground
             - noise: points alone in their voxel with no occupied
               neighbour voxel, and points well below the ground
             - above the ground, per voxel: the eigenvalues of the points'
               covariance - planar patches (roofs, walls) are buildings,
               scattered ones vegetation (multiple returns count as
               vegetation too), graded by height above the ground
             Good on open terrain with buildings and trees (aerial and
             mobile scans); not on interiors or single objects, where
             "ground" and "building" mean little.
  command    an external program, e.g. a trained segmentation model
             (Open3D-ML, KPConv, PointNet++) or a PDAL pipeline: run as
             WORKER_POINTCLOUD_CLASSIFIER_CMD with {input} and {output}
             replaced by a LAS/LAZ path to read and a LAS path to write;
             it must keep the points (same count and order) and set their
             classification

Configuration (environment):
  WORKER_POINTCLOUD_CLASSIFY        off (default) | auto (only clouds without
                                    classes: all 0 or 1) | always
  WORKER_POINTCLOUD_CLASSIFIER      geometric (default) | command
  WORKER_POINTCLOUD_CLASSIFIER_CMD  the command line (classifier "command")
  WORKER_POINTCLOUD_CLASSIFY_MAX_POINTS  larger clouds are left as they are
                                    (default 60000000; the geometric one
                                    holds the cloud in memory, ~150 bytes a point)
  WORKER_POINTCLOUD_GROUND_CELL     grid cell for the ground, in the file's
                                    units (default 1.0 - metres for most scans)
  WORKER_POINTCLOUD_GROUND_WINDOW   largest object the ground filter removes,
                                    e.g. a building's width (default 20.0)
  WORKER_POINTCLOUD_GROUND_SLOPE    terrain slope still taken as ground (default 0.3)
  WORKER_POINTCLOUD_GROUND_THRESHOLD  height above the ground surface still
                                    ground (default 0.4)
  WORKER_POINTCLOUD_FEATURE_VOXEL   voxel for the shape features (default 1.0)

Next to the tiles, tiles/<name>.classification.json records what was done:
{classifier, counts: {class: points}, seconds}.

Also usable on its own: python3 classify.py in.las out.las
"""

import json
import os
import shlex
import subprocess
import sys
import time
from pathlib import Path

UNCLASSIFIED, GROUND, LOW_VEGETATION, MEDIUM_VEGETATION, HIGH_VEGETATION, BUILDING, NOISE = 1, 2, 3, 4, 5, 6, 7
CLASS_NAMES = {
    0: "never classified", 1: "unclassified", 2: "ground", 3: "low vegetation",
    4: "medium vegetation", 5: "high vegetation", 6: "building", 7: "noise",
}
# The ground grid is coarsened beyond this many cells.
MAX_GRID_CELLS = 16_000_000
MAX_FILL_ITERATIONS = 400


def _env_float(name: str, default: float) -> float:
    try:
        value = float(os.environ.get(name, "").strip() or default)
    except ValueError:
        return default
    return value if value > 0 else default


def mode() -> str:
    value = os.environ.get("WORKER_POINTCLOUD_CLASSIFY", "off").strip().lower()
    return value if value in ("off", "auto", "always") else "off"


def classifier() -> str:
    value = os.environ.get("WORKER_POINTCLOUD_CLASSIFIER", "geometric").strip().lower()
    return value if value in ("geometric", "command") else "geometric"


def max_points() -> int:
    try:
        return int(os.environ.get("WORKER_POINTCLOUD_CLASSIFY_MAX_POINTS", "60000000"))
    except ValueError:
        return 60_000_000


def parameters() -> dict:
    return {
        "cell": _env_float("WORKER_POINTCLOUD_GROUND_CELL", 1.0),
        "window": _env_float("WORKER_POINTCLOUD_GROUND_WINDOW", 20.0),
        "slope": _env_float("WORKER_POINTCLOUD_GROUND_SLOPE", 0.3),
        "threshold": _env_float("WORKER_POINTCLOUD_GROUND_THRESHOLD", 0.4),
        "voxel": _env_float("WORKER_POINTCLOUD_FEATURE_VOXEL", 1.0),
    }


# ---- grid helpers ----------------------------------------------------------


def _sliding(grid, radius: int, reduce, pad_value):
    """Square min/max filter of the given radius, separable."""
    import numpy as np
    from numpy.lib.stride_tricks import sliding_window_view

    if radius <= 0:
        return grid
    size = 2 * radius + 1
    padded = np.pad(grid, ((0, 0), (radius, radius)), constant_values=pad_value)
    rows = reduce(sliding_window_view(padded, size, axis=1), axis=-1)
    padded = np.pad(rows, ((radius, radius), (0, 0)), constant_values=pad_value)
    return reduce(sliding_window_view(padded, size, axis=0), axis=-1)


def _fill_gaps(grid):
    """Empty cells (nan) take the mean of their filled neighbours, growing
    inwards; what is left after MAX_FILL_ITERATIONS gets the median."""
    import numpy as np

    grid = grid.copy()
    for _ in range(MAX_FILL_ITERATIONS):
        empty = np.isnan(grid)
        if not empty.any():
            break
        padded = np.pad(grid, 1, constant_values=np.nan)
        stack = np.stack([
            padded[1 + dy:padded.shape[0] - 1 + dy, 1 + dx:padded.shape[1] - 1 + dx]
            for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dy or dx
        ])
        counts = (~np.isnan(stack)).sum(axis=0)
        sums = np.nansum(stack, axis=0)
        fillable = empty & (counts > 0)
        if not fillable.any():
            break
        grid[fillable] = sums[fillable] / counts[fillable]
    if np.isnan(grid).any():
        grid[np.isnan(grid)] = np.nanmedian(grid) if not np.isnan(grid).all() else 0.0
    return grid


def ground_surface(xyz, params: dict):
    """(surface grid, cell index of every point, cell size): the bare ground
    under the cloud, by a progressive morphological filter."""
    import numpy as np

    cell = params["cell"]
    lo = xyz[:, :2].min(axis=0)
    extent = xyz[:, :2].max(axis=0) - lo
    while (extent[0] / cell + 1) * (extent[1] / cell + 1) > MAX_GRID_CELLS:
        cell *= 2
    ix = ((xyz[:, 0] - lo[0]) / cell).astype(np.int64)
    iy = ((xyz[:, 1] - lo[1]) / cell).astype(np.int64)
    nx, ny = int(ix.max()) + 1, int(iy.max()) + 1
    index = iy * nx + ix

    lowest = np.full(nx * ny, np.inf)
    np.minimum.at(lowest, index, xyz[:, 2])
    lowest = lowest.reshape(ny, nx)
    lowest[np.isinf(lowest)] = np.nan
    surface = _fill_gaps(lowest)

    # SMRF: openings of growing radius; a cell is not ground when the
    # opening lowers it more than the slope allows over that radius.
    not_ground = np.zeros_like(surface, dtype=bool)
    previous = surface
    max_radius = max(1, int(round(params["window"] / (2 * cell))))
    radius = 1
    while True:
        eroded = _sliding(previous, radius, np.min, np.inf)
        opened = _sliding(eroded, radius, np.max, -np.inf)
        threshold = max(params["slope"] * radius * cell, params["threshold"])
        not_ground |= (previous - opened) > threshold
        previous = opened
        if radius >= max_radius:
            break
        radius = min(radius * 2, max_radius)

    ground = np.where(not_ground | np.isnan(lowest), np.nan, lowest)
    return _fill_gaps(ground), index, cell


def isolated_points(xyz, voxel: float):
    """Points alone in their voxel with no occupied voxel around."""
    import numpy as np

    keys = np.floor((xyz - xyz.min(axis=0)) / voxel).astype(np.int64) + 1
    span = keys.max(axis=0) + 2
    flat = (keys[:, 0] * span[1] + keys[:, 1]) * span[2] + keys[:, 2]
    occupied, inverse, counts = np.unique(flat, return_inverse=True, return_counts=True)
    single = np.flatnonzero(counts[inverse] == 1)
    if not single.size:
        return np.zeros(len(xyz), dtype=bool)
    lonely = np.ones(single.size, dtype=bool)
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for dz in (-1, 0, 1):
                if not (dx or dy or dz):
                    continue
                neighbour = flat[single] + (dx * span[1] + dy) * span[2] + dz
                found = np.searchsorted(occupied, neighbour)
                found = np.clip(found, 0, occupied.size - 1)
                lonely &= occupied[found] != neighbour
    result = np.zeros(len(xyz), dtype=bool)
    result[single[lonely]] = True
    return result


def shape_features(xyz, voxel: float):
    """Per point, from its voxel's covariance: (points in the voxel,
    planarity, scattering, verticality of the plane's normal)."""
    import numpy as np

    keys = np.floor((xyz - xyz.min(axis=0)) / voxel).astype(np.int64)
    span = keys.max(axis=0) + 1
    flat = (keys[:, 0] * span[1] + keys[:, 1]) * span[2] + keys[:, 2]
    _, inverse, counts = np.unique(flat, return_inverse=True, return_counts=True)
    centered = xyz - xyz.mean(axis=0)
    n = counts.astype(np.float64)
    mean = np.stack([np.bincount(inverse, centered[:, axis]) / n for axis in range(3)], axis=1)
    cov = np.empty((counts.size, 3, 3))
    for a in range(3):
        for b in range(a, 3):
            value = np.bincount(inverse, centered[:, a] * centered[:, b]) / n - mean[:, a] * mean[:, b]
            cov[:, a, b] = cov[:, b, a] = value
    values, vectors = np.linalg.eigh(cov)  # ascending
    l3, l2, l1 = values[:, 0].clip(0), values[:, 1].clip(0), values[:, 2].clip(0)
    safe = np.where(l1 > 0, l1, 1.0)
    planarity = np.where(l1 > 0, (l2 - l3) / safe, 0.0)
    scattering = np.where(l1 > 0, l3 / safe, 0.0)
    normal_z = np.abs(vectors[:, 2, 0])
    return counts[inverse], planarity[inverse], scattering[inverse], normal_z[inverse]


def classify_points(xyz, return_number=None, number_of_returns=None, params: dict = None):
    """ASPRS classes for the points (N x 3, z up)."""
    import numpy as np

    params = params or parameters()
    xyz = np.asarray(xyz, dtype=np.float64)
    classes = np.full(len(xyz), UNCLASSIFIED, dtype=np.uint8)
    if len(xyz) < 10:
        return classes

    surface, cell_index, _ = ground_surface(xyz, params)
    height = xyz[:, 2] - surface.ravel()[cell_index]

    noise = isolated_points(xyz, params["voxel"] / 2) | (height < -3 * params["threshold"] - 1.0)
    ground = (np.abs(height) <= params["threshold"]) & ~noise
    classes[ground] = GROUND
    classes[noise] = NOISE

    above = ~ground & ~noise & (height > params["threshold"])
    if above.any():
        count, planarity, scattering, _ = shape_features(xyz[above], params["voxel"])
        building = (count >= 5) & (planarity > 0.45) & (scattering < 0.06)
        vegetation = (count >= 5) & ~building & (scattering > 0.1)
        if return_number is not None and number_of_returns is not None:
            # A pulse that went on after this point: through foliage.
            multiple = (np.asarray(number_of_returns)[above] > 1) & (np.asarray(return_number)[above] < np.asarray(number_of_returns)[above])
            vegetation |= multiple & ~building
        h = height[above]
        grade = np.where(h < 0.5, LOW_VEGETATION, np.where(h < 2.0, MEDIUM_VEGETATION, HIGH_VEGETATION)).astype(np.uint8)
        result = np.full(h.size, UNCLASSIFIED, dtype=np.uint8)
        result[vegetation] = grade[vegetation]
        result[building] = BUILDING
        classes[above] = result
    return classes


# ---- files -----------------------------------------------------------------


def has_classes(las) -> bool:
    import numpy as np

    classification = np.asarray(las.classification)
    return bool(classification.size) and bool((classification > 1).any())


def counts_of(classes) -> dict:
    import numpy as np

    values, counts = np.unique(np.asarray(classes), return_counts=True)
    return {CLASS_NAMES.get(int(value), str(int(value))): int(count) for value, count in zip(values, counts)}


def classify_file(source: Path, target: Path, params: dict = None) -> dict:
    """Reads a LAS/LAZ, writes it as LAS with the geometric classes."""
    import laspy
    import numpy as np

    las = laspy.read(str(source))
    xyz = np.column_stack([np.asarray(las.x), np.asarray(las.y), np.asarray(las.z)])
    names = set(las.point_format.dimension_names)
    returns = (np.asarray(las.return_number), np.asarray(las.number_of_returns)) \
        if {"return_number", "number_of_returns"} <= names else (None, None)
    classes = classify_points(xyz, returns[0], returns[1], params)
    las.classification = classes
    las.write(str(target))
    return counts_of(classes)


def run_command(source: Path, target: Path) -> dict:
    command = os.environ.get("WORKER_POINTCLOUD_CLASSIFIER_CMD", "").strip()
    if not command:
        raise RuntimeError("WORKER_POINTCLOUD_CLASSIFIER_CMD is not set")
    args = [part.replace("{input}", str(source)).replace("{output}", str(target)) for part in shlex.split(command)]
    timeout = int(os.environ.get("WORKER_POINTCLOUD_TIMEOUT", "3600"))
    result = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    if result.returncode != 0 or not target.is_file():
        detail = (result.stderr or result.stdout or "").strip()[-2000:]
        raise RuntimeError(f"classifier command failed (exit={result.returncode}): {detail}")
    import laspy

    with laspy.open(str(source)) as before, laspy.open(str(target)) as after:
        if before.header.point_count != after.header.point_count:
            raise RuntimeError("classifier command changed the number of points")
    return counts_of(laspy.read(str(target)).classification)


def maybe_classify(source: Path, work_dir: Path, stats_path: Path = None, log_prefix: str = "", on_start=None):
    """The LAS to tile instead of source, classified - or None when
    classification is off, not needed (auto, the cloud has classes), too
    large, or failed (logged; the tiles are then built unclassified)."""
    if mode() == "off":
        return None
    source, work_dir = Path(source), Path(work_dir)
    try:
        import laspy

        with laspy.open(str(source)) as reader:
            count = reader.header.point_count
        if count > max_points():
            print(f"{log_prefix} classification skipped: {count} points > {max_points()}", file=sys.stderr)
            return None
        if mode() == "auto" and has_classes(laspy.read(str(source))):
            print(f"{log_prefix} classification skipped: the cloud has classes", file=sys.stderr)
            return None
        if on_start is not None:
            on_start()
        work_dir.mkdir(parents=True, exist_ok=True)
        target = work_dir / (source.stem + ".classified.las")
        started = time.time()
        counts = run_command(source, target) if classifier() == "command" else classify_file(source, target)
        stats = {"classifier": classifier(), "points": int(count), "counts": counts, "seconds": round(time.time() - started, 1)}
        print(f"{log_prefix} classified ({stats['classifier']}, {stats['seconds']} s): {counts}", file=sys.stderr)
        if stats_path is not None:
            Path(stats_path).write_text(json.dumps(stats, indent=1), "utf-8")
        return target
    except Exception as exc:  # noqa: BLE001 - classification is optional
        print(f"{log_prefix} classification failed, tiling unclassified: {exc}", file=sys.stderr)
        return None


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    print(json.dumps(classify_file(Path(sys.argv[1]), Path(sys.argv[2])), indent=1))
