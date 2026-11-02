"""Tests of worker/raw_volume.py, on NRRD, NIfTI, MetaImage, MRC, .vgi and
.xtekct files
written here:

  python3 -m unittest discover -s worker/tests
"""

import gzip
import struct
import sys
import tempfile
import unittest
import zlib
from pathlib import Path

WORKER_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(WORKER_DIR))

try:
    import numpy as np
except ImportError:  # the worker's image has it (Dockerfile.base)
    np = None

if np is not None:
    import raw_volume
    import volumes


def volume(nz=6, ny=8, nx=10, seed=1):
    """(z, y, x) int16 values, Hounsfield-like."""
    rng = np.random.default_rng(seed)
    return rng.integers(-1000, 2000, size=(nz, ny, nx)).astype(np.int16)


def nifti1(values_zyx, voxel=(0.5, 0.5, 1.25), units=2, slope=0.0, intercept=0.0, extra_dims=()):
    """A single-file NIfTI-1 (.nii) of values (z, y, x[, ...]), x fastest."""
    nz, ny, nx = values_zyx.shape[:3]
    dims = [3 + len(extra_dims), nx, ny, nz, *extra_dims] + [1] * (4 - len(extra_dims))
    datatype = {np.dtype(np.int16): 4, np.dtype(np.float32): 16, np.dtype(np.uint8): 2}[values_zyx.dtype]
    header = bytearray(348)
    struct.pack_into("<i", header, 0, 348)
    struct.pack_into("<8h", header, 40, *dims[:8])
    struct.pack_into("<hh", header, 70, datatype, values_zyx.dtype.itemsize * 8)
    struct.pack_into("<8f", header, 76, 1.0, *voxel, 1, 1, 1, 1)
    struct.pack_into("<fff", header, 108, 352.0, slope, intercept)
    header[123] = units
    header[344:348] = b"n+1\0"
    return bytes(header) + b"\0" * 4 + values_zyx.tobytes()


