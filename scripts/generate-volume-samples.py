#!/usr/bin/env python3
"""Generate viewer/examples/volumes/: small synthetic image stacks, one per
volume format the viewer and the worker read (viewer/volume.js,
worker/volumes.py). Made up here - no scans of anyone or anything - so they
can be shared freely.

    amphora-ct.*        a ceramic amphora as a micro-CT would see it, in
                        Hounsfield units (int16): air -1000, a fired-clay
                        wall ~1000 with pores, a bronze rivet ~3000; voxel
                        0.4 mm. Written as NIfTI (.nii.gz), NRRD (.nrrd,
                        gzip), MetaImage (.mha, zlib), a DICOM CT series
                        (.zip of files without extension, as scanners
                        export them), TIFF slices (.zip, float32,
                        resolution in cm), PNG slices (.zip, 8-bit, with a
                        SkyScan reconstruction log saying the voxel size),
                        Volume Graphics .vgi + .vol (.zip, uint16) and
                        Nikon .xtekct + .vol (.zip, float32 attenuation,
                        half the resolution).
    cells.*             two-channel fluorescence (uint16): nuclei and a
                        cytoplasm stain around them; voxel 0.5 x 0.5 x 1 µm.
                        Written as OME-TIFF, Leica LIF (channels stored
                        one after another, as LAS X does for some series)
                        and Zeiss LSM (a thumbnail after every plane).
    capsid.mrc          a cryo-EM density map (float32, MRC2014) of an
                        icosahedral virus capsid: 12 pentamers and 20
                        hexamers on a shell; voxel 4 Å.

Deterministic (fixed seeds, fixed DICOM UIDs): running it again gives the
same files. numpy is needed; tifffile for the TIFFs, Pillow for the PNGs and
pydicom for DICOM -
without them those files are skipped.

Usage: python3 scripts/generate-volume-samples.py [output folder]
"""

import gzip
import io
import struct
import sys
import zipfile
import zlib
from pathlib import Path

import numpy as np

DEFAULT_OUTPUT = Path(__file__).resolve().parent.parent / "viewer" / "examples" / "volumes"
CT_VOXEL_MM = 0.4


