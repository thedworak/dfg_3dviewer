"""DICOM series -> volumes the viewer renders (viewer/volume.js).

A CT or MRI scan in DICOM is a series: one file per slice (usually a .zip of
a folder, files named *.dcm, IM0001 or without any extension, sometimes with
a DICOMDIR), or one multi-frame file (enhanced CT / MR). Here every series
of two or more slices becomes a volume:

- files are told apart by the "DICM" marker, not their names, and grouped
  by SeriesInstanceUID; a DICOMDIR (the index) and single images
  (localizers, X-rays, scanned documents) are left out;
- slices are put in order along the slice normal (ImageOrientationPatient
  x ImagePositionPatient), else by InstanceNumber; the slice spacing is
  the median step between them, else SpacingBetweenSlices / SliceThickness;
- values are rescaled (RescaleSlope / RescaleIntercept, per slice): CT in
  Hounsfield units; the channel then carries "unit": "HU" and the
  windows the file suggests (WindowCenter / WindowWidth), which the viewer
  offers next to the usual CT presets;
- compressed transfer syntaxes are decoded by pydicom with its plugins
  (RLE built in; JPEG baseline / lossless / JPEG-LS by pylibjpeg-libjpeg,
  JPEG 2000 by pylibjpeg-openjpeg - in Dockerfile.base).

DICOM files carry who the patient is. Only what describes the image goes
into the manifest - modality, device, sizes, the series' description -
never names, identifiers or dates. The upload itself stays in the job
folder as uploaded (as every upload does): anonymise studies before
uploading them.

Output and manifest: volumes.py. The viewer reads uncompressed series
itself too (viewer/dicom-reader.js), when opened without this worker.

Also usable on its own: python3 dicom_series.py <folder or file> [out_dir]
"""

import sys
from pathlib import Path

import numpy as np

from volumes import MAX_SIZE, ManifestWriter, VolumeError, run_cli

FORMATS = {"dcm", "dicom"}
DICOMDIR_CLASS = "1.2.840.10008.1.3.10"


class DicomError(VolumeError):
    pass


def _pydicom():
    try:
        import pydicom
    except ImportError as exc:  # the worker's image has it (Dockerfile.base)
        raise DicomError("Reading DICOM needs the pydicom package") from exc
    return pydicom


def is_dicom(path: Path) -> bool:
    """A DICOM Part 10 file: "DICM" after the 128-byte preamble."""
    try:
        with open(path, "rb") as file:
            head = file.read(132)
    except OSError:
        return False
    return len(head) == 132 and head[128:132] == b"DICM"


def find_files(root: Path):
    return [p for p in sorted(root.rglob("*")) if p.is_file() and (p.suffix.lower() in (".dcm", ".dicom") or is_dicom(p))]


def _floats(value, count=None):
    """A DICOM number or list of numbers as floats (None if missing)."""
    if value is None or value == "":
        return None
    items = [value] if isinstance(value, (str, int, float)) else list(value)
    try:
        values = [float(v) for v in items]
    except (TypeError, ValueError):
        return None
    return values if count is None or len(values) >= count else None


def _windows(ds):
    """[{"name", "center", "width"}] the file suggests."""
    centers = _floats(ds.get("WindowCenter")) or []
    widths = _floats(ds.get("WindowWidth")) or []
    names = ds.get("WindowCenterWidthExplanation") or []
    names = [names] if isinstance(names, str) else list(names)
    return [
        {"name": str(names[i]) if i < len(names) and names[i] else f"Window {i + 1}", "center": c, "width": w}
        for i, (c, w) in enumerate(zip(centers, widths)) if w > 0
    ]


def _describe(ds):
    """What the series is, without who it is of."""
    info = {}
    if ds.get("Modality"):
        info["modality"] = str(ds.Modality)
    system = " ".join(str(v) for v in (ds.get("Manufacturer"), ds.get("ManufacturerModelName")) if v)
    if system:
        info["system"] = system
    if ds.get("BodyPartExamined"):
        info["bodyPart"] = str(ds.BodyPartExamined)
    if ds.get("SliceThickness"):
        info["sliceThicknessMm"] = float(ds.SliceThickness)
    if ds.get("KVP"):
        info["kVp"] = float(ds.KVP)
    return info


