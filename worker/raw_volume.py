"""NRRD, NIfTI and MetaImage volumes -> volumes the viewer renders
(viewer/volume.js).

Three formats of a header and the raw voxels, from medicine (CT, MRI),
neuroimaging and image analysis tools (3D Slicer, ITK, ITK-SNAP, Fiji):

- NRRD: .nrrd (header and data in one file) or .nhdr (header; the data in
  the file its "data file" names). Encodings raw, gzip, bzip2 and ascii;
  a non-spatial first axis (kinds vector / list / RGB-color...) is the
  channels, interleaved per voxel, a fourth domain axis is time;
- NIfTI-1 and NIfTI-2: .nii and .nii.gz; dim 4 is time, dim 5 the
  channels; scl_slope / scl_inter applied;
- MetaImage: .mha (one file) or .mhd (header; data in ElementDataFile,
  LOCAL or a file next to it), zlib-compressed or not, with
  ElementNumberOfChannels interleaved per voxel.

Of a time series only the first time point is taken; the stack is taken
axis-aligned (the files' direction cosines, oblique slices, are not applied).

Units: NIfTI says them (xyzt_units: m, mm, µm); NRRD in "space units", else
millimetres when it has a space (medical data), else unknown; MetaImage, by
ITK's convention, millimetres. Sizes in an unknown unit keep their ratios
under the unit "px".

Data is read a plane at a time by seeking in the file - in the decompressed
stream for gzip / bzip2 / zlib - so volumes larger than memory are fine.

Output and manifest: volumes.py. The viewer reads these files itself too
(viewer/raw-volume-reader.js), when opened without this worker.

Also usable on its own: python3 raw_volume.py brain.nii.gz [out_dir]
"""

import bz2
import gzip
import io
import re
import struct
import zlib
from pathlib import Path

import numpy as np

from volumes import MAX_SIZE, ManifestWriter, VolumeError, default_colors, microns_per_unit, run_cli

FORMATS = {"nrrd", "nhdr", "nii", "mha", "mhd"}

NRRD_TYPES = {
    "uchar": "u1", "unsigned char": "u1", "uint8": "u1", "uint8_t": "u1",
    "signed char": "i1", "int8": "i1", "int8_t": "i1",
    "short": "i2", "short int": "i2", "signed short": "i2", "signed short int": "i2", "int16": "i2", "int16_t": "i2",
    "ushort": "u2", "unsigned short": "u2", "unsigned short int": "u2", "uint16": "u2", "uint16_t": "u2",
    "int": "i4", "signed int": "i4", "int32": "i4", "int32_t": "i4",
    "uint": "u4", "unsigned int": "u4", "uint32": "u4", "uint32_t": "u4",
    "longlong": "i8", "long long": "i8", "int64": "i8", "int64_t": "i8",
    "ulonglong": "u8", "unsigned long long": "u8", "uint64": "u8", "uint64_t": "u8",
    "float": "f4", "double": "f8",
}
NIFTI_TYPES = {2: "u1", 4: "i2", 8: "i4", 16: "f4", 64: "f8", 256: "i1", 512: "u2", 768: "u4", 1024: "i8", 1280: "u8"}
NIFTI_UNITS = {1: 1e6, 2: 1e3, 3: 1.0}
MET_TYPES = {
    "MET_UCHAR": "u1", "MET_CHAR": "i1", "MET_USHORT": "u2", "MET_SHORT": "i2", "MET_UINT": "u4", "MET_INT": "i4",
    "MET_ULONG": "u4", "MET_LONG": "i4", "MET_ULONG_LONG": "u8", "MET_LONG_LONG": "i8", "MET_FLOAT": "f4", "MET_DOUBLE": "f8",
}
NRRD_NON_SPATIAL = {"vector", "covariant-vector", "normal", "list", "point", "rgb-color", "hsv-color", "xyz-color",
                    "rgba-color", "complex", "2-vector", "3-color", "3-vector", "4-color", "4-vector"}