@unittest.skipIf(np is None, "numpy not installed")
class RawVolumeTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def convert(self, source):
        manifest = volumes.manifest_path_for(source)
        manifest.parent.mkdir(parents=True, exist_ok=True)
        result = raw_volume.convert(source, manifest)
        series = result["series"][0]
        nx, ny, nz = series["dims"]
        with gzip.open(manifest.parent / series["data"], "rb") as file:
            voxels = np.frombuffer(file.read(), dtype=np.uint8).reshape(len(series["channels"]), nz, ny, nx)
        return series, voxels

    def assert_same_order(self, values, expected):
        self.assertGreater(np.corrcoef(values.ravel().astype(np.float32), expected.ravel().astype(np.float32))[0, 1], 0.99)

    def test_nifti_gz_with_scaling(self):
        values = volume()
        stored = ((values.astype(np.int32) + 1024) // 2).astype(np.int16)
        source = self.dir / "ct.nii.gz"
        source.write_bytes(gzip.compress(nifti1(stored, slope=2.0, intercept=-1024.0)))
        self.assertEqual(raw_volume.model_ext(source), "nii")
        self.assertEqual(volumes.manifest_path_for(source).name, "ct.dfgvol")
        series, voxels = self.convert(source)
        self.assertEqual(series["name"], "ct")
        self.assertEqual(series["dims"], [10, 8, 6])
        self.assertEqual(series["voxelSize"], [500.0, 500.0, 1250.0])
        self.assertEqual(series["unit"], "µm")
        # Scaled back to the stored values' meaning (here: about -1000..2000).
        low, high = series["channels"][0]["range"]
        self.assertLess(low, -900)
        self.assertGreater(high, 1900)
        self.assert_same_order(voxels[0], values)

    def test_nifti_channels_after_time(self):
        a, b = volume(seed=2).astype(np.float32), volume(seed=3).astype(np.float32)
        # dims x y z t=2 c=2: t fastest of the two, so c=1 starts after both time points.
        data = np.stack([np.stack([a, a + 5000]), np.stack([b, b + 5000])])  # (c, t, z, y, x)
        source = self.dir / "two.nii"
        header = nifti1(a, units=3, extra_dims=(2, 2))
        source.write_bytes(header[:352] + data.tobytes())
        series, voxels = self.convert(source)
        self.assertEqual(series["frames"], 2)
        self.assertEqual(series["voxelSize"], [0.5, 0.5, 1.25])
        self.assert_same_order(voxels[0], a)
        self.assert_same_order(voxels[1], b)

    def test_nrrd_gzip_space_directions(self):
        values = volume(seed=4)
        source = self.dir / "ct.nrrd"
        header = (
            "NRRD0004\n# comment\ntype: short\ndimension: 3\nspace: left-posterior-superior\n"
            "sizes: 10 8 6\nspace directions: (0.5,0,0) (0,0.5,0) (0,0,1.25)\nendian: little\nencoding: gzip\n\n"
        )
        source.write_bytes(header.encode() + gzip.compress(values.tobytes()))
        series, voxels = self.convert(source)
        self.assertEqual(series["voxelSize"], [500.0, 500.0, 1250.0])
        self.assert_same_order(voxels[0], values)

    def test_nrrd_detached_big_endian_channels(self):
        a, b = volume(seed=5), volume(seed=6)
        interleaved = np.stack([a, b], axis=-1).astype(">i2")  # (z, y, x, c): channel fastest
        (self.dir / "two.raw").write_bytes(interleaved.tobytes())
        source = self.dir / "two.nhdr"
        source.write_text(
            "NRRD0004\ntype: int16\ndimension: 4\nsizes: 2 10 8 6\nkinds: vector domain domain domain\n"
            "spacings: nan 1 1 3\nendian: big\nencoding: raw\ndata file: two.raw\n"
        )
        series, voxels = self.convert(source)
        self.assertEqual(len(series["channels"]), 2)
        # Spacings without a space or units: their ratio, unit unknown.
        self.assertEqual(series["unit"], "px")
        self.assertEqual(series["voxelSize"], [1.0, 1.0, 3.0])
        self.assert_same_order(voxels[0], a)
        self.assert_same_order(voxels[1], b)

    def test_metaimage_local_zlib(self):
        values = volume(seed=7)
        source = self.dir / "ct.mha"
        header = (
            "ObjectType = Image\nNDims = 3\nBinaryData = True\nBinaryDataByteOrderMSB = False\n"
            "CompressedData = True\nElementSpacing = 0.5 0.5 1.25\nDimSize = 10 8 6\n"
            "ElementType = MET_SHORT\nElementDataFile = LOCAL\n"
        )
        source.write_bytes(header.encode() + zlib.compress(values.tobytes()))
        series, voxels = self.convert(source)
        self.assertEqual(series["voxelSize"], [500.0, 500.0, 1250.0])
        self.assert_same_order(voxels[0], values)

    def test_metaimage_detached_float(self):
        values = volume(seed=8).astype(np.float32) / 7
        (self.dir / "f.raw").write_bytes(values.tobytes())
        source = self.dir / "f.mhd"
        source.write_text("ObjectType = Image\nNDims = 3\nDimSize = 10 8 6\nElementType = MET_FLOAT\nElementDataFile = f.raw\n")
        series, voxels = self.convert(source)
        self.assert_same_order(voxels[0], values)

    def mrc(self, stored, mode, endian="<", axes=(1, 2, 3), cell=(5.0, 4.0, 7.5), extended=0, imod_flags=None, version=20140):
        """An MRC of `stored` (section, row, column)."""
        ns, nr, nc = stored.shape
        size_of = dict(zip(axes, (nc, nr, ns)))
        header = bytearray(1024)
        struct.pack_into(endian + "10i", header, 0, nc, nr, ns, mode, 0, 0, 0, size_of[1], size_of[2], size_of[3])
        struct.pack_into(endian + "3f", header, 40, *cell)
        struct.pack_into(endian + "3i", header, 64, *axes)
        struct.pack_into(endian + "i", header, 92, extended)
        struct.pack_into(endian + "i", header, 108, version)
        if imod_flags is not None:
            struct.pack_into(endian + "2i", header, 152, 1146047817, imod_flags)
        header[208:212] = b"MAP "
        header[212:214] = b"\x11\x11" if endian == ">" else b"\x44\x44"
        return bytes(header) + bytes(extended) + stored.astype(endian + stored.dtype.str[1:]).tobytes()

    def test_mrc_float_with_extended_header(self):
        values = volume(seed=9).astype(np.float32) / 3
        source = self.dir / "map.mrc"
        source.write_bytes(self.mrc(values, 2, extended=96))
        self.assertIn("mrc", raw_volume.FORMATS)
        series, voxels = self.convert(source)
        self.assertEqual(series["dims"], [10, 8, 6])
        # Å: cell 5 x 4 x 7.5 over 10 x 8 x 6 voxels.
        self.assertEqual(series["unit"], "µm")
        self.assertEqual([round(v * 1e4, 4) for v in series["voxelSize"]], [0.5, 0.5, 1.25])
        self.assert_same_order(voxels[0], values)

    def test_mrc_bytes_signed_or_not(self):
        unsigned = np.random.default_rng(10).integers(0, 256, size=(6, 8, 10)).astype(np.uint8)
        # IMOD without its "signed" flag, and old files: unsigned.
        for name, flags, version in (("tomo.rec", 0, 0), ("old.mrc", None, 0)):
            source = self.dir / name
            source.write_bytes(self.mrc(unsigned, 0, imod_flags=flags, version=version))
            series, voxels = self.convert(source)
            self.assertGreaterEqual(series["channels"][0]["range"][0], 0)
            self.assert_same_order(voxels[0], unsigned)
        # MRC2014: signed.
        signed = (unsigned.astype(np.int16) - 128).astype(np.int8)
        source = self.dir / "new.mrc"
        source.write_bytes(self.mrc(signed, 0))
        series, voxels = self.convert(source)
        self.assertLess(series["channels"][0]["range"][0], 0)
        self.assert_same_order(voxels[0], signed)

    def test_mrc_big_endian_other_axis_order(self):
        values = volume(seed=11)  # (z, y, x)
        # Stored with sections along y, rows along x, columns along z.
        stored = np.ascontiguousarray(values.transpose(1, 2, 0))  # (y, x, z)
        source = self.dir / "map.ccp4"
        source.write_bytes(self.mrc(stored, 1, endian=">", axes=(3, 1, 2)))
        series, voxels = self.convert(source)
        self.assertEqual(series["dims"], [10, 8, 6])
        self.assert_same_order(voxels[0], values)

    def test_mrc_unsupported_mode(self):
        source = self.dir / "complex.mrc"
        source.write_bytes(self.mrc(volume().astype(np.float32), 4))
        with self.assertRaises(raw_volume.RawVolumeError) as caught:
            self.convert(source)
        self.assertIn("mode 4", str(caught.exception))

    def test_vgi_uint16(self):
        values = (volume(seed=12).astype(np.int32) + 1024).astype(np.uint16)
        (self.dir / "scan data.vol").write_bytes(values.tobytes())
        source = self.dir / "scan.vgi"
        source.write_text(
            "{volume1}\n[representation]\nsize = 10 8 6\ndatatype = unsigned integer\nbitsperelement = 16\n"
            "[file1]\nFileFormat = raw\nSize = 10 8 6\nName = C:\\scans\\scan data.vol\n"
            "Datatype = unsigned integer\nBitsPerElement = 16\n"
            "{volumeprimitive12}\n[geometry]\nresolution = 0.05 0.05 0.1\nunit = mm\n"
        )
        self.assertIn("vgi", raw_volume.FORMATS)
        series, voxels = self.convert(source)
        self.assertEqual(series["dims"], [10, 8, 6])
        self.assertEqual(series["voxelSize"], [50.0, 50.0, 100.0])
        self.assertEqual(series["channels"][0]["bits"], 16)
        self.assert_same_order(voxels[0], values)

    def test_vgi_float_without_name_or_unit(self):
        values = volume(seed=13).astype(np.float32) / 100
        (self.dir / "part.vol").write_bytes(values.tobytes())
        source = self.dir / "part.vgi"
        source.write_text("{volume1}\n[file1]\nSize = 10 8 6\nDatatype = float\nBitsPerElement = 32\n[geometry]\nresolution = 0.02 0.02 0.02\n")
        series, voxels = self.convert(source)
        # Millimetres when the geometry has no unit.
        self.assertEqual(series["voxelSize"], [20.0, 20.0, 20.0])
        self.assert_same_order(voxels[0], values)

    def test_xtekct_type_from_the_data_size(self):
        values = volume(seed=14)
        for dtype, bits in ((np.float32, 32), (np.uint16, 16)):
            stored = (values.astype(np.float32) / 3000 if dtype is np.float32 else values.astype(np.int32) + 1024).astype(dtype)
            (self.dir / "Amphora.vol").write_bytes(stored.tobytes())
            source = self.dir / "Amphora.xtekct"
            source.write_text(
                "[XTekCT]\nName=Amphora\nVoxelsX=10\nVoxelsY=8\nVoxelsZ=6\n"
                "VoxelSizeX=0.04\nVoxelSizeY=0.04\nVoxelSizeZ=0.04\n"
            )
            series, voxels = self.convert(source)
            self.assertEqual(series["voxelSize"], [40.0, 40.0, 40.0])
            self.assertEqual(series["channels"][0]["bits"], bits)
            self.assert_same_order(voxels[0], stored)

    def test_header_without_its_data(self):
        source = self.dir / "lonely.xtekct"
        source.write_text("[XTekCT]\nName=lonely\nVoxelsX=10\nVoxelsY=8\nVoxelsZ=6\n")
        with self.assertRaises(raw_volume.RawVolumeError) as caught:
            self.convert(source)
        self.assertIn("lonely.vol", str(caught.exception))

    def test_single_plane(self):
        source = self.dir / "flat.nrrd"
        source.write_bytes(b"NRRD0004\ntype: uchar\ndimension: 2\nsizes: 4 4\nencoding: raw\n\n" + bytes(16))
        with self.assertRaises(raw_volume.RawVolumeError) as caught:
            self.convert(source)
        self.assertIn("single plane", str(caught.exception))

    def test_truncated(self):
        source = self.dir / "short.nii"
        source.write_bytes(nifti1(volume())[:500])
        with self.assertRaises(volumes.VolumeError):
            self.convert(source)


if __name__ == "__main__":
    unittest.main()