def _series_name(ds, index):
    number = ds.get("SeriesNumber")
    description = str(ds.get("SeriesDescription") or "").strip()
    name = " ".join(str(v) for v in (number, description) if v not in (None, ""))
    return name or f"{ds.get('Modality') or 'Series'} {index + 1}"


def _channel(ds, name):
    # CT images are in Hounsfield units by the standard; writers often put
    # "US" (unspecified) as the rescale type all the same.
    unit = "HU" if str(ds.get("Modality", "")) == "CT" and str(ds.get("RescaleType") or "HU").upper() in ("HU", "US") else None
    channel = {"name": name, "color": "#ffffff", "bits": int(ds.get("BitsAllocated", 16))}
    if unit:
        channel["unit"] = unit
    windows = _windows(ds)
    if windows:
        channel["windows"] = windows
    return channel


class SliceView:
    """A (z, y, x) view of a series, one file per slice, rescaled."""

    def __init__(self, files, rows, columns):
        self.files = files
        self.shape = (len(files), rows, columns)

    def __getitem__(self, key):
        pydicom = _pydicom()
        planes = []
        for z in range(*key.indices(self.shape[0])):
            ds = pydicom.dcmread(self.files[z])
            values = ds.pixel_array.astype(np.float32)
            planes.append(values * float(ds.get("RescaleSlope", 1) or 1) + float(ds.get("RescaleIntercept", 0) or 0))
        return np.stack(planes)


def _slice_order(headers):
    """(files sorted along the slice normal, spacing in mm or None)."""
    orientation = _floats(headers[0][1].get("ImageOrientationPatient"), 6)
    positions = [_floats(ds.get("ImagePositionPatient"), 3) for _path, ds in headers]
    if orientation and all(positions):
        normal = np.cross(orientation[:3], orientation[3:6])
        depth = [float(np.dot(normal, p)) for p in positions]
        order = np.argsort(depth)
        steps = np.diff(np.array(depth)[order])
        steps = steps[np.abs(steps) > 1e-4]
        return [headers[i] for i in order], (float(np.median(np.abs(steps))) if len(steps) else None)
    return sorted(headers, key=lambda h: int(h[1].get("InstanceNumber") or 0)), None


def _add_series(writer, headers, index):
    headers, spacing = _slice_order(headers)
    first = headers[0][1]
    rows, columns = int(first.Rows), int(first.Columns)
    name = _series_name(first, index)
    pixel = _floats(first.get("PixelSpacing"), 2) or _floats(first.get("ImagerPixelSpacing"), 2)
    spacing = spacing or float(first.get("SpacingBetweenSlices") or first.get("SliceThickness") or 0) or None
    voxel, unit = ([pixel[1] * 1e3, pixel[0] * 1e3, (spacing or pixel[0]) * 1e3], "µm") if pixel else ([1.0, 1.0, spacing or 1.0], "px")
    writer.add(
        name, f"{len(headers)} slices", [SliceView([p for p, _ds in headers], rows, columns)],
        [_channel(first, name)], voxel, unit=unit, acquisition=_describe(first),
    )


class FrameView:
    """A (z, y, x) view of a multi-frame file's frames, in slice order."""

    def __init__(self, path, order, slopes, intercepts):
        self.path, self.order, self.slopes, self.intercepts = path, order, slopes, intercepts
        self.array = None
        ds = _pydicom().dcmread(path, stop_before_pixels=True)
        self.shape = (len(order), int(ds.Rows), int(ds.Columns))

    def __getitem__(self, key):
        if self.array is None:
            self.array = _pydicom().dcmread(self.path).pixel_array
        indices = [self.order[z] for z in range(*key.indices(self.shape[0]))]
        frames = self.array[indices].astype(np.float32)
        return frames * np.array([self.slopes[i] for i in indices], dtype=np.float32)[:, None, None] + \
            np.array([self.intercepts[i] for i in indices], dtype=np.float32)[:, None, None]


