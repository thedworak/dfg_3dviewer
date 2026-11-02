"""Leica LIF image stacks -> volumes the viewer renders (viewer/volume.js).

A .lif (Leica Application Suite X / LAS AF) is a project: an XML header
describing a tree of series, then the raw pixel data of each series in
memory blocks. A series has dimensions X, Y and possibly Z (a stack), T
(time), tiles (a mosaic) and others, one or more channels, and an
acquisition record (microscope, objective, lasers, detectors).

Here each Z stack in the file is turned into a volume of 8-bit voxels the
viewer draws by ray marching (output and manifest: volumes.py):

- the layout is read from the XML, never assumed: each channel and
  dimension gives its own byte stride (BytesInc), and series in one file
  differ - channels one after another, or interleaved plane by plane;
- of a time series only the first frame is taken, and mosaics (tiles not
  merged into one image) and single planes are left out, listed under
  "skipped" with the reason. LAS X's "<name>_Merged" series of a mosaic is
  an ordinary image or stack and taken.

The .lifext LAS X writes next to a .lif (8-bit display pyramids with a
gamma applied, histograms) is not needed and not read.

The viewer reads .lif files itself too (viewer/lif-reader.js, the same
steps), when opened without this worker.

Also usable on its own: python3 lif.py sample.lif [out_dir]
"""

import re
import struct
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np

from volumes import (
    DEFAULT_COLOR, MANIFEST_SUFFIX, MAX_SIZE, ManifestWriter, VolumeError, manifest_path_for,
    microns_per_unit, run_cli, write_preview,
)

FORMATS = {"lif"}
HEADER_MAGIC = 0x70
BLOCK_MARK = 0x2A

DIM_X, DIM_Y, DIM_Z, DIM_T, DIM_TILE = 1, 2, 3, 4, 10

# LUT names LAS X gives channels -> display colours.
LUT_COLORS = {
    "red": "#ff0000", "green": "#00ff00", "blue": "#0000ff", "cyan": "#00ffff",
    "magenta": "#ff00ff", "yellow": "#ffff00", "gray": "#ffffff", "grey": "#ffffff",
}
# Windows FILETIME (100 ns since 1601), as LAS X stores time stamps.
FILETIME_EPOCH = datetime(1601, 1, 1, tzinfo=timezone.utc)


class LifError(VolumeError):
    pass


# Reading the file.

def read_header(path: Path):
    """(XML root, {memory block id: (data offset, size)})."""
    with open(path, "rb") as file:
        head = file.read(13)
        if len(head) < 13:
            raise LifError("not a LIF file (too short)")
        magic, _size, mark, chars = struct.unpack("<IIBI", head)
        if magic != HEADER_MAGIC or mark != BLOCK_MARK:
            raise LifError("not a LIF file")
        root = ET.fromstring(file.read(chars * 2).decode("utf-16-le"))
        # Version 1 has 32-bit block sizes, version 2 64-bit.
        wide = int(root.get("Version", "2")) >= 2
        blocks = {}
        while True:
            head = file.read(8)
            if len(head) < 8:
                break
            magic, _size = struct.unpack("<II", head)
            if magic != HEADER_MAGIC:
                raise LifError(f"damaged memory block at byte {file.tell() - 8}")
            file.read(1)
            (size,) = struct.unpack("<Q" if wide else "<I", file.read(8 if wide else 4))
            file.read(1)
            (chars,) = struct.unpack("<I", file.read(4))
            block_id = file.read(chars * 2).decode("utf-16-le")
            blocks[block_id] = (file.tell(), size)
            file.seek(size, 1)
    return root, blocks


