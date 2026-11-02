"""What the volume converters share (lif.py, tiff_stack.py): image stacks ->
the 8-bit volumes the viewer ray-marches (viewer/volume.js).

Each converter reads its format and hands every stack here as one (z, y, x)
array-like per channel - anything with .shape and slicing along z, read a
slab of planes at a time, so stacks larger than memory are fine:

- every axis longer than WORKER_VOLUME_MAX_SIZE voxels is reduced by an
  integer factor, averaging blocks of voxels, the voxel size scaled with it;
- each channel is mapped to 0..255 between low and high percentiles of its
  values (kept in the manifest as "range", in the file's own units), NaN
  (in float data) as the lowest; channels in Hounsfield units ("unit":
  "HU", CT) up to their maximum, so CT windows reach metal and bone;
- the deepest stack comes first in the manifest: the one the viewer opens.

Output, next to the upload:
  volume/<name>.dfgvol             JSON manifest, the model the viewer opens
  volume/<name>/<series>.u8.gz     gzip of the voxels: uint8, channel by
                                   channel, each z y x (x fastest)
  views/<name>_side45.png          thumbnail: maximum intensity projection
                                   of the first stack (write_preview())

Manifest:
  {"format": "dfg-volume", "version": 1, "source": "<upload name>",
   "series": [{"id", "name", "path", "dims": [nx, ny, nz],
               "sourceDims": [...], "voxelSize": [x, y, z],
               "unit": "µm" (or "px" when the file does not say),
               "frames": n, "data": "<name>/<series>.u8.gz",
               "channels": [{"name", "color": "#rrggbb", "range": [lo, hi],
                             "bits", "threshold"}],
               "acquisition": {...}}],
   "skipped": [{"name", "path", "reason"}]}

"threshold" is a channel's Otsu threshold on its 8-bit values (0..1), the
viewer's default for its isosurface.

Configuration (environment):
  WORKER_VOLUME_MAX_SIZE   largest voxel count along an axis (default 512)
"""

import gzip
import json
import math
import os
import re
import struct
import sys
import zlib
from pathlib import Path

import numpy as np

MAX_SIZE = int(os.environ.get("WORKER_VOLUME_MAX_SIZE", "512"))

MANIFEST_SUFFIX = ".dfgvol"
VERSION = 1
# Percentiles of a channel mapped to 0 and 255.
LOW_PERCENTILE = 0.1
HIGH_PERCENTILE = 99.95
DEFAULT_COLOR = "#ffffff"
# Channels without a colour of their own, in order.
PALETTE = ["#00ff00", "#ff00ff", "#00ffff", "#ffff00", "#ff0000", "#0000ff"]
UNIT_TO_MICRONS = {"m": 1e6, "cm": 1e4, "mm": 1e3, "um": 1.0, "µm": 1.0, "micron": 1.0, "microns": 1.0, "nm": 1e-3}


class VolumeError(ValueError):
    """Nothing in the file can be shown as a volume."""


def manifest_path_for(source: Path) -> Path:
    """Where the manifest of `source` goes: Intro.lif -> volume/Intro.dfgvol
    (brain.nii.gz -> volume/brain.dfgvol)."""
    name = source.name[:-3] if source.name.lower().endswith(".gz") else source.name
    return source.parent / "volume" / (Path(name).stem + MANIFEST_SUFFIX)


def microns_per_unit(unit):
    """µm in one `unit` (as files write it), or None for an unknown unit."""
    if not unit:
        return None
    key = str(unit).strip().lower().replace("μ", "µ").replace("\\u00b5", "µ")
    return UNIT_TO_MICRONS.get(key)


def default_colors(count):
    """One grey channel, or the palette for several."""
    return [DEFAULT_COLOR] if count == 1 else [PALETTE[i % len(PALETTE)] for i in range(count)]


def reduction(shape, max_size=MAX_SIZE):
    """Integer factor per axis that brings each under max_size."""
    return tuple(max(1, math.ceil(n / max_size)) for n in shape)


