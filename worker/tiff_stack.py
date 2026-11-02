"""TIFF image stacks -> volumes the viewer renders (viewer/volume.js).

The TIFFs microscopes, Fiji / ImageJ and CT scanners write:

- a multi-page TIFF: one page per slice (or per slice and channel);
- an ImageJ hyperstack: pages in channel, slice, frame order, the order
  and voxel size in its ImageDescription (spacing, unit) and resolution;
- an OME-TIFF: the OME-XML in the first page says the sizes, the order of
  the pages (DimensionOrder), the voxel size (PhysicalSize*), the channels'
  names and colours and the instrument; every image in it is a stack;
- slices one file each, as CT software exports them (in a .zip): a
  single-page TIFF next to others of the same size and type is one slice
  of a stack of all of them, in natural name order (slice_2 before
  slice_10).

Read with tifffile (all compressions, BigTIFF, tiles; imagecodecs for
LZW, JPEG, zstd...), a page at a time. Any pixel type: 8/16/32-bit
integers, signed (CT in Hounsfield units) or not, and float.

The voxel size comes from OME-XML, from ImageJ's spacing and resolution,
or from a resolution in centimetres; resolutions in inches (usually a
meaningless 72 dpi) are ignored. A stack whose slice spacing is not given
is taken as isotropic; with no size at all, the unit is "px" (voxels).

Output and manifest: volumes.py. The viewer reads these TIFFs itself too
(viewer/tiff-reader.js), when opened without this worker.

Also usable on its own: python3 tiff_stack.py stack.tif [out_dir]
"""

import re
import xml.etree.ElementTree as ET
from pathlib import Path

import numpy as np

from volumes import MAX_SIZE, ManifestWriter, VolumeError, default_colors, microns_per_unit, run_cli

FORMATS = {"tif", "tiff"}
RESOLUTION_CENTIMETER = 3


class TiffStackError(VolumeError):
    pass


def _natural_key(path: Path):
    return [int(part) if part.isdigit() else part.lower() for part in re.split(r"(\d+)", path.name)]


def _tifffile():
    try:
        import tifffile
    except ImportError as exc:  # the worker's image has it (Dockerfile.base)
        raise TiffStackError("Reading TIFF stacks needs the tifffile package") from exc
    return tifffile


class PagedChannel:
    """A (z, y, x) view of one channel of a TIFF series: planes read from
    their pages when sliced."""

    def __init__(self, shape, page_of, sample=None):
        self.shape = shape
        self.page_of = page_of
        self.sample = sample

    def __getitem__(self, key):
        planes = []
        for z in range(*key.indices(self.shape[0])):
            plane = self.page_of(z).asarray()
            if self.sample is not None:
                plane = plane[..., self.sample]
            planes.append(plane)
        return np.stack(planes)


def _ome(xml):
    """Per image of the OME-XML: voxel size (µm or None), channels, acquisition."""
    try:
        root = ET.fromstring(xml)
    except ET.ParseError:
        return []
    instruments = {i.get("ID"): i for i in root.findall(".//{*}Instrument")}
    images = []
    for image in root.findall(".//{*}Image"):
        pixels = image.find("{*}Pixels")
        if pixels is None:
            continue
        size = []
        for axis in "XYZ":
            value = pixels.get(f"PhysicalSize{axis}")
            scale = microns_per_unit(pixels.get(f"PhysicalSize{axis}Unit") or "µm")
            size.append(float(value) * scale if value and scale else None)
        channels = []
        for channel in pixels.findall("{*}Channel"):
            color = channel.get("Color")
            if color is not None:
                rgba = int(color) & 0xFFFFFFFF
                color = f"#{(rgba >> 24) & 255:02x}{(rgba >> 16) & 255:02x}{(rgba >> 8) & 255:02x}"
                # Black is what writers put when they mean "no colour".
                if color == "#000000":
                    color = None
            channels.append({"name": channel.get("Name") or channel.get("Fluor") or "", "color": color})
        acquisition = {}
        if image.findtext("{*}AcquisitionDate"):
            acquisition["acquired"] = image.findtext("{*}AcquisitionDate")
        ref = image.find("{*}InstrumentRef")
        instrument = instruments.get(ref.get("ID")) if ref is not None else None
        if instrument is not None:
            objective = instrument.find("{*}Objective")
            if objective is not None:
                name = " ".join(filter(None, (objective.get("Manufacturer"), objective.get("Model"))))
                if name:
                    acquisition["objective"] = name
                if objective.get("LensNA"):
                    acquisition["numericalAperture"] = float(objective.get("LensNA"))
            microscope = instrument.find("{*}Microscope")
            if microscope is not None:
                name = " ".join(filter(None, (microscope.get("Manufacturer"), microscope.get("Model"))))
                if name:
                    acquisition["system"] = name
        images.append({"name": image.get("Name") or "", "size": size, "channels": channels, "acquisition": acquisition})
    return images


