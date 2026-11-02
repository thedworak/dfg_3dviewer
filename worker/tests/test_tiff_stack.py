"""Tests of worker/tiff_stack.py, on TIFFs written here with tifffile:

  python3 -m unittest discover -s worker/tests
"""

import json
import sys
import tempfile
import unittest
from pathlib import Path

WORKER_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(WORKER_DIR))

try:
    import numpy as np
    import tifffile
except ImportError:  # the worker's image has both (Dockerfile.base)
    np = tifffile = None

if tifffile is not None:
    import tiff_stack
    import volumes


def stack(nz=6, ny=8, nx=10, seed=1, dtype=np.uint16 if np else None):
    rng = np.random.default_rng(seed)
    return rng.integers(0, 4000, size=(nz, ny, nx)).astype(dtype)


@unittest.skipIf(tifffile is None, "numpy or tifffile not installed")
class TiffStackTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def convert(self, source, **kwargs):
        manifest = volumes.manifest_path_for(source)
        manifest.parent.mkdir(parents=True, exist_ok=True)
        return manifest, tiff_stack.convert(source, manifest, **kwargs)

    def voxels(self, manifest, series):
        import gzip
        nx, ny, nz = series["dims"]
        with gzip.open(manifest.parent / series["data"], "rb") as file:
            return np.frombuffer(file.read(), dtype=np.uint8).reshape(len(series["channels"]), nz, ny, nx)

    def assert_same_order(self, values, expected):
        self.assertGreater(np.corrcoef(values.ravel(), expected.ravel())[0, 1], 0.99)

    def test_ome_tiff(self):
        a, b = stack(seed=1), stack(seed=2)
        source = self.dir / "cells.ome.tif"
        tifffile.imwrite(
            source, np.stack([a, b], axis=1), compression="zlib", photometric="minisblack",
            metadata={
                "axes": "ZCYX", "PhysicalSizeX": 0.5, "PhysicalSizeY": 0.5, "PhysicalSizeZ": 2.0,
                "Channel": {"Name": ["DAPI", "GFP"], "Color": [0x0000FFFF, 0x00FF00FF]}, "Name": "Cells",
            },
        )
        manifest, result = self.convert(source)
        series = result["series"][0]
        self.assertEqual(series["name"], "Cells")
        self.assertEqual(series["dims"], [10, 8, 6])
        self.assertEqual(series["voxelSize"], [0.5, 0.5, 2.0])
        self.assertEqual(series["unit"], "µm")
        self.assertEqual([(c["name"], c["color"]) for c in series["channels"]], [("DAPI", "#0000ff"), ("GFP", "#00ff00")])
        voxels = self.voxels(manifest, series)
        self.assert_same_order(voxels[0], a)
        self.assert_same_order(voxels[1], b)

    def test_imagej_hyperstack(self):
        a, b = stack(seed=3), stack(seed=4)
        source = self.dir / "hyper.tif"
        tifffile.imwrite(
            source, np.stack([a, b], axis=1), imagej=True, resolution=(1 / 0.25, 1 / 0.25),
            metadata={"axes": "ZCYX", "spacing": 1.5, "unit": "micron"},
        )
        manifest, result = self.convert(source)
        series = result["series"][0]
        self.assertEqual(series["voxelSize"], [0.25, 0.25, 1.5])
        self.assertEqual(len(series["channels"]), 2)
        voxels = self.voxels(manifest, series)
        self.assert_same_order(voxels[1], b)

    def test_plain_signed_without_size(self):
        values = (stack(seed=5).astype(np.int32) - 2000).astype(np.int16)
        source = self.dir / "ct.tif"
        tifffile.imwrite(source, values, photometric="minisblack", metadata=None)
        _manifest, result = self.convert(source)
        series = result["series"][0]
        self.assertEqual(series["unit"], "px")
        self.assertEqual(series["voxelSize"], [1.0, 1.0, 1.0])
        self.assertLess(series["channels"][0]["range"][0], 0)

    def test_slices_in_natural_order(self):
        values = stack(nz=12, seed=6).astype(np.float32)
        values[0, 0, 0] = np.nan
        folder = self.dir / "scan"
        folder.mkdir()
        for z in range(values.shape[0]):
            # rec_2 before rec_10.
            tifffile.imwrite(folder / f"rec_{z}.tif", values[z], resolution=(400, 400), resolutionunit="CENTIMETER")
        manifest, result = self.convert(folder / "rec_0.tif")
        series = result["series"][0]
        self.assertEqual(series["name"], "scan")
        self.assertEqual(series["dims"], [10, 8, 12])
        self.assertEqual(series["voxelSize"], [25.0, 25.0, 25.0])
        voxels = self.voxels(manifest, series)
        self.assert_same_order(voxels[0][1:], values[1:])

    def test_reduced(self):
        source = self.dir / "big.tif"
        tifffile.imwrite(source, stack(nz=9, ny=8, nx=10, seed=7), photometric="minisblack", metadata=None)
        _manifest, result = self.convert(source, max_size=4)
        self.assertEqual(result["series"][0]["dims"], [4, 4, 3])

    def test_single_plane(self):
        source = self.dir / "photo.tif"
        tifffile.imwrite(source, stack(nz=1, seed=8)[0])
        with self.assertRaises(tiff_stack.TiffStackError) as caught:
            self.convert(source)
        self.assertIn("single plane", str(caught.exception))

    def test_manifest_written(self):
        source = self.dir / "s.tif"
        tifffile.imwrite(source, stack(seed=9), photometric="minisblack", metadata=None)
        manifest, _result = self.convert(source)
        self.assertEqual(json.loads(manifest.read_text())["format"], "dfg-volume")


if __name__ == "__main__":
    unittest.main()
