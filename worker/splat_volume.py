"""Gaussian splats -> a voxel volume of their surface, for lighting them in the viewer.

The viewer lights splats by the scene's lights (viewer/splat-lighting.js).
On its own it only has each splat's shortest axis as a normal - noisy, and
nothing for occlusion or shadows. Here, once per upload, the splats are
turned into a coarse voxel grid of their surface (WORKER_SPLAT_VOLUME_RES
voxels along the longest side), from which the viewer reads, at any point:

- the surface orientation, as a structure tensor (the smoothed outer product
  of the density gradient): its main axis is the normal. A tensor has no
  sign, so it blends between voxels where normals of either sign would
  cancel; the viewer turns the axis to the camera, as it does the splats';
- the openness of the air: the share of directions free of surface from a
  voxel, twice that for a point next to a flat surface, which already hides
  half the sphere (1 = open, 0 = closed in). The viewer reads it a little
  off the surface on the side it looks at, so a wall seen from a room is
  not darkened by the building behind it;
- the distance to the surface, in voxels, along which it marches to the
  lights for soft shadows.

No orientation (inside or outside) is needed, so it works the same for an
object scanned from outside and a room scanned from inside.

The density is the splats' opacity, deposited at their centres - large
splats at points drawn from their Gaussians - and blurred. Read here are
.splat, .ply (3DGS) and .spz; .ksplat, .sog and compressed PLY get no
volume, and the viewer lights them from the splats alone.

File (<served model>.light, e.g. Angel-lod.rad.light), gzip of:
  "DFGV" u32 version, u16 nx ny nz, u16 0, f32 min[3], f32 voxel size,
  f32 splat-bounds min[3] max[3],
  then two RGBA8 volumes x fastest:
    A: tensor xx yy zz (0..1, divided by its trace), openness
    B: tensor xy xz yz (as 0.5 + v; within +-0.5 once divided by the
       trace), distance / DISTANCE_RANGE

Configuration (environment):
  WORKER_SPLAT_VOLUME       auto (default), off
  WORKER_SPLAT_VOLUME_RES   voxels along the longest side (default 128)

Also usable on its own: python3 splat_volume.py capture.splat [out.light]
"""

import gzip
import math
import os
import struct
import sys
from pathlib import Path

import numpy as np

SPLAT_VOLUME = os.environ.get("WORKER_SPLAT_VOLUME", "auto").strip().lower()
RESOLUTION = int(os.environ.get("WORKER_SPLAT_VOLUME_RES", "128"))

VERSION = 1
MAGIC = b"DFGV"
# Distances stored up to this many voxels.
DISTANCE_RANGE = 16.0
# Splats whose radius is above this share of a voxel are spread out.
SPREAD_ABOVE = 0.75
SPREAD_SAMPLES = 16
# Voxels of air the openness is computed for, round the surface.
OPENNESS_BAND = 6.0
OPENNESS_DIRECTIONS = 32
OPENNESS_STEPS = (1.5, 2.5, 3.5, 5, 7, 10, 14, 20, 28)
# The bounds: these percentiles of the centres (floaters left out), plus a
# margin of voxels (more on a thin side, see compute_volume()).
BOUNDS_PERCENTILE = 0.5
MARGIN = 4
FORMATS = {"splat", "ply", "spz"}


def available() -> bool:
    return SPLAT_VOLUME not in ("off", "false", "0", "no")


def volume_path_for(model: Path) -> Path:
    """Where the volume of the served model goes: Angel-lod.rad.light."""
    return model.with_name(model.name + ".light")


# Reading the splats: centres (N, 3), scales (N, 3, linear), rotations
# (N, 4, x y z w), opacity (N,).

def _quat_from_bytes(raw):
    q = (raw.astype(np.float32) - 128.0) / 128.0
    # .splat: w x y z
    return np.stack([q[:, 1], q[:, 2], q[:, 3], q[:, 0]], axis=1)