class RawVolumeError(VolumeError):
    pass


def model_ext(path: Path) -> str:
    """The format of path: its extension, "nii" for a .nii.gz."""
    name = path.name.lower()
    return "nii" if name.endswith(".nii.gz") else path.suffix.lower().lstrip(".")


def stem(path: Path) -> str:
    """brain.nii.gz -> brain."""
    name = path.name
    return name[:-7] if name.lower().endswith(".nii.gz") else path.stem


class ZlibFile(io.RawIOBase):
    """A zlib stream (MetaImage's CompressedData) read forward, rewound by
    starting again."""

    def __init__(self, path: Path, offset: int):
        self.path, self.offset = path, offset
        self._open()

    def _open(self):
        self.file = open(self.path, "rb")
        self.file.seek(self.offset)
        self.inflate = zlib.decompressobj()
        self.buffer = b""
        self.position = 0

    def read(self, size=-1):
        while size < 0 or len(self.buffer) < size:
            chunk = self.file.read(1 << 20)
            if not chunk:
                self.buffer += self.inflate.flush()
                break
            self.buffer += self.inflate.decompress(chunk)
        data, self.buffer = (self.buffer, b"") if size < 0 else (self.buffer[:size], self.buffer[size:])
        self.position += len(data)
        return data

    def seek(self, target, whence=io.SEEK_SET):
        if target < self.position:
            self.file.close()
            self._open()
        while self.position < target:
            if not self.read(min(target - self.position, 1 << 22)):
                break
        return self.position

    def close(self):
        self.file.close()


class _Owning:
    """A decompressing stream that also closes the file under it."""

    def __init__(self, stream, file):
        self.stream, self.file = stream, file

    def read(self, size=-1):
        return self.stream.read(size)

    def seek(self, position):
        return self.stream.seek(position)

    def close(self):
        self.stream.close()
        self.file.close()


class Volume:
    """What a header says: the stack's (z, y, x) shape, channels, pixel type
    and where its bytes are (in the data stream `open_data()` returns)."""

    def __init__(self, name, shape, channels, dtype, open_data, offset=0, interleaved=True, channel_stride=0,
                 voxel=(1.0, 1.0, 1.0), unit="px", frames=1, slope=1.0, intercept=0.0):
        self.name, self.shape, self.channels, self.dtype = name, shape, channels, np.dtype(dtype)
        self.open_data, self.offset, self.interleaved, self.channel_stride = open_data, offset, interleaved, channel_stride
        self.voxel, self.unit, self.frames, self.slope, self.intercept = list(voxel), unit, frames, slope, intercept


class PlaneView:
    """A (z, y, x) view of one channel of a Volume, read when sliced."""

    def __init__(self, volume: Volume, channel: int, data):
        self.volume, self.channel, self.data = volume, channel, data
        self.shape = volume.shape

    def __getitem__(self, key):
        v = self.volume
        nz, ny, nx = v.shape
        per_voxel = v.channels if v.interleaved else 1
        plane_bytes = ny * nx * per_voxel * v.dtype.itemsize
        planes = []
        for z in range(*key.indices(nz)):
            self.data.seek(v.offset + (0 if v.interleaved else self.channel * v.channel_stride) + z * plane_bytes)
            raw = self.data.read(plane_bytes)
            if len(raw) < plane_bytes:
                raise RawVolumeError(f"{v.name}: the data ends before slice {z + 1} of {nz}")
            values = np.frombuffer(raw, dtype=v.dtype).reshape(ny, nx, per_voxel)[..., self.channel if v.interleaved else 0]
            planes.append(values)
        stack = np.stack(planes).astype(np.float32)
        if v.slope not in (0.0, 1.0) or v.intercept:
            stack = stack * (v.slope or 1.0) + v.intercept
        return stack