def _resolution_size(page, unit_scale=None):
    """µm per pixel in x and y from the page's resolution tags, or None."""
    sizes = []
    for tag in ("XResolution", "YResolution"):
        value = page.tags.get(tag)
        if value is None:
            return None
        numerator, denominator = value.value
        if not numerator or not denominator:
            return None
        sizes.append(denominator / numerator)
    if unit_scale is not None:
        return [s * unit_scale for s in sizes]
    unit = page.tags.get("ResolutionUnit")
    if unit is None or int(unit.value) != RESOLUTION_CENTIMETER:
        return None
    return [s * 1e4 for s in sizes]


def _voxel(xy, z):
    """[x, y, z] and the unit, from what is known."""
    if xy and all(xy):
        return [xy[0], xy[1], z if z else xy[0]], "µm"
    return [1.0, 1.0, 1.0], "px"


def _imagej(tif, page):
    """Voxel size and unit of an ImageJ TIFF."""
    meta = tif.imagej_metadata or {}
    scale = microns_per_unit(meta.get("unit"))
    xy = _resolution_size(page, scale) if scale else None
    z = float(meta["spacing"]) * scale if scale and meta.get("spacing") else None
    return _voxel(xy, z)


def _series_views(series):
    """(views per channel, frames) of a tifffile series, or a skip reason."""
    axes = series.axes
    shape = dict(zip(axes, series.shape))
    if "Y" not in shape or "X" not in shape:
        return "not an image"
    # A stack's slices: Z, else a generic axis (Q, I) when nothing else is.
    z_axis = "Z" if "Z" in shape else next((a for a in "QI" if a in shape), None)
    if not z_axis or shape[z_axis] < 2:
        return "a single plane, not a stack"
    page_axes = [a for a in axes if a not in "YXS"]
    page_shape = [shape[a] for a in page_axes]
    pages = series.pages
    if len(pages) != int(np.prod(page_shape)):
        return "pages stored in an unexpected layout"
    channel_axis = "C" if "C" in page_axes else None
    sample_count = shape.get("S", 1)
    channel_count = shape[channel_axis] if channel_axis else sample_count
    ny, nx, nz = shape["Y"], shape["X"], shape[z_axis]

    def page_getter(channel):
        def page_of(z):
            coords = [z if a == z_axis else channel if a == channel_axis else 0 for a in page_axes]
            return pages[int(np.ravel_multi_index(coords, page_shape))]
        return page_of

    views = [
        PagedChannel((nz, ny, nx), page_getter(c if channel_axis else 0), sample=None if channel_axis or sample_count == 1 else c)
        for c in range(channel_count)
    ]
    return views, shape.get("T", 1)


def _bits(dtype):
    return np.dtype(dtype).itemsize * 8