def read_splat(path: Path):
    data = np.fromfile(path, dtype=np.uint8)
    count = len(data) // 32
    records = data[: count * 32].reshape(count, 32)
    floats = records[:, :24].copy().view(np.float32).reshape(count, 6)
    return floats[:, :3], floats[:, 3:6], _quat_from_bytes(records[:, 28:32]), records[:, 27].astype(np.float32) / 255.0


PLY_TYPES = {
    "char": "i1", "uchar": "u1", "short": "i2", "ushort": "u2", "int": "i4", "uint": "u4",
    "float": "f4", "double": "f8", "int8": "i1", "uint8": "u1", "int16": "i2", "uint16": "u2",
    "int32": "i4", "uint32": "u4", "float32": "f4", "float64": "f8",
}


def read_ply(path: Path):
    with open(path, "rb") as file:
        header = []
        while True:
            line = file.readline()
            if not line:
                return None
            line = line.decode("latin-1").strip()
            header.append(line)
            if line == "end_header":
                break
        offset = file.tell()
    if "format binary_little_endian 1.0" not in header:
        return None
    count, fields, element = 0, [], None
    for line in header:
        parts = line.split()
        if parts[:1] == ["element"]:
            element = parts[1]
            if element == "vertex":
                count = int(parts[2])
            elif count and not fields:
                return None
        elif parts[:1] == ["property"] and element == "vertex":
            if parts[1] == "list" or parts[1] not in PLY_TYPES:
                return None
            fields.append((parts[2], "<" + PLY_TYPES[parts[1]]))
    names = {name for name, _ in fields}
    if not {"x", "y", "z", "scale_0", "scale_1", "scale_2", "rot_0", "rot_1", "rot_2", "rot_3", "opacity"} <= names:
        return None
    vertices = np.fromfile(path, dtype=np.dtype(fields), count=count, offset=offset)
    centers = np.stack([vertices["x"], vertices["y"], vertices["z"]], axis=1).astype(np.float32)
    scales = np.exp(np.stack([vertices[f"scale_{i}"] for i in range(3)], axis=1)).astype(np.float32)
    # rot_0 is w.
    rotations = np.stack([vertices["rot_1"], vertices["rot_2"], vertices["rot_3"], vertices["rot_0"]], axis=1).astype(np.float32)
    opacity = (1.0 / (1.0 + np.exp(-vertices["opacity"].astype(np.float32)))).astype(np.float32)
    return centers, scales, rotations, opacity


SPZ_MAGIC = 0x5053474E


def read_spz(path: Path):
    data = gzip.decompress(path.read_bytes())
    magic, version, count, _sh, fractional, _flags, _reserved = struct.unpack_from("<IIIBBBB", data, 0)
    if magic != SPZ_MAGIC or version not in (2, 3) or count == 0:
        return None
    at = 16
    raw = np.frombuffer(data, dtype=np.uint8, count=count * 9, offset=at).reshape(count, 3, 3).astype(np.int32)
    at += count * 9
    fixed = raw[:, :, 0] | (raw[:, :, 1] << 8) | (raw[:, :, 2] << 16)
    fixed = np.where(fixed & 0x800000, fixed - (1 << 24), fixed)
    centers = (fixed / float(1 << fractional)).astype(np.float32)
    opacity = np.frombuffer(data, dtype=np.uint8, count=count, offset=at).astype(np.float32) / 255.0
    at += count + count * 3  # alphas, colours
    scales = np.exp(np.frombuffer(data, dtype=np.uint8, count=count * 3, offset=at).reshape(count, 3).astype(np.float32) / 16.0 - 10.0)
    at += count * 3
    if version == 2:
        xyz = np.frombuffer(data, dtype=np.uint8, count=count * 3, offset=at).reshape(count, 3).astype(np.float32) / 127.5 - 1.0
        w = np.sqrt(np.clip(1.0 - (xyz ** 2).sum(axis=1), 0.0, 1.0))
        rotations = np.concatenate([xyz, w[:, None]], axis=1)
    else:
        # The largest component left out (2 bits of index), the three
        # others in 10 bits of magnitude and one of sign each.
        packed = np.frombuffer(data, dtype="<u4", count=count, offset=at)
        largest = packed >> 30
        rotations = np.zeros((count, 4), dtype=np.float32)
        rest = np.zeros(count, dtype=np.float32)
        bits = packed.copy()
        slots = [[i for i in range(4) if i != k] for k in range(4)]
        for position in (2, 1, 0):
            magnitude = (bits & 0x1FF).astype(np.float32) / 511.0 * math.sqrt(0.5)
            negative = (bits >> 9) & 1
            value = np.where(negative == 1, -magnitude, magnitude)
            bits = bits >> 10
            index = np.choose(largest, [s[position] for s in slots])
            rotations[np.arange(count), index] = value
            rest += value ** 2
        rotations[np.arange(count), largest] = np.sqrt(np.clip(1.0 - rest, 0.0, 1.0))
    return centers, scales.astype(np.float32), rotations, opacity