def _opener(path: Path, encoding: str, file_offset: int = 0, skip: int = 0):
    """(open_data, offset of the voxels in its stream) for data starting at
    file_offset in path, compressed or not, after `skip` bytes of it."""
    if encoding in ("gzip", "gz", "bzip2", "bz2"):
        def open_data():
            file = open(path, "rb")
            file.seek(file_offset)
            stream = gzip.GzipFile(fileobj=file) if encoding in ("gzip", "gz") else bz2.BZ2File(file)
            return _Owning(stream, file)
        return open_data, skip
    if encoding == "zlib":
        return (lambda: ZlibFile(path, file_offset)), skip
    return (lambda: open(path, "rb")), file_offset + skip


# NRRD.

def _nrrd_header(path: Path):
    """(fields, data offset in the file) of a NRRD header."""
    fields = {}
    with open(path, "rb") as file:
        magic = file.readline()
        if not magic.startswith(b"NRRD000"):
            raise RawVolumeError(f"{path.name} is not a NRRD file")
        while True:
            line = file.readline()
            if not line or line in (b"\n", b"\r\n"):
                break
            text = line.decode("latin-1").rstrip("\r\n")
            if text.startswith("#"):
                continue
            match = re.match(r"([^:]+):=?\s?(.*)", text)
            if match:
                fields[match.group(1).strip().lower()] = match.group(2).strip()
        return fields, file.tell()


def _vectors(text):
    """'(1,0,0) (0,1,0) none' -> [[1,0,0], [0,1,0], None]."""
    return [None if part == "none" else [float(v) for v in part.strip("()").split(",")]
            for part in re.findall(r"\([^)]*\)|none", text)]


def _quoted(text):
    return re.findall(r'"([^"]*)"', text) or text.split()


def read_nrrd(path: Path) -> Volume:
    fields, header_end = _nrrd_header(path)
    sizes = [int(s) for s in fields.get("sizes", "").split()]
    dtype = NRRD_TYPES.get(fields.get("type", "").lower())
    if not sizes or dtype is None:
        raise RawVolumeError(f"{path.name}: unsupported NRRD type {fields.get('type')!r}")
    endian = "<" if fields.get("endian", "little") == "little" or dtype.endswith("1") else ">"
    kinds = fields.get("kinds", "").lower().split() if "kinds" in fields else ["domain"] * len(sizes)
    # Axes run fastest first: an optional channel axis, then x, y, z, (t).
    channels = 1
    if kinds and kinds[0] in NRRD_NON_SPATIAL:
        channels, sizes, kinds = sizes[0], sizes[1:], kinds[1:]
    if len(sizes) < 3 or sizes[2] < 2:
        raise RawVolumeError(f"{path.name}: a single plane, not a stack")
    nx, ny, nz = sizes[:3]
    frames = int(np.prod(sizes[3:])) if len(sizes) > 3 else 1
    # Voxel size: lengths of the space directions, else spacings.
    spatial = [v for v in _vectors(fields.get("space directions", "")) if v is not None]
    if len(spatial) >= 3:
        size = [float(np.linalg.norm(v)) for v in spatial[:3]]
    else:
        spacings = fields.get("spacings", "").split()
        size = [abs(float(s)) if s not in ("nan", "NaN") else 1.0 for s in spacings[-len(sizes):][:3]] if spacings else []
    units = _quoted(fields.get("space units", ""))
    scale = microns_per_unit(units[0]) if units else (1e3 if "space" in fields or "space dimension" in fields else None)
    voxel, unit = ((size, "µm") if scale and len(size) == 3 else (size if len(size) == 3 else [1.0, 1.0, 1.0], "px"))
    if unit == "µm":
        voxel = [s * scale for s in size]
    encoding = fields.get("encoding", "raw").lower()
    data_file = fields.get("data file") or fields.get("datafile")
    data_path, file_offset = path, header_end
    if data_file:
        if data_file.startswith("LIST") or "%" in data_file:
            raise RawVolumeError(f"{path.name}: NRRD data split over several files is not supported")
        data_path, file_offset = path.parent / data_file.split()[0], 0
    # Bytes to skip in the (decompressed) data; -1: the data ends the file.
    skip = int(fields.get("byte skip", "0"))
    if skip == -1:
        if encoding != "raw":
            raise RawVolumeError(f"{path.name}: byte skip -1 needs raw encoding")
        file_offset, skip = data_path.stat().st_size - nx * ny * nz * frames * channels * np.dtype(dtype).itemsize, 0
    name = stem(path)
    if encoding in ("ascii", "text", "txt"):
        with open(data_path, "rb") as file:
            file.seek(file_offset)
            values = np.array(file.read().split(), dtype=np.float64).astype(dtype)
        data = values.tobytes()
        open_data, offset = (lambda: io.BytesIO(data)), 0
        endian = "="
    elif encoding not in ("raw", "gzip", "gz", "bzip2", "bz2"):
        raise RawVolumeError(f"{path.name}: unsupported NRRD encoding {encoding!r}")
    else:
        open_data, offset = _opener(data_path, encoding, file_offset, skip)
    return Volume(name, (nz, ny, nx), channels, endian + dtype, open_data, offset, True, 0, voxel, unit, frames)