def amphora():
    """(z, y, x) int16 Hounsfield units of the amphora, z up."""
    nz, ny, nx = 120, 72, 72
    rng = np.random.default_rng(7)
    z = np.linspace(0, 1, nz)[:, None, None]
    y, x = np.meshgrid(np.linspace(-1, 1, ny), np.linspace(-1, 1, nx), indexing="ij")
    r = np.sqrt(x * x + y * y)[None]
    # Outer radius along the height: foot, belly, shoulder, neck, rim.
    outer = (
        0.18 + 0.62 * np.sin(np.clip((z - 0.05) / 0.75, 0, 1) * np.pi) ** 0.8 * (z < 0.8)
        + (z >= 0.8) * (0.22 + 0.08 * np.clip((z - 0.93) / 0.07, 0, 1))
    )
    outer = np.where(z < 0.05, 0.2, outer)
    wall = 0.075
    inside = (r < outer - wall) & (z > 0.08)
    clay = (r < outer) & (z > 0.01) & (z < 0.99) & ~inside
    hu = np.full((nz, ny, nx), -1000.0)
    hu[clay] = 1000 + rng.normal(0, 60, clay.sum())
    # Pores: small air bubbles in the clay.
    pores = rng.random((nz, ny, nx)) < 0.004
    hu[clay & pores] = -400
    # A bronze rivet through the shoulder.
    zz, yy, xx = np.ogrid[:nz, :ny, :nx]
    rivet = ((zz - 82) ** 2 / 9 + (yy - ny // 2) ** 2 / 4 + (xx - nx * 0.82) ** 2 / 25) < 1
    hu[rivet] = 3000
    hu += rng.normal(0, 15, hu.shape)
    return np.round(hu).astype(np.int16)


def cells():
    """(channels, z, y, x) uint16: nuclei, and cytoplasm around them."""
    nz, ny, nx = 32, 96, 96
    rng = np.random.default_rng(11)
    zz, yy, xx = np.mgrid[:nz, :ny, :nx].astype(np.float32)
    nuclei = np.zeros((nz, ny, nx), np.float32)
    cytoplasm = np.zeros_like(nuclei)
    for _ in range(14):
        cz, cy, cx = rng.uniform(6, nz - 6), rng.uniform(10, ny - 10), rng.uniform(10, nx - 10)
        d2 = ((zz - cz) * 2) ** 2 + (yy - cy) ** 2 + (xx - cx) ** 2
        nuclei += 3000 * np.exp(-d2 / (2 * 4.5 ** 2))
        cytoplasm += 1500 * np.exp(-d2 / (2 * 9 ** 2)) * (d2 > 30)
    noise = rng.normal(100, 25, (2, nz, ny, nx))
    return np.clip(np.stack([nuclei, cytoplasm]) + noise, 0, 65535).astype(np.uint16)


def capsid():
    """(z, y, x) float32 density of an icosahedral capsid, around 0."""
    n = 48
    rng = np.random.default_rng(5)
    phi = (1 + 5 ** 0.5) / 2
    vertices = np.array([(0, a, b * phi) for a in (-1, 1) for b in (-1, 1)], float)
    vertices = np.concatenate([np.roll(vertices, k, axis=1) for k in range(3)])
    vertices /= np.linalg.norm(vertices, axis=1)[:, None]
    # Face centres: three vertices at the edge length of each other.
    edge = np.min([np.linalg.norm(a - b) for a in vertices for b in vertices if np.any(a != b)])
    faces = [
        vertices[[i, j, k]].mean(axis=0)
        for i in range(12) for j in range(i + 1, 12) for k in range(j + 1, 12)
        if all(abs(np.linalg.norm(vertices[a] - vertices[b]) - edge) < 1e-6 for a, b in ((i, j), (j, k), (i, k)))
    ]
    faces = np.array(faces) / np.linalg.norm(faces, axis=1)[:, None]
    zz, yy, xx = (np.mgrid[:n, :n, :n].astype(np.float32) - (n - 1) / 2)
    density = np.zeros((n, n, n), np.float32)
    radius = n * 0.4
    for centres, size, weight in ((vertices, 2.6, 1.0), (faces, 3.0, 0.8)):
        for cx, cy, cz in centres * radius:
            density += weight * np.exp(-((xx - cx) ** 2 + (yy - cy) ** 2 + (zz - cz) ** 2) / (2 * size ** 2))
    # The shell under them, and the genome inside.
    r = np.sqrt(xx * xx + yy * yy + zz * zz)
    density += 0.35 * np.exp(-((r - radius * 0.86) ** 2) / 2) + 0.15 * (r < radius * 0.7)
    return (density + rng.normal(0, 0.04, density.shape)).astype(np.float32)


def write_nifti(path, hu):
    nz, ny, nx = hu.shape
    header = bytearray(348)
    struct.pack_into("<i", header, 0, 348)
    struct.pack_into("<8h", header, 40, 3, nx, ny, nz, 1, 1, 1, 1)
    struct.pack_into("<hh", header, 70, 4, 16)  # int16
    struct.pack_into("<8f", header, 76, 1, CT_VOXEL_MM, CT_VOXEL_MM, CT_VOXEL_MM, 0, 0, 0, 0)
    struct.pack_into("<3f", header, 108, 352.0, 1.0, 0.0)  # vox_offset, scl_slope, scl_inter
    header[123] = 2  # millimetres
    header[344:348] = b"n+1\0"
    # gzip without a time stamp: the same bytes every run.
    path.write_bytes(gzip.compress(bytes(header) + b"\0" * 4 + hu.tobytes(), mtime=0))


def write_nrrd(path, hu):
    nz, ny, nx = hu.shape
    s = CT_VOXEL_MM
    header = (
        "NRRD0004\n# Synthetic amphora, scripts/generate-volume-samples.py\n"
        f"type: short\ndimension: 3\nspace: left-posterior-superior\nsizes: {nx} {ny} {nz}\n"
        f"space directions: ({s},0,0) (0,{s},0) (0,0,{s})\nspace units: \"mm\" \"mm\" \"mm\"\n"
        "endian: little\nencoding: gzip\n\n"
    )
    path.write_bytes(header.encode() + gzip.compress(hu.tobytes(), mtime=0))


def write_metaimage(path, hu):
    nz, ny, nx = hu.shape
    s = CT_VOXEL_MM
    header = (
        "ObjectType = Image\nNDims = 3\nBinaryData = True\nBinaryDataByteOrderMSB = False\n"
        f"CompressedData = True\nElementSpacing = {s} {s} {s}\nDimSize = {nx} {ny} {nz}\n"
        "ElementType = MET_SHORT\nElementDataFile = LOCAL\n"
    )
    path.write_bytes(header.encode() + zlib.compress(hu.tobytes(), 9))


def _zip(path, entries):
    """A .zip of (name, bytes) with fixed time stamps."""
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, data in entries:
            info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, data)


def write_tiff_slices(path, hu):
    import tifffile
    entries = []
    for z, plane in enumerate(hu.astype(np.float32)):
        buffer = io.BytesIO()
        # 0.4 mm = 25 pixels per cm.
        tifffile.imwrite(buffer, plane, compression="zlib", resolution=(10 / CT_VOXEL_MM, 10 / CT_VOXEL_MM),
                         resolutionunit="CENTIMETER", metadata=None)
        entries.append((f"amphora-ct/rec_{z}.tif", buffer.getvalue()))
    _zip(path, entries)


def write_png_slices(path, hu):
    """8-bit PNG slices, -1000..3000 HU, as NRecon exports them, with its log."""
    from PIL import Image
    grey = np.clip((hu.astype(np.float32) + 1000) / 4000 * 255, 0, 255).astype(np.uint8)
    entries = []
    for z, plane in enumerate(grey):
        buffer = io.BytesIO()
        Image.fromarray(plane).save(buffer, format="PNG", optimize=True)
        entries.append((f"amphora-ct_rec/amphora-ct_rec{z:08d}.png", buffer.getvalue()))
    log = (
        "[System]\nScanner=Synthetic (generate-volume-samples.py)\n[Acquisition]\nObject=amphora\n"
        f"[Reconstruction]\nReconstruction Program=NRecon\nImage Pixel Size (um)={CT_VOXEL_MM * 1000:.5f}\n"
        "Result File Type=PNG\nResult Image Width (pixels)=72\nResult Image Height (pixels)=72\n"
    )
    entries.append(("amphora-ct_rec/amphora-ct_rec.log", log.encode()))
    _zip(path, entries)


def write_vgi(path, hu):
    """Volume Graphics: amphora-ct.vgi and its raw uint16 amphora-ct.vol."""
    nz, ny, nx = hu.shape
    s = CT_VOXEL_MM
    header = (
        "{volume1}\n[representation]\n"
        f"size = {nx} {ny} {nz}\nmirror = 0 0 0\ndatatype = unsigned integer\ndatarange = 0 65535\nbitsperelement = 16\n"
        f"[file1]\nRegionOfInterestStart = 0 0 0\nRegionOfInterestEnd = {nx - 1} {ny - 1} {nz - 1}\nFileFormat = raw\n"
        f"Size = {nx} {ny} {nz}\nName = amphora-ct.vol\nDatatype = unsigned integer\ndatarange = 0 65535\nBitsPerElement = 16\n"
        "{volumeprimitive12}\n[geometry]\nstatus = visible\nrelativeposition = 0 0 0\nposition = 0 0 0\n"
        f"resolution = {s} {s} {s}\nscale = 1 1 1\nunit = mm\n"
    )
    voxels = (hu.astype(np.int32) + 1024).clip(0, 65535).astype("<u2")
    _zip(path, [("amphora-ct.vgi", header.encode()), ("amphora-ct.vol", voxels.tobytes())])


def write_xtekct(path, hu):
    """Nikon CT Pro: amphora-ct.xtekct and its float32 amphora-ct.vol (linear
    attenuation, 1/mm), every second voxel."""
    half = hu[::2, ::2, ::2]
    nz, ny, nx = half.shape
    s = CT_VOXEL_MM * 2
    attenuation = (np.maximum(half.astype(np.float32), -1000) + 1000) / 1000 * 0.05
    header = (
        "[XTekCT]\nName=amphora-ct\n"
        f"VoxelsX={nx}\nVoxelsY={ny}\nVoxelsZ={nz}\nVoxelSizeX={s}\nVoxelSizeY={s}\nVoxelSizeZ={s}\n"
        "OffsetX=0\nOffsetY=0\nOffsetZ=0\nProjections=1440\nXraykV=180\nXrayuA=60\n"
    )
    _zip(path, [("amphora-ct.xtekct", header.encode()), ("amphora-ct.vol", attenuation.astype("<f4").tobytes())])


def write_dicom(path, hu):
    from pydicom.dataset import FileDataset, FileMetaDataset
    from pydicom.uid import CTImageStorage, ExplicitVRLittleEndian, generate_uid

    uid = lambda *parts: generate_uid(entropy_srcs=["dfg-3dviewer amphora sample", *map(str, parts)])  # noqa: E731
    study, series = uid("study"), uid("series")
    nz, ny, nx = hu.shape
    entries = []
    # Slices written in a shuffled order: the reader sorts them by position.
    for n, z in enumerate(np.random.default_rng(3).permutation(nz)):
        meta = FileMetaDataset()
        meta.MediaStorageSOPClassUID = CTImageStorage
        meta.MediaStorageSOPInstanceUID = uid("slice", z)
        meta.TransferSyntaxUID = ExplicitVRLittleEndian
        ds = FileDataset(None, {}, file_meta=meta, preamble=b"\0" * 128)
        ds.SOPClassUID, ds.SOPInstanceUID = CTImageStorage, meta.MediaStorageSOPInstanceUID
        ds.StudyInstanceUID, ds.SeriesInstanceUID, ds.FrameOfReferenceUID = study, series, uid("frame")
        ds.PatientName, ds.PatientID = "Amphora^Synthetic", "SAMPLE"
        ds.Modality, ds.Manufacturer, ds.ManufacturerModelName = "CT", "Synthetic", "generate-volume-samples.py"
        ds.SeriesNumber, ds.SeriesDescription, ds.InstanceNumber = 1, "Amphora micro-CT", int(z) + 1
        ds.ImageOrientationPatient = [1, 0, 0, 0, 1, 0]
        ds.ImagePositionPatient = [0, 0, float(z) * CT_VOXEL_MM]
        ds.PixelSpacing, ds.SliceThickness = [CT_VOXEL_MM, CT_VOXEL_MM], CT_VOXEL_MM
        ds.Rows, ds.Columns = ny, nx
        ds.SamplesPerPixel, ds.PhotometricInterpretation = 1, "MONOCHROME2"
        ds.BitsAllocated, ds.BitsStored, ds.HighBit, ds.PixelRepresentation = 16, 16, 15, 0
        ds.RescaleIntercept, ds.RescaleSlope, ds.RescaleType = -1024, 1, "HU"
        ds.WindowCenter, ds.WindowWidth, ds.WindowCenterWidthExplanation = [1000, 400], [2000, 1500], ["CERAMIC", "WIDE"]
        ds.PixelData = (hu[z].astype(np.int32) + 1024).clip(0, 65535).astype(np.uint16).tobytes()
        buffer = io.BytesIO()
        ds.save_as(buffer, enforce_file_format=True)
        entries.append((f"amphora-ct/IM{n + 1:04d}", buffer.getvalue()))
    _zip(path, entries)


def write_ome_tiff(path, data):
    import tifffile
    tifffile.imwrite(
        path, np.ascontiguousarray(data.transpose(1, 0, 2, 3)), compression="zlib", photometric="minisblack",
        metadata={"axes": "ZCYX", "PhysicalSizeX": 0.5, "PhysicalSizeY": 0.5, "PhysicalSizeZ": 1.0,
                  "Channel": {"Name": ["Nuclei", "Cytoplasm"], "Color": [0x0080FFFF, 0x00FF00FF]}, "Name": "Cells",
                  # Fixed, so the file is the same every run.
                  "UUID": "urn:uuid:8f1c2a64-3b1e-4d6a-9c7e-5a0d2b7e4f10", "Creator": "generate-volume-samples.py"},
    )


def write_lif(path, data):
    """A Leica LIF with one 2-channel stack, channels one after another."""
    channels, nz, ny, nx = data.shape
    plane, stack = nx * ny * 2, nx * ny * nz * 2
    dims = "".join(
        f'<DimensionDescription DimID="{d}" NumberOfElements="{n}" Length="{length}" Unit="m" BytesInc="{stride}"/>'
        for d, n, length, stride in ((1, nx, (nx - 1) * 0.5e-6, 2), (2, ny, (ny - 1) * 0.5e-6, nx * 2), (3, nz, (nz - 1) * 1e-6, plane))
    )
    chans = "".join(
        f'<ChannelDescription DataType="0" Resolution="16" LUTName="{lut}" BytesInc="{c * stack}">'
        f"<ChannelProperty><Key>DyeName</Key><Value>{dye}</Value></ChannelProperty></ChannelDescription>"
        for c, (lut, dye) in enumerate((("Blue", "Nuclei"), ("Green", "Cytoplasm")))
    )
    payload = data.tobytes()
    xml = (
        '<LMSDataContainerHeader Version="2"><Element Name="cells.lif"><Data><Experiment/></Data>'
        '<Memory Size="0" MemoryBlockID="MemBlock_0"/><Children>'
        f'<Element Name="Cells"><Data><Image><ImageDescription><Channels>{chans}</Channels>'
        f"<Dimensions>{dims}</Dimensions></ImageDescription>"
        '<ATLConfocalSettingDefinition ObjectiveName="Synthetic 63x/1.40 OIL" NumericalAperture="1.4"/>'
        f'</Image></Data><Memory Size="{len(payload)}" MemoryBlockID="MemBlock_1"/><Children/></Element>'
        "</Children></Element></LMSDataContainerHeader>"
    )
    encoded = xml.encode("utf-16-le")
    out = bytearray(struct.pack("<IIBI", 0x70, len(encoded) + 5, 0x2A, len(xml)) + encoded)
    for block_id, block in (("MemBlock_0", b""), ("MemBlock_1", payload)):
        out += struct.pack("<IIBQBI", 0x70, 0, 0x2A, len(block), 0x2A, len(block_id)) + block_id.encode("utf-16-le") + block
    path.write_bytes(bytes(out))


def write_lsm(path, data):
    """A Zeiss LSM: per plane, a page with the channels as samples and a
    thumbnail page; the sizes in CZ_LSMINFO (tag 34412)."""
    import tifffile
    channels, nz, ny, nx = data.shape
    info = bytearray(512)
    struct.pack_into("<Ii8i", info, 0, 0x0400494C, len(info), nx, ny, nz, channels, 1, 2, nx // 4, ny // 4)
    struct.pack_into("<3d", info, 40, 0.5e-6, 0.5e-6, 1e-6)  # voxel size in metres
    thumbnails = data[:, :, ::4, ::4]
    with tifffile.TiffWriter(path) as tif:
        for z in range(nz):
            tif.write(
                np.ascontiguousarray(data[:, z]), photometric="minisblack", planarconfig="separate",
                metadata=None, extratags=[(34412, 1, len(info), bytes(info), True)] if z == 0 else [],
            )
            tif.write(np.ascontiguousarray(thumbnails[:, z]), photometric="minisblack", planarconfig="separate",
                      subfiletype=1, metadata=None)
    zeiss_bits_per_sample(path)


def zeiss_bits_per_sample(path):
    """As Zeiss writes them: a two-sample BitsPerSample as an offset to
    the values, though they fit in the tag (readers expect it)."""
    data = bytearray(path.read_bytes())
    ifd = struct.unpack_from("<I", data, 4)[0]
    while ifd:
        count = struct.unpack_from("<H", data, ifd)[0]
        for entry in range(ifd + 2, ifd + 2 + 12 * count, 12):
            tag, kind, n = struct.unpack_from("<HHI", data, entry)
            if tag == 258 and kind == 3 and n == 2:
                data += b"\0" * (len(data) % 2) + bytes(data[entry + 8:entry + 12])
                struct.pack_into("<I", data, entry + 8, len(data) - 4)
        ifd = struct.unpack_from("<I", data, ifd + 2 + 12 * count)[0]
    path.write_bytes(bytes(data))


def write_mrc(path, density):
    """MRC2014, mode 2 (float32), little endian, voxel 4 Å."""
    nz, ny, nx = density.shape
    header = bytearray(1024)
    struct.pack_into("<10i", header, 0, nx, ny, nz, 2, 0, 0, 0, nx, ny, nz)
    struct.pack_into("<6f", header, 40, nx * 4.0, ny * 4.0, nz * 4.0, 90, 90, 90)
    struct.pack_into("<3i3f2i", header, 64, 1, 2, 3, float(density.min()), float(density.max()), float(density.mean()), 1, 0)
    struct.pack_into("<i", header, 108, 20140)
    header[208:212] = b"MAP "
    header[212:214] = b"\x44\x44"
    struct.pack_into("<i", header, 220, 1)
    header[224:304] = b"capsid, scripts/generate-volume-samples.py".ljust(80)
    path.write_bytes(bytes(header) + density.astype("<f4").tobytes())


def main():
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_OUTPUT
    out.mkdir(parents=True, exist_ok=True)
    hu, fluorescence, density = amphora(), cells(), capsid()
    writers = [
        ("amphora-ct.nii.gz", write_nifti, hu), ("amphora-ct.nrrd", write_nrrd, hu), ("amphora-ct.mha", write_metaimage, hu),
        ("amphora-ct-dicom.zip", write_dicom, hu), ("amphora-ct-tiff-slices.zip", write_tiff_slices, hu),
        ("amphora-ct-png-slices.zip", write_png_slices, hu), ("amphora-ct-vgi.zip", write_vgi, hu),
        ("amphora-ct-xtekct.zip", write_xtekct, hu),
        ("cells.ome.tif", write_ome_tiff, fluorescence), ("cells.lif", write_lif, fluorescence),
        ("cells.lsm", write_lsm, fluorescence), ("capsid.mrc", write_mrc, density),
    ]
    for name, write, data in writers:
        try:
            write(out / name, data)
        except ImportError as exc:
            print(f"skipped {name}: {exc.name} is not installed", file=sys.stderr)
            continue
        print(f"{out / name}  {(out / name).stat().st_size / 1024:.0f} kB")


if __name__ == "__main__":
    main()