def read_splats(path: Path):
    ext = path.suffix.lower().lstrip(".")
    try:
        if ext == "splat":
            return read_splat(path)
        if ext == "ply":
            return read_ply(path)
        if ext == "spz":
            return read_spz(path)
    except (OSError, ValueError, struct.error, EOFError, gzip.BadGzipFile) as exc:
        print(f"[splat-volume] could not read {path.name}: {exc}", file=sys.stderr)
    return None


# The volume.

def _rotate(q, v):
    """Rotates vectors v (N, 3) by unit quaternions q (N, 4, x y z w)."""
    u, w = q[:, :3], q[:, 3:4]
    t = 2.0 * np.cross(u, v)
    return v + w * t + np.cross(u, t)


def _deposit(grid, points, weights):
    """Trilinear splatting of weights at points (voxel coordinates)."""
    shape = np.array(grid.shape)
    base = np.floor(points - 0.5).astype(np.int64)
    frac = (points - 0.5 - base).astype(np.float32)
    flat = grid.reshape(-1)
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                index = base + (dx, dy, dz)
                w = weights * np.abs(1 - dx - frac[:, 0]) * np.abs(1 - dy - frac[:, 1]) * np.abs(1 - dz - frac[:, 2])
                inside = np.all((index >= 0) & (index < shape), axis=1)
                linear = np.ravel_multi_index(tuple(index[inside].T), grid.shape)
                flat += np.bincount(linear, weights=w[inside], minlength=flat.size).astype(np.float32)


def _blur(grid, sigma):
    radius = max(1, int(math.ceil(sigma * 2.5)))
    x = np.arange(-radius, radius + 1, dtype=np.float32)
    kernel = np.exp(-0.5 * (x / sigma) ** 2)
    kernel /= kernel.sum()
    for axis in range(3):
        padded = np.pad(grid, [(radius, radius) if a == axis else (0, 0) for a in range(3)])
        out = np.zeros_like(grid)
        for k, weight in enumerate(kernel):
            out += weight * np.take(padded, np.arange(k, k + grid.shape[axis]), axis=axis)
        grid = out
    return grid


def _distance(occupied, limit):
    """Distance (voxels) to the nearest occupied voxel, up to limit: the
    separable lower envelope of parabolas, exact within the window."""
    big = np.float32(limit * limit * 3 + 1)
    squared = np.where(occupied, np.float32(0), big).astype(np.float32)
    window = int(math.ceil(limit))
    for axis in range(3):
        padded = np.pad(squared, [(window, window) if a == axis else (0, 0) for a in range(3)], constant_values=big)
        out = squared.copy()
        for offset in range(-window, window + 1):
            if offset:
                shifted = np.take(padded, np.arange(window + offset, window + offset + squared.shape[axis]), axis=axis)
                np.minimum(out, shifted + offset * offset, out=out)
        squared = out
    return np.minimum(np.sqrt(squared), limit)


def _directions(count):
    """Evenly spread unit vectors (a Fibonacci sphere)."""
    i = np.arange(count) + 0.5
    phi = np.arccos(1 - 2 * i / count)
    theta = math.pi * (1 + 5 ** 0.5) * i
    return np.stack([np.cos(theta) * np.sin(phi), np.sin(theta) * np.sin(phi), np.cos(phi)], axis=1)