# NIfTI.

def read_nifti(path: Path) -> Volume:
    opener = gzip.open if path.name.lower().endswith(".gz") else open
    with opener(path, "rb") as file:
        head = file.read(540)
    for endian in "<>":
        size = struct.unpack(endian + "i", head[:4])[0]
        if size in (348, 540):
            break
    else:
        raise RawVolumeError(f"{path.name} is not a NIfTI file")
    if size == 348:
        if head[344:347] != b"n+1":
            raise RawVolumeError(f"{path.name}: a NIfTI header and image pair (.hdr/.img) is not supported")
        dims = struct.unpack(endian + "8h", head[40:56])
        datatype = struct.unpack(endian + "h", head[70:72])[0]
        pixdim = struct.unpack(endian + "8f", head[76:108])
        offset = int(struct.unpack(endian + "f", head[108:112])[0])
        slope, intercept = struct.unpack(endian + "2f", head[112:120])
        units = head[123] & 0x07
    else:
        if head[4:7] != b"n+2":
            raise RawVolumeError(f"{path.name}: a NIfTI header and image pair is not supported")
        datatype = struct.unpack(endian + "h", head[12:14])[0]
        dims = struct.unpack(endian + "8q", head[16:80])
        pixdim = struct.unpack(endian + "8d", head[104:168])
        offset = struct.unpack(endian + "q", head[168:176])[0]
        slope, intercept = struct.unpack(endian + "2d", head[176:192])
        units = struct.unpack(endian + "i", head[500:504])[0] & 0x07
    dtype = NIFTI_TYPES.get(datatype)
    if dtype is None:
        raise RawVolumeError(f"{path.name}: unsupported NIfTI data type {datatype}")
    count = dims[0]
    shape = [int(dims[i]) if i <= count else 1 for i in range(1, 6)]
    nx, ny, nz, nt, nc = (max(1, n) for n in shape)
    if nz < 2:
        raise RawVolumeError(f"{path.name}: a single plane, not a stack")
    size = [abs(float(p)) or 1.0 for p in pixdim[1:4]]
    scale = NIFTI_UNITS.get(units)
    voxel, unit = ([s * scale for s in size], "µm") if scale else (size, "px")
    item = np.dtype(dtype).itemsize
    open_data = (lambda: gzip.open(path, "rb")) if opener is gzip.open else (lambda: open(path, "rb"))
    return Volume(
        stem(path), (nz, ny, nx), nc, endian + dtype, open_data, offset,
        # Channels (dim 5) come after all time points.
        interleaved=nc == 1, channel_stride=nx * ny * nz * nt * item,
        voxel=voxel, unit=unit, frames=nt, slope=float(slope) if np.isfinite(slope) else 1.0,
        intercept=float(intercept) if np.isfinite(intercept) else 0.0,
    )


# MetaImage.

