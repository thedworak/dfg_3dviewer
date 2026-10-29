"""Tests of worker/splat_volume.py, on splats made up here:

  python3 -m unittest discover -s worker/tests
"""

import gzip
import math
import struct
import sys
import tempfile
import unittest
from pathlib import Path

WORKER_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(WORKER_DIR))

try:
    import numpy as np
except ImportError:  # the worker's image has it (Dockerfile.base)
    np = None

if np is not None:
    import splat_volume


def plane(count=20_000, size=4.0, seed=1):
    """Flat splats on z = 0 over size x size: centres, scales, rotations
    (x y z w), opacity."""
    rng = np.random.default_rng(seed)
    centers = np.zeros((count, 3), dtype=np.float32)
    centers[:, :2] = rng.uniform(-size / 2, size / 2, (count, 2))
    scales = np.tile(np.array([0.03, 0.03, 0.002], dtype=np.float32), (count, 1))
    rotations = np.tile(np.array([0, 0, 0, 1], dtype=np.float32), (count, 1))
    opacity = np.full(count, 0.9, dtype=np.float32)
    return centers, scales, rotations, opacity


def write_splat(path, centers, scales, opacity):
    records = bytearray()
    for c, s, a in zip(centers, scales, opacity):
        records += struct.pack("<6f", *c, *s) + bytes([200, 180, 160, int(a * 255)]) + bytes([255, 128, 128, 128])
    path.write_bytes(bytes(records))


@unittest.skipIf(np is None, "numpy is not installed")
class ReadTest(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp(prefix="splat-volume-test-"))

    def test_splat(self):
        centers, scales, _rotations, opacity = plane(50)
        path = self.dir / "a.splat"
        write_splat(path, centers, scales, opacity)
        read_centers, read_scales, rotations, read_opacity = splat_volume.read_splat(path)
        np.testing.assert_allclose(read_centers, centers, atol=1e-6)
        np.testing.assert_allclose(read_scales, scales, atol=1e-6)
        np.testing.assert_allclose(read_opacity, np.floor(opacity * 255) / 255, atol=1e-6)
        # The identity: w = 1.
        np.testing.assert_allclose(rotations[0], [0, 0, 0, 1], atol=0.01)

    def test_ply(self):
        centers, scales, _rotations, _opacity = plane(30)
        names = ["x", "y", "z", "f_dc_0", "f_dc_1", "f_dc_2", "opacity", "scale_0", "scale_1", "scale_2", "rot_0", "rot_1", "rot_2", "rot_3"]
        header = "ply\nformat binary_little_endian 1.0\nelement vertex 30\n" + "".join(f"property float {n}\n" for n in names) + "end_header\n"
        rows = b"".join(
            struct.pack("<14f", *c, 0.1, 0.2, 0.3, 2.0, *np.log(s), 1.0, 0.0, 0.0, 0.0) for c, s in zip(centers, scales)
        )
        path = self.dir / "a.ply"
        path.write_bytes(header.encode() + rows)
        read_centers, read_scales, rotations, opacity = splat_volume.read_ply(path)
        np.testing.assert_allclose(read_centers, centers, atol=1e-6)
        np.testing.assert_allclose(read_scales, scales, rtol=1e-5)
        np.testing.assert_allclose(opacity, 1 / (1 + math.exp(-2.0)), rtol=1e-5)
        np.testing.assert_allclose(rotations[0], [0, 0, 0, 1])

    def spz(self, version):
        centers = np.array([[1.0, -2.0, 0.5], [-0.25, 0.125, 3.0]], dtype=np.float32)
        fractional = 12
        body = bytearray(struct.pack("<IIIBBBB", splat_volume.SPZ_MAGIC, version, 2, 0, fractional, 0, 0))
        for c in centers:
            for v in c:
                fixed = int(round(v * (1 << fractional))) & 0xFFFFFF
                body += bytes([fixed & 0xFF, (fixed >> 8) & 0xFF, fixed >> 16])
        body += bytes([255, 128])  # alphas
        body += bytes(6)  # colours
        body += bytes([160] * 6)  # scales: exp(160 / 16 - 10) = 1
        if version == 2:
            body += bytes([128, 128, 128] * 2)
        else:
            # w (index 3) largest, x y z zero.
            body += struct.pack("<II", 3 << 30, 3 << 30)
        path = self.dir / f"v{version}.spz"
        path.write_bytes(gzip.compress(bytes(body)))
        return path, centers

    def test_spz(self):
        for version in (2, 3):
            path, centers = self.spz(version)
            read_centers, scales, rotations, opacity = splat_volume.read_spz(path)
            np.testing.assert_allclose(read_centers, centers, atol=1e-3)
            np.testing.assert_allclose(scales, 1.0, rtol=1e-5)
            np.testing.assert_allclose(opacity, [1.0, 128 / 255], atol=1e-6)
            np.testing.assert_allclose(np.abs(rotations[:, 3]), 1.0, atol=0.01)

    def test_unread_formats(self):
        path = self.dir / "a.ksplat"
        path.write_bytes(b"whatever")
        self.assertIsNone(splat_volume.build_volume(path, self.dir / "a.ksplat.light"))
        broken = self.dir / "b.spz"
        broken.write_bytes(b"not gzip")
        self.assertIsNone(splat_volume.read_splats(broken))