def _float(value, fallback=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _channel_name(channel, index):
    properties = {
        prop.findtext("Key"): (prop.findtext("Value") or "").strip()
        for prop in channel.findall("ChannelProperty")
    }
    lut = channel.get("LUTName") or ""
    name = properties.get("DyeName") or properties.get("DetectorName")
    return f"{name} ({lut})" if name and lut else name or lut or f"Channel {index + 1}"


def _acquisition(image):
    """What the series was taken with, as far as the XML tells."""
    info = {}
    setting = image.find(".//ATLConfocalSettingDefinition")
    if setting is None:
        setting = image.find(".//ATLCameraSettingDefinition")
    if setting is not None:
        objective = re.sub(r"\s+", " ", setting.get("ObjectiveName") or "").strip()
        if objective:
            info["objective"] = objective
        if setting.get("NumericalAperture"):
            info["numericalAperture"] = _float(setting.get("NumericalAperture"))
        if setting.get("Immersion"):
            info["immersion"] = setting.get("Immersion").strip()
        if setting.get("Zoom"):
            info["zoom"] = _float(setting.get("Zoom"))
        if setting.get("PinholeAiry"):
            info["pinholeAiry"] = round(_float(setting.get("PinholeAiry")), 3)
    hardware = image.find("Attachment[@Name='HardwareSetting']")
    if hardware is not None and hardware.get("SystemTypeName"):
        info["system"] = hardware.get("SystemTypeName")
    stand = image.find(".//*[@MicroscopeModel]")
    if stand is not None and stand.get("MicroscopeModel") not in (None, "", "1"):
        info["stand"] = stand.get("MicroscopeModel")
    lasers = sorted({
        int(_float(line.get("LaserLine")))
        for line in image.iter("LaserLineSetting")
        if _float(line.get("IntensityDev")) > 0
    })
    if lasers:
        info["laserLinesNm"] = lasers
    stamps = image.findtext("TimeStampList") or ""
    first = stamps.split()[:1]
    if first:
        try:
            when = FILETIME_EPOCH + timedelta(microseconds=int(first[0], 16) / 10)
            info["acquired"] = when.isoformat(timespec="seconds")
        except (ValueError, OverflowError):
            pass
    return info


def list_series(root, blocks):
    """Every image in the file: dicts with its name, path in the project
    tree, dimensions, channels and data offset."""
    found = []

    def walk(element, path):
        for child in element.findall("Children/Element") if path else element.findall("Element"):
            name = child.get("Name") or "?"
            child_path = f"{path}/{name}" if path else name
            image = child.find("Data/Image")
            memory = child.find("Memory")
            description = image.find("ImageDescription") if image is not None else None
            if description is not None and memory is not None and memory.get("MemoryBlockID") in blocks:
                dims = {
                    int(d.get("DimID")): {
                        "count": int(d.get("NumberOfElements")),
                        "length": abs(_float(d.get("Length"))),
                        "unit": d.get("Unit") or "",
                        "stride": int(d.get("BytesInc")),
                    }
                    for d in description.iter("DimensionDescription")
                }
                channels = [
                    {
                        "name": _channel_name(c, i),
                        "lut": c.get("LUTName") or "",
                        "bits": int(c.get("Resolution") or 8),
                        "float": c.get("DataType") == "1",
                        "offset": int(c.get("BytesInc") or 0),
                    }
                    for i, c in enumerate(description.iter("ChannelDescription"))
                ]
                offset, size = blocks[memory.get("MemoryBlockID")]
                found.append({
                    "name": name, "path": child_path, "dims": dims, "channels": channels,
                    "offset": offset, "size": size, "image": image,
                })
            walk(child, child_path)

    walk(root, "")
    return found


def skip_reason(series):
    dims = series["dims"]
    if series["size"] == 0 or not series["channels"]:
        return "no image data"
    if DIM_X not in dims or DIM_Y not in dims:
        return "not an image"
    if dims.get(DIM_TILE, {}).get("count", 1) > 1:
        return "mosaic of separate tiles (open the merged image instead)"
    if dims.get(DIM_Z, {}).get("count", 1) < 2:
        return "a single plane, not a stack"
    if any(c["float"] for c in series["channels"]):
        return "floating-point data"
    return None


def voxel_size_um(dim):
    """Distance between neighbouring voxels along a dimension, in µm."""
    if dim["count"] < 2:
        return 1.0
    scale = microns_per_unit(dim["unit"]) or 1.0
    size = dim["length"] / (dim["count"] - 1) * scale
    return size if size > 0 else 1.0


def channel_view(mm, series, channel):
    """A (z, y, x) view of one channel of the first frame, from its byte
    strides; other dimensions (time, ...) at their first element."""
    dims = series["dims"]
    itemsize = 1 if channel["bits"] <= 8 else 2
    dtype = np.uint8 if itemsize == 1 else np.dtype("<u2")
    shape = tuple(dims[d]["count"] for d in (DIM_Z, DIM_Y, DIM_X))
    strides = tuple(dims[d]["stride"] for d in (DIM_Z, DIM_Y, DIM_X))
    end = series["offset"] + channel["offset"] + sum((n - 1) * s for n, s in zip(shape, strides)) + itemsize
    if end > series["offset"] + series["size"] or end > len(mm):
        raise LifError(f"{series['path']}: the data is shorter than its dimensions")
    return np.ndarray(shape, dtype=dtype, buffer=mm, offset=series["offset"] + channel["offset"], strides=strides)


def convert(source: Path, manifest: Path, max_size: int = MAX_SIZE, log_prefix: str = "") -> dict:
    """Writes the manifest and the volumes of every stack in `source`.
    Returns the manifest. Raises LifError when nothing can be shown."""
    root, blocks = read_header(source)
    mm = np.memmap(source, dtype=np.uint8, mode="r")
    writer = ManifestWriter(source, manifest, max_size, log_prefix, label="LIF series")
    for series in list_series(root, blocks):
        reason = skip_reason(series)
        if reason:
            writer.skip(series["name"], series["path"], reason)
            continue
        dims = series["dims"]
        try:
            views = [channel_view(mm, series, channel) for channel in series["channels"]]
        except LifError as exc:
            writer.skip(series["name"], series["path"], str(exc))
            continue
        writer.add(
            series["name"],
            series["path"],
            views,
            [
                {"name": c["name"], "color": LUT_COLORS.get(c["lut"].lower(), DEFAULT_COLOR), "bits": c["bits"]}
                for c in series["channels"]
            ],
            [voxel_size_um(dims[d]) for d in (DIM_X, DIM_Y, DIM_Z)],
            frames=dims.get(DIM_T, {}).get("count", 1),
            acquisition=_acquisition(series["image"]),
        )
    try:
        return writer.finish()
    except VolumeError as exc:
        raise LifError(str(exc)) from exc


if __name__ == "__main__":
    run_cli(convert, "Usage: python3 lif.py sample.lif [out_dir]")