def _openness(occupied, distance):
    shape = np.array(occupied.shape)
    cells = np.argwhere((distance > 0) & (distance <= OPENNESS_BAND))
    free = np.zeros(len(cells), dtype=np.float32)
    origin = cells.astype(np.float32) + 0.5
    for direction in _directions(OPENNESS_DIRECTIONS):
        hit = np.zeros(len(cells), dtype=bool)
        for step in OPENNESS_STEPS:
            index = np.floor(origin + direction * step).astype(np.int64)
            inside = np.all((index >= 0) & (index < shape), axis=1)
            clipped = np.clip(index, 0, shape - 1)
            hit |= inside & occupied[tuple(clipped.T)]
        free += ~hit
    openness = np.ones(occupied.shape, dtype=np.float32)
    openness[tuple(cells.T)] = np.clip(2.0 * free / OPENNESS_DIRECTIONS, 0.0, 1.0)
    # The surface voxels take the air round them.
    near = _blur(np.where(distance > 0, openness, 0), 1.0)
    weight = _blur((distance > 0).astype(np.float32), 1.0)
    surface = distance == 0
    openness[surface] = np.where(weight[surface] > 1e-3, near[surface] / np.maximum(weight[surface], 1e-3), 1.0)
    return openness


def compute_volume(centers, scales, rotations, opacity, resolution=RESOLUTION):
    keep = np.isfinite(centers).all(axis=1) & np.isfinite(scales).all(axis=1) & (opacity > 0.05)
    centers, scales, rotations, opacity = centers[keep], scales[keep], rotations[keep], opacity[keep]
    if len(centers) < 16:
        return None
    rotations = rotations / np.maximum(np.linalg.norm(rotations, axis=1, keepdims=True), 1e-9)
    low = np.percentile(centers, BOUNDS_PERCENTILE, axis=0)
    high = np.percentile(centers, 100 - BOUNDS_PERCENTILE, axis=0)
    voxel = float(max((high - low).max(), 1e-6)) / max(resolution - 2 * MARGIN, 8)
    # A thin side (a relief, a wall) gets air round it too: a quarter of
    # the longest at least.
    pad = np.maximum(MARGIN * voxel, (resolution // 4 * voxel - (high - low)) / 2)
    origin = low - pad
    dims = np.minimum(np.ceil((high - low + 2 * pad) / voxel).astype(int), resolution).clip(8)

    density = np.zeros(tuple(dims), dtype=np.float32)
    points = (centers - origin) / voxel
    radius = scales.max(axis=1) / voxel
    small = radius <= SPREAD_ABOVE
    _deposit(density, points[small], opacity[small])
    large = np.flatnonzero(~small)
    if len(large):
        rng = np.random.default_rng(0)
        for start in range(0, len(large), 200_000):
            chunk = large[start:start + 200_000]
            for _ in range(SPREAD_SAMPLES):
                z = np.clip(rng.standard_normal((len(chunk), 3)).astype(np.float32), -2, 2)
                offset = _rotate(rotations[chunk], z * scales[chunk]) / voxel
                _deposit(density, points[chunk] + offset, opacity[chunk] / SPREAD_SAMPLES)
    density = _blur(density, 0.8)

    # Surface: where the density is a fair share of what the splats' own
    # voxels hold (stray splats fall below it).
    at_splats = density[tuple(np.clip(points.astype(int), 0, dims - 1).T)]
    occupied = density > 0.3 * float(np.median(at_splats))

    gradient = np.gradient(_blur(density, 1.0))
    tensor = np.stack([_blur(gradient[i] * gradient[j], 1.5) for i, j in ((0, 0), (1, 1), (2, 2), (0, 1), (0, 2), (1, 2))], axis=-1)
    del gradient
    trace = tensor[..., 0] + tensor[..., 1] + tensor[..., 2]
    tensor = np.where(trace[..., None] > 1e-12, tensor / np.maximum(trace, 1e-12)[..., None], 0)

    distance = _distance(occupied, DISTANCE_RANGE)
    openness = _openness(occupied, distance)
    # Away from the surface nothing is read but the distance; constant
    # there, the rest packs small.
    far = distance > OPENNESS_BAND
    tensor[far] = 0
    openness[far] = 1
    # Nor deep inside a solid surface.
    deep = _distance(~occupied, 3) > 2
    tensor[deep] = 0
    openness[deep] = 0

    def byte(values, step=1):
        return (np.clip(np.round(values * 255 / step), 0, 255 // step) * step).astype(np.uint8)

    # The tensor in steps of 4/255: plenty for a normal, and it packs better.
    a = np.stack([byte(tensor[..., 0], 4), byte(tensor[..., 1], 4), byte(tensor[..., 2], 4), byte(openness, 2)], axis=-1)
    b = np.stack([byte(0.5 + tensor[..., 3], 4), byte(0.5 + tensor[..., 4], 4), byte(0.5 + tensor[..., 5], 4), byte(distance / DISTANCE_RANGE)], axis=-1)
    return {
        "dims": dims, "origin": origin, "voxel": voxel,
        "bounds": (centers.min(axis=0), centers.max(axis=0)),
        # x fastest: (z, y, x, channel).
        "a": a.transpose(2, 1, 0, 3), "b": b.transpose(2, 1, 0, 3),
        "occupied": int(occupied.sum()),
    }


def write_volume(volume, out: Path):
    nx, ny, nz = (int(v) for v in volume["dims"])
    header = MAGIC + struct.pack(
        "<I4H4f6f", VERSION, nx, ny, nz, 0, *map(float, volume["origin"]), float(volume["voxel"]),
        *map(float, volume["bounds"][0]), *map(float, volume["bounds"][1]),
    )
    partial = out.with_name(out.name + ".tmp")
    with gzip.open(partial, "wb", compresslevel=6) as file:
        file.write(header)
        file.write(np.ascontiguousarray(volume["a"]).tobytes())
        file.write(np.ascontiguousarray(volume["b"]).tobytes())
    partial.replace(out)


def build_volume(source: Path, out: Path, log_prefix: str = "") -> Path | None:
    """Writes the volume of the splats in `source` to `out`. Returns it, or
    None (unreadable format, too few splats, or turned off)."""
    if not available() or source.suffix.lower().lstrip(".") not in FORMATS:
        return None
    splats = read_splats(source)
    if splats is None:
        return None
    # Never fails the upload: the viewer lights the splats without it.
    try:
        volume = compute_volume(*splats)
        if volume is None or volume["occupied"] == 0:
            return None
        write_volume(volume, out)
    except Exception as exc:  # noqa: BLE001
        print(f"{log_prefix} splat volume failed: {exc}", file=sys.stderr)
        out.unlink(missing_ok=True)
        return None
    print(f"{log_prefix} splat volume {tuple(int(v) for v in volume['dims'])} -> {out.name}", file=sys.stderr)
    return out


def rebuild(source: Path, model: Path, force: bool = False, log_prefix: str = "[splat-volume]"):
    """("kept" | "built" | "failed" | "skipped", path) for the volume of the
    upload `source` served as `model`: an existing one stays unless force,
    and a failed rebuild keeps the old one."""
    out = volume_path_for(model)
    if out.is_file() and not force:
        return "kept", out
    if not available() or source.suffix.lower().lstrip(".") not in FORMATS:
        return "skipped", out if out.is_file() else None
    built = build_volume(source, out.with_name(out.name + ".new"), log_prefix=log_prefix)
    if not built:
        return "failed", out if out.is_file() else None
    built.replace(out)
    for stale in (out.with_name(out.name + ".gz"), out.with_name(out.name + ".nogz")):
        stale.unlink(missing_ok=True)
    return "built", out


if __name__ == "__main__":
    if len(sys.argv) not in (2, 3):
        print("Usage: python3 splat_volume.py capture.splat [out.light]", file=sys.stderr)
        sys.exit(2)
    source = Path(sys.argv[1]).resolve()
    target = Path(sys.argv[2]).resolve() if len(sys.argv) == 3 else volume_path_for(source)
    built = build_volume(source, target, log_prefix="[splat-volume]")
    print(built or "no volume")
    sys.exit(0 if built else 1)