@unittest.skipIf(np is None, "numpy is not installed")
class VolumeTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.volume = splat_volume.compute_volume(*plane(), resolution=48)

    def voxel(self, point):
        return tuple(int(v) for v in np.floor((np.array(point) - self.volume["origin"]) / self.volume["voxel"]))

    def test_surface_and_distance(self):
        b = self.volume["b"]  # (z, y, x, channel)
        x, y, z = self.voxel([0, 0, 0])
        self.assertEqual(b[z, y, x, 3], 0)
        # Above the plane the distance grows by about a voxel a voxel.
        for k in (2, 4):
            d = b[z + k, y, x, 3] / 255 * splat_volume.DISTANCE_RANGE
            self.assertAlmostEqual(d, k, delta=1.5)

    def test_normal_is_the_tensor_axis(self):
        a, b = self.volume["a"], self.volume["b"]
        x, y, z = self.voxel([0.3, -0.2, 0])
        xx, yy, zz = a[z, y, x, :3] / 255
        xy, xz, yz = b[z, y, x, :3] / 255 - 0.5
        tensor = np.array([[xx, xy, xz], [xy, yy, yz], [xz, yz, zz]])
        values, vectors = np.linalg.eigh(tensor)
        self.assertGreater(abs(vectors[:, -1][2]), 0.95)
        self.assertGreater(values[-1] / values.sum(), 0.8)

    def test_open_above_a_plane(self):
        a = self.volume["a"]
        x, y, z = self.voxel([0, 0, 0])
        self.assertGreater(a[z + 2, y, x, 3], 200)

    def test_closed_in_a_box(self):
        # The inside of a closed box sees walls everywhere.
        rng = np.random.default_rng(2)
        faces = []
        for axis in range(3):
            for side in (-1, 1):
                points = rng.uniform(-1, 1, (6000, 3)).astype(np.float32)
                points[:, axis] = side
                faces.append(points)
        centers = np.concatenate(faces)
        count = len(centers)
        scales = np.full((count, 3), 0.02, dtype=np.float32)
        rotations = np.tile(np.array([0, 0, 0, 1], dtype=np.float32), (count, 1))
        volume = splat_volume.compute_volume(centers, scales, rotations, np.full(count, 0.9, dtype=np.float32), resolution=40)
        inside = tuple(int(v) for v in np.floor((np.array([0, 0, -0.85]) - volume["origin"]) / volume["voxel"]))
        outside = tuple(int(v) for v in np.floor((np.array([0, 0, -1.15]) - volume["origin"]) / volume["voxel"]))
        a = volume["a"]
        self.assertLess(a[inside[2], inside[1], inside[0], 3], a[outside[2], outside[1], outside[0], 3])

    def test_file(self):
        out = Path(tempfile.mkdtemp(prefix="splat-volume-test-")) / "plane.splat.light"
        splat_volume.write_volume(self.volume, out)
        data = gzip.decompress(out.read_bytes())
        self.assertEqual(data[:4], b"DFGV")
        version, nx, ny, nz, _pad = struct.unpack_from("<I4H", data, 4)
        self.assertEqual(version, splat_volume.VERSION)
        self.assertEqual((nx, ny, nz), tuple(int(v) for v in self.volume["dims"]))
        self.assertEqual(max(nx, ny, nz), 48)
        origin_x, _oy, _oz, voxel = struct.unpack_from("<4f", data, 16)
        self.assertAlmostEqual(origin_x, float(self.volume["origin"][0]), places=5)
        self.assertAlmostEqual(voxel, self.volume["voxel"], places=6)
        self.assertEqual(len(data), 56 + nx * ny * nz * 8)


@unittest.skipIf(np is None, "numpy is not installed")
class RebuildTest(unittest.TestCase):
    def test_kept_built(self):
        root = Path(tempfile.mkdtemp(prefix="splat-volume-test-"))
        source = root / "plane.splat"
        centers, scales, _rotations, opacity = plane(4000)
        write_splat(source, centers, scales, opacity)
        model = root / "plane-lod.rad"
        result, path = splat_volume.rebuild(source, model)
        self.assertEqual((result, path.name), ("built", "plane-lod.rad.light"))
        self.assertEqual(splat_volume.rebuild(source, model)[0], "kept")
        (root / "plane-lod.rad.light.gz").write_bytes(b"stale")
        self.assertEqual(splat_volume.rebuild(source, model, force=True)[0], "built")
        self.assertFalse((root / "plane-lod.rad.light.gz").exists())


if __name__ == "__main__":
    unittest.main()