def downsample(view, factors):
    """Block mean of a (z, y, x) view by factors, as float32, read a slab of
    planes at a time."""
    fz, fy, fx = factors
    nz, ny, nx = view.shape
    oz, oy, ox = math.ceil(nz / fz), math.ceil(ny / fy), math.ceil(nx / fx)
    out = np.empty((oz, oy, ox), dtype=np.float32)
    for k in range(oz):
        slab = np.asarray(view[k * fz:(k + 1) * fz], dtype=np.float32).mean(axis=0)
        # Pad the edge so every block is whole.
        pad_y, pad_x = oy * fy - ny, ox * fx - nx
        if pad_y or pad_x:
            slab = np.pad(slab, ((0, pad_y), (0, pad_x)), mode="edge")
        out[k] = slab.reshape(oy, fy, ox, fx).mean(axis=(1, 3))
    return out


def to_bytes(values, high_percentile=HIGH_PERCENTILE):
    """(uint8 voxels, [low, high]) - values mapped between their percentiles."""
    sample = values[:: max(1, values.shape[0] // 64)]
    if not np.isfinite(sample).any():
        return np.zeros(values.shape, dtype=np.uint8), [0.0, 1.0]
    low, high = (float(v) for v in np.nanpercentile(sample, [LOW_PERCENTILE, high_percentile]))
    if high <= low:
        high = low + 1.0
    scaled = np.clip(np.nan_to_num((values - low) * (255.0 / (high - low)), nan=0.0), 0, 255)
    return np.round(scaled).astype(np.uint8), [round(low, 3), round(high, 3)]


def otsu(voxels):
    """Otsu threshold of 8-bit voxels, 0..1."""
    histogram = np.bincount(voxels.ravel(), minlength=256).astype(np.float64)
    total = histogram.sum()
    if total == 0:
        return 0.5
    levels = np.arange(256)
    weight = np.cumsum(histogram)
    mean = np.cumsum(histogram * levels)
    background, foreground = weight, total - weight
    with np.errstate(divide="ignore", invalid="ignore"):
        between = (mean[-1] * background - mean * total) ** 2 / (background * foreground)
    between[~np.isfinite(between)] = 0
    return round(float(np.argmax(between)) / 255.0, 4)


def _png(path: Path, rgb):
    """Writes an (h, w, 3) uint8 array as a PNG, without an imaging library."""
    height, width, _ = rgb.shape
    rows = b"".join(b"\x00" + rgb[y].tobytes() for y in range(height))

    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(rows, 6))
        + chunk(b"IEND", b"")
    )


def write_preview(manifest: Path, volumes: dict, out: Path) -> Path:
    """The thumbnail of the converted file: a maximum intensity projection
    along Z of the stack the viewer opens, its channels in their colours."""
    series = volumes["series"][0]
    nx, ny, nz = series["dims"]
    with gzip.open(manifest.parent / series["data"], "rb") as file:
        voxels = np.frombuffer(file.read(), dtype=np.uint8).reshape(len(series["channels"]), nz, ny, nx)
    image = np.zeros((ny, nx, 3), dtype=np.float32)
    for channel, values in zip(series["channels"], voxels):
        color = np.array([int(channel["color"][i:i + 2], 16) / 255.0 for i in (1, 3, 5)], dtype=np.float32)
        image += values.max(axis=0)[..., None].astype(np.float32) * color
    out.parent.mkdir(parents=True, exist_ok=True)
    _png(out, np.clip(image, 0, 255).astype(np.uint8))
    return out