def _slice_stack(source: Path, tifffile):
    """The single-page TIFFs of the same size and type next to source, in
    natural order, if there are at least two."""
    with tifffile.TiffFile(source) as tif:
        first = tif.pages[0]
        signature = (first.shape, first.dtype)
    slices = []
    for path in sorted(source.parent.iterdir(), key=_natural_key):
        if path.suffix.lower().lstrip(".") not in FORMATS or not path.is_file():
            continue
        try:
            with tifffile.TiffFile(path) as tif:
                if len(tif.pages) == 1 and (tif.pages[0].shape, tif.pages[0].dtype) == signature:
                    slices.append(path)
        except Exception:  # noqa: BLE001 - not a TIFF after all: not a slice
            continue
    return slices if len(slices) >= 2 else None


def convert(source: Path, manifest: Path, max_size: int = MAX_SIZE, log_prefix: str = "") -> dict:
    """Writes the manifest and the volumes of the stacks in `source` (or of
    the slices next to it). Raises TiffStackError when nothing can be shown."""
    tifffile = _tifffile()
    writer = ManifestWriter(source, manifest, max_size, log_prefix, label="TIFF")
    try:
        tif = tifffile.TiffFile(source)
    except Exception as exc:  # noqa: BLE001 - any parse error is "not a TIFF"
        raise TiffStackError(f"{source.name} is not a readable TIFF: {exc}") from exc
    with tif:
        single_page = len(tif.pages) == 1 and tif.pages[0].ndim == 2
        if single_page and (slices := _slice_stack(source, tifffile)):
            return _convert_slices(slices, writer, tifffile)
        ome = _ome(tif.ome_metadata) if tif.is_ome and tif.ome_metadata else []
        for index, series in enumerate(tif.series):
            name = (ome[index]["name"] if index < len(ome) else "") or series.name or source.stem
            name = name if len(tif.series) == 1 or name != source.stem else f"{source.stem} {index + 1}"
            found = _series_views(series)
            if isinstance(found, str):
                writer.skip(name, f"{source.name}/{index}", found)
                continue
            views, frames = found
            page = series.pages[0]
            if index < len(ome):
                size = ome[index]["size"]
                voxel, unit = _voxel(size[:2] if all(size[:2]) else None, size[2])
            elif tif.is_imagej:
                voxel, unit = _imagej(tif, page)
            else:
                voxel, unit = _voxel(_resolution_size(page), None)
            meta = ome[index]["channels"] if index < len(ome) else []
            colors = default_colors(len(views))
            channels = [
                {
                    "name": (meta[c]["name"] if c < len(meta) else "") or (f"Channel {c + 1}" if len(views) > 1 else name),
                    "color": (meta[c]["color"] if c < len(meta) else None) or colors[c],
                    "bits": _bits(series.dtype),
                }
                for c in range(len(views))
            ]
            writer.add(
                name, f"{source.name}/{index}", views, channels, voxel, unit=unit, frames=frames,
                acquisition=ome[index]["acquisition"] if index < len(ome) else {},
            )
    try:
        return writer.finish()
    except VolumeError as exc:
        raise TiffStackError(str(exc)) from exc


def _convert_slices(slices, writer, tifffile):
    files = [tifffile.TiffFile(path) for path in slices]
    try:
        first = files[0].pages[0]
        ny, nx = first.shape
        view = PagedChannel((len(files), ny, nx), lambda z: files[z].pages[0])
        voxel, unit = _voxel(_resolution_size(first), None)
        name = slices[0].parent.name if slices[0].parent.name not in ("", "extracted") else slices[0].stem
        writer.add(
            name,
            f"{slices[0].name} … {slices[-1].name}",
            [view],
            [{"name": name, "color": default_colors(1)[0], "bits": _bits(first.dtype)}],
            voxel,
            unit=unit,
        )
    finally:
        for tif in files:
            tif.close()
    return writer.finish()


if __name__ == "__main__":
    run_cli(convert, "Usage: python3 tiff_stack.py stack.tif [out_dir]")