def _add_multiframe(writer, path, ds, index):
    frames = int(ds.NumberOfFrames)
    shared = (ds.get("SharedFunctionalGroupsSequence") or [None])[0]
    per_frame = ds.get("PerFrameFunctionalGroupsSequence") or []

    def group(item, name):
        for source in (item, shared):
            sequence = source.get(name) if source is not None else None
            if sequence:
                return sequence[0]
        return None

    positions, slopes, intercepts = [], [], []
    for i in range(frames):
        item = per_frame[i] if i < len(per_frame) else None
        plane = group(item, "PlanePositionSequence")
        positions.append(_floats(plane.get("ImagePositionPatient"), 3) if plane is not None else None)
        transform = group(item, "PixelValueTransformationSequence")
        source = transform if transform is not None else ds
        slopes.append(float(source.get("RescaleSlope", 1) or 1))
        intercepts.append(float(source.get("RescaleIntercept", 0) or 0))
    orientation_item = group(per_frame[0] if per_frame else None, "PlaneOrientationSequence")
    orientation = _floats(orientation_item.get("ImageOrientationPatient"), 6) if orientation_item is not None else None
    order, spacing = list(range(frames)), None
    if orientation and all(positions):
        normal = np.cross(orientation[:3], orientation[3:6])
        depth = np.array([float(np.dot(normal, p)) for p in positions])
        order = [int(i) for i in np.argsort(depth)]
        steps = np.abs(np.diff(depth[order]))
        steps = steps[steps > 1e-4]
        spacing = float(np.median(steps)) if len(steps) else None
    measures = group(per_frame[0] if per_frame else None, "PixelMeasuresSequence")
    pixel = _floats((measures or ds).get("PixelSpacing"), 2)
    if measures is not None and not spacing:
        spacing = float(measures.get("SpacingBetweenSlices") or measures.get("SliceThickness") or 0) or None
    name = _series_name(ds, index)
    voxel, unit = ([pixel[1] * 1e3, pixel[0] * 1e3, (spacing or pixel[0]) * 1e3], "µm") if pixel else ([1.0, 1.0, spacing or 1.0], "px")
    writer.add(
        name, f"{path.name}: {frames} frames", [FrameView(path, order, slopes, intercepts)],
        [_channel(ds, name)], voxel, unit=unit, acquisition=_describe(ds),
    )


def convert(source: Path, manifest: Path, max_size: int = MAX_SIZE, log_prefix: str = "", root: Path = None) -> dict:
    """Writes the manifest and the volumes of every series among the DICOM
    files under `root` (default: source's folder). Raises DicomError when
    there is none."""
    pydicom = _pydicom()
    root = root or (source if source.is_dir() else source.parent)
    writer = ManifestWriter(source, manifest, max_size, log_prefix, label="DICOM series")
    series = {}
    for path in find_files(root):
        try:
            ds = pydicom.dcmread(path, stop_before_pixels=True)
        except Exception:  # noqa: BLE001 - not readable: not part of a series
            continue
        if str(ds.file_meta.get("MediaStorageSOPClassUID", "")) == DICOMDIR_CLASS or "Rows" not in ds:
            continue
        series.setdefault(str(ds.get("SeriesInstanceUID", "")), []).append((path, ds))
    for index, headers in enumerate(series.values()):
        first = headers[0][1]
        name = _series_name(first, index)
        if int(first.get("SamplesPerPixel", 1)) != 1:
            writer.skip(name, name, "colour images, not a scan")
            continue
        try:
            if len(headers) == 1 and int(first.get("NumberOfFrames", 1) or 1) > 1:
                _add_multiframe(writer, headers[0][0], first, index)
            elif len(headers) < 2:
                writer.skip(name, name, "a single image, not a series (upload the whole series in a .zip)")
            elif len({(int(ds.Rows), int(ds.Columns)) for _p, ds in headers}) > 1:
                writer.skip(name, name, "slices of different sizes")
            else:
                _add_series(writer, headers, index)
        except Exception as exc:  # noqa: BLE001 - e.g. a transfer syntax without its decoder
            writer.skip(name, name, f"not readable: {exc}")
    try:
        return writer.finish()
    except VolumeError as exc:
        raise DicomError(str(exc).replace("image stack (Z series)", "DICOM series")) from exc


if __name__ == "__main__":
    if len(sys.argv) in (2, 3) and Path(sys.argv[1]).is_dir():
        folder = Path(sys.argv[1]).resolve()
        target = (Path(sys.argv[2]).resolve() if len(sys.argv) == 3 else folder) / "volume" / (folder.name + ".dfgvol")
        target.parent.mkdir(parents=True, exist_ok=True)
        print(convert(folder, target, log_prefix="[dicom]") and target)
    else:
        run_cli(convert, "Usage: python3 dicom_series.py <folder or file.dcm> [out_dir]")