class ManifestWriter:
    """Collects the stacks of one file into the manifest and its data files."""

    def __init__(self, source: Path, manifest: Path, max_size: int = MAX_SIZE, log_prefix: str = "", label: str = "stack"):
        self.source = source
        self.manifest = manifest
        self.max_size = max_size
        self.log_prefix = log_prefix
        self.label = label
        self.data_dir = manifest.parent / manifest.name[: -len(MANIFEST_SUFFIX)]
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.result = {"format": "dfg-volume", "version": VERSION, "source": source.name, "series": [], "skipped": []}
        self.taken = set()

    def skip(self, name, path, reason):
        self.result["skipped"].append({"name": name, "path": path, "reason": reason})

    def factors(self, shape_zyx):
        return reduction(shape_zyx, self.max_size)

    def add(self, name, path, views, channels, voxel_size, unit="µm", frames=1, acquisition=None):
        """One stack: views - a (z, y, x) array-like per channel; channels -
        their {"name", "color", "bits"}; voxel_size - [x, y, z] of the
        source voxels, in `unit`."""
        nz, ny, nx = views[0].shape
        factors = self.factors((nz, ny, nx))
        planes = []
        for view, channel in zip(views, channels):
            # Hounsfield units up to the maximum: metal and bone, rare
            # voxels, stay inside the range for the CT windows.
            voxels, value_range = to_bytes(downsample(view, factors), 100.0 if channel.get("unit") == "HU" else HIGH_PERCENTILE)
            planes.append(voxels)
            channel["range"] = value_range
            channel["threshold"] = otsu(voxels)
        series_id = self._slug(name)
        data_file = self.data_dir / f"{series_id}.u8.gz"
        partial = data_file.with_name(data_file.name + ".tmp")
        with gzip.open(partial, "wb", compresslevel=6) as file:
            for voxels in planes:
                file.write(np.ascontiguousarray(voxels).tobytes())
        partial.replace(data_file)
        oz, oy, ox = planes[0].shape
        self.result["series"].append({
            "id": series_id,
            "name": name,
            "path": path,
            "dims": [ox, oy, oz],
            "sourceDims": [nx, ny, nz],
            # 6 significant digits: float32 headers say 0.4 as 0.4000000059.
            "voxelSize": [float(f"{v * f:.6g}") for v, f in zip(voxel_size, (factors[2], factors[1], factors[0]))],
            "unit": unit,
            "frames": frames,
            "data": f"{self.data_dir.name}/{data_file.name}",
            "channels": channels,
            "acquisition": acquisition or {},
        })
        print(
            f"{self.log_prefix} {self.label} {path}: {[nx, ny, nz]} -> {[ox, oy, oz]}, "
            f"{len(channels)} channel(s), {data_file.stat().st_size} bytes",
            file=sys.stderr,
        )

    def finish(self):
        """Writes the manifest; raises VolumeError when no stack was added."""
        result = self.result
        if not result["series"]:
            reasons = "; ".join(f"{s['name']}: {s['reason']}" for s in result["skipped"][:5])
            raise VolumeError(
                f"No image stack (Z series) in {self.source.name} to show in 3D" + (f" ({reasons})" if reasons else "")
            )
        result["series"].sort(key=lambda s: -s["sourceDims"][2])
        partial = self.manifest.with_name(self.manifest.name + ".tmp")
        partial.write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")
        partial.replace(self.manifest)
        return result

    def _slug(self, name):
        slug = re.sub(r"[^A-Za-z0-9]+", "-", name).strip("-").lower() or "series"
        unique, number = slug, 2
        while unique in self.taken:
            unique, number = f"{slug}-{number}", number + 1
        self.taken.add(unique)
        return unique


def run_cli(convert, usage):
    """`python3 <converter>.py file [out_dir]`: converts and prints the manifest's path."""
    if len(sys.argv) not in (2, 3):
        print(usage, file=sys.stderr)
        sys.exit(2)
    source = Path(sys.argv[1]).resolve()
    target = manifest_path_for(source)
    if len(sys.argv) == 3:
        target = Path(sys.argv[2]).resolve() / target.name
    target.parent.mkdir(parents=True, exist_ok=True)
    try:
        written = convert(source, target, log_prefix=f"[{Path(sys.argv[0]).stem}]")
    except VolumeError as exc:
        print(exc, file=sys.stderr)
        sys.exit(1)
    print(target)
    for skipped in written["skipped"]:
        print(f"  skipped {skipped['path']}: {skipped['reason']}", file=sys.stderr)
