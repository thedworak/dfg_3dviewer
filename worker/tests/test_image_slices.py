"""Tests of worker/image_slices.py, on PNG, JPEG and BMP slices written here
with Pillow:

  python3 -m unittest discover -s worker/tests
"""

import gzip
import os
import sys
import tempfile
import unittest
from pathlib import Path

WORKER_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(WORKER_DIR))

try:
    import numpy as np
    from PIL import Image
except ImportError:  # the worker's image has both (Dockerfile.base)
    np = Image = None

if Image is not None:
    os.environ.setdefault("WORKER_JOBS_DIR", tempfile.mkdtemp(prefix="image-slices-test-jobs-"))
    import image_slices
    import server
    import volumes


def stack(nz=6, ny=8, nx=10, seed=1, high=256, dtype=None):
    rng = np.random.default_rng(seed)
    return rng.integers(0, high, size=(nz, ny, nx)).astype(dtype or (np.uint8 if high <= 256 else np.uint16))


@unittest.skipIf(Image is None, "numpy or Pillow not installed")
class ImageSlicesTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def convert(self, source, **kwargs):
        manifest = volumes.manifest_path_for(source)
        manifest.parent.mkdir(parents=True, exist_ok=True)
        result = image_slices.convert(source, manifest, **kwargs)
        series = result["series"][0]
        nx, ny, nz = series["dims"]
        with gzip.open(manifest.parent / series["data"], "rb") as file:
            voxels = np.frombuffer(file.read(), dtype=np.uint8).reshape(nz, ny, nx)
        return series, voxels

    def write(self, folder, values, extension, name="rec_{z}", **save):
        folder.mkdir(parents=True, exist_ok=True)
        for z, plane in enumerate(values):
            Image.fromarray(plane).save(folder / f"{name.format(z=z)}.{extension}", **save)

    def assert_same_order(self, values, expected):
        self.assertGreater(np.corrcoef(values.ravel().astype(np.float32), expected.ravel().astype(np.float32))[0, 1], 0.99)

    def test_png_in_natural_order_with_skyscan_log(self):
        values = stack(nz=12)
        folder = self.dir / "sample_rec"
        # rec_2 before rec_10.
        self.write(folder, values, "png")
        (folder / "sample__rec.log").write_text("[Reconstruction]\nImage Pixel Size (um)=8.000\n")
        series, voxels = self.convert(folder / "rec_0.png")
        self.assertEqual(series["name"], "sample_rec")
        self.assertEqual(series["dims"], [10, 8, 12])
        self.assertEqual(series["voxelSize"], [8.0, 8.0, 8.0])
        self.assertEqual(series["unit"], "µm")
        self.assert_same_order(voxels, values)

    def test_png_16_bit_kept(self):
        values = stack(high=60000, seed=2)
        self.write(self.dir / "ct", values.astype(np.uint16), "png")
        series, voxels = self.convert(self.dir / "ct" / "rec_3.png")
        self.assertEqual(series["channels"][0]["bits"], 16)
        self.assertGreater(series["channels"][0]["range"][1], 50000)
        self.assertEqual(series["unit"], "px")
        self.assert_same_order(voxels, values)

    def test_bmp_and_colour_jpeg(self):
        values = stack(seed=3)
        self.write(self.dir / "bmp", values, "bmp")
        _series, voxels = self.convert(self.dir / "bmp" / "rec_0.bmp")
        self.assert_same_order(voxels, values)
        # Colour: its luminance. A smooth ramp, so JPEG keeps it.
        ramp = np.broadcast_to(np.linspace(0, 255, 6)[:, None, None], (6, 16, 16)).astype(np.uint8)
        rgb = np.stack([ramp, ramp // 2, ramp], axis=-1)
        folder = self.dir / "jpeg"
        folder.mkdir()
        for z, plane in enumerate(rgb):
            Image.fromarray(plane).save(folder / f"s{z}.jpeg", quality=95)
        _series, voxels = self.convert(folder / "s0.jpeg")
        self.assertTrue(np.all(np.diff(voxels.mean(axis=(1, 2))) > 0))

    def test_slices_of_one_kind_and_size(self):
        values = stack(nz=3, seed=4)
        self.write(self.dir / "mixed", values, "png")
        Image.fromarray(values[0]).save(self.dir / "mixed" / "preview.jpg")
        series, _voxels = self.convert(self.dir / "mixed" / "rec_0.png")
        self.assertEqual(series["dims"][2], 3)
        Image.fromarray(np.zeros((4, 4), np.uint8)).save(self.dir / "mixed" / "rec_9.png")
        with self.assertRaises(image_slices.ImageSlicesError) as caught:
            self.convert(self.dir / "mixed" / "rec_0.png")
        self.assertIn("rec_9.png", str(caught.exception))

    def test_single_image(self):
        self.write(self.dir / "one", stack(nz=1), "png")
        with self.assertRaises(image_slices.ImageSlicesError):
            self.convert(self.dir / "one" / "rec_0.png")


    def test_upload_picks_the_stack(self):
        # Images next to a model are its textures.
        (self.dir / "model.obj").write_text("v 0 0 0\n")
        self.write(self.dir / "textures", stack(nz=3), "png")
        self.assertEqual(server.find_model_file(self.dir).name, "model.obj")
        (self.dir / "model.obj").unlink()
        # Alone, the folder with the most slices; its first in natural order.
        self.write(self.dir / "scan", stack(nz=11), "png", name="slice{z}")
        self.assertEqual(server.find_model_file(self.dir), self.dir / "scan" / "slice0.png")

if __name__ == "__main__":
    unittest.main()