def read_metaimage(path: Path) -> Volume:
    fields, header_end = {}, 0
    with open(path, "rb") as file:
        for raw in iter(file.readline, b""):
            line = raw.decode("latin-1").strip()
            if "=" not in line:
                if line:
                    raise RawVolumeError(f"{path.name} is not a MetaImage file")
                continue
            key, value = (part.strip() for part in line.split("=", 1))
            fields[key.lower()] = value
            if key.lower() == "elementdatafile":
                header_end = file.tell()
                break
    if "elementdatafile" not in fields or "dimsize" not in fields:
        raise RawVolumeError(f"{path.name} is not a MetaImage file")
    sizes = [int(s) for s in fields["dimsize"].split()]
    dtype = MET_TYPES.get(fields.get("elementtype", "").upper())
    if dtype is None:
        raise RawVolumeError(f"{path.name}: unsupported MetaImage element type {fields.get('elementtype')!r}")
    if len(sizes) < 3 or sizes[2] < 2:
        raise RawVolumeError(f"{path.name}: a single plane, not a stack")
    msb = (fields.get("binarydatabyteordermsb") or fields.get("bytordermsb") or fields.get("byteordermsb") or "False").lower() == "true"
    channels = int(fields.get("elementnumberofchannels", "1"))
    size = [float(s) for s in (fields.get("elementspacing") or fields.get("elementsize") or "1 1 1").split()[:3]]
    data_file = fields["elementdatafile"]
    if data_file.upper() == "LIST" or "%" in data_file:
        raise RawVolumeError(f"{path.name}: MetaImage data split over several files is not supported")
    data_path, offset = (path, header_end) if data_file.upper() == "LOCAL" else (path.parent / data_file, 0)
    header_size = int(fields.get("headersize", "0"))
    compressed = fields.get("compresseddata", "False").lower() == "true"
    nx, ny, nz = sizes[:3]
    frames = int(np.prod(sizes[3:])) if len(sizes) > 3 else 1
    if header_size == -1 and not compressed:
        offset = data_path.stat().st_size - nx * ny * nz * frames * channels * np.dtype(dtype).itemsize
    elif header_size > 0:
        offset += header_size
    open_data, offset = _opener(data_path, "zlib" if compressed else "raw", offset)
    # ITK's convention: millimetres.
    return Volume(stem(path), (nz, ny, nx), channels, (">" if msb else "<") + dtype, open_data, offset, True, 0,
                  [s * 1e3 for s in size], "µm", frames)


READERS = {"nrrd": read_nrrd, "nhdr": read_nrrd, "nii": read_nifti, "mha": read_metaimage, "mhd": read_metaimage}


def convert(source: Path, manifest: Path, max_size: int = MAX_SIZE, log_prefix: str = "") -> dict:
    """Writes the manifest and the volume of `source`. Raises RawVolumeError
    when it cannot be shown."""
    reader = READERS.get(model_ext(source))
    if reader is None:
        raise RawVolumeError(f"Unsupported volume format: {source.name}")
    try:
        volume = reader(source)
    except (OSError, struct.error, ValueError, zlib.error, EOFError) as exc:
        if isinstance(exc, VolumeError):
            raise
        raise RawVolumeError(f"{source.name} is not readable: {exc}") from exc
    writer = ManifestWriter(source, manifest, max_size, log_prefix, label=model_ext(source).upper())
    data = volume.open_data()
    try:
        views = [PlaneView(volume, c, data) for c in range(volume.channels)]
        colors = default_colors(volume.channels)
        writer.add(
            volume.name, source.name, views,
            [
                {"name": volume.name if volume.channels == 1 else f"Channel {c + 1}", "color": colors[c],
                 "bits": volume.dtype.itemsize * 8}
                for c in range(volume.channels)
            ],
            volume.voxel, unit=volume.unit, frames=volume.frames,
        )
    finally:
        data.close()
    return writer.finish()


if __name__ == "__main__":
    run_cli(convert, "Usage: python3 raw_volume.py volume.nrrd|.nhdr|.nii|.nii.gz|.mha|.mhd [out_dir]")
