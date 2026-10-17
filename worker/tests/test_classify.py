"""Tests of worker/classify.py on a synthetic scene: sloped ground, a
building, a tree and stray points.

  python3 -m unittest discover -s worker/tests
"""

import os
import sys
import tempfile
import unittest
from pathlib import Path

WORKER_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(WORKER_DIR))

try:
    import numpy as np
    import laspy
except ImportError:  # the worker image has both
    np = laspy = None

import classify  # noqa: E402


def scene(seed=1):
    """(xyz, labels) of a 60 x 60 m plot: ground sloping 5 %, a 12 x 10 x 8 m
    building, a 6 m tree, a few stray points above and below."""
    rng = np.random.default_rng(seed)
    parts, labels = [], []

    def add(points, label):
        parts.append(points)
        labels.append(np.full(len(points), label))

    ground_z = lambda x, y: 0.05 * x + rng.normal(0, 0.03, np.shape(x))
    xy = rng.uniform(0, 60, (40000, 2))
    inside = (xy[:, 0] > 20) & (xy[:, 0] < 32) & (xy[:, 1] > 20) & (xy[:, 1] < 30)
    xy = xy[~inside]
    add(np.column_stack([xy, ground_z(xy[:, 0], xy[:, 1])]), classify.GROUND)

    base = 0.05 * 20
    roof = rng.uniform([20, 20], [32, 30], (6000, 2))
    add(np.column_stack([roof, np.full(len(roof), base + 8.0)]), classify.BUILDING)
    for x0, y0, x1, y1 in ((20, 20, 32, 20), (20, 30, 32, 30), (20, 20, 20, 30), (32, 20, 32, 30)):
        t = rng.uniform(0, 1, 2000)
        z = rng.uniform(base + 0.6, base + 8.0, 2000)
        add(np.column_stack([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z]), classify.BUILDING)

    crown = rng.normal(0, 1.6, (5000, 3))
    crown = crown[np.linalg.norm(crown, axis=1) < 2.5]
    tree = crown + [45, 45, 0.05 * 45 + 5.0]
    add(tree, classify.HIGH_VEGETATION)

    strays = np.array([[10, 50, 0.5 + 25.0], [50, 10, 2.5 - 9.0], [5, 5, 0.25 + 30.0]])
    add(strays, classify.NOISE)
    return np.concatenate(parts), np.concatenate(labels)


@unittest.skipUnless(np is not None, "numpy/laspy not installed")
class GeometricClassifierTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.xyz, cls.truth = scene()
        cls.classes = classify.classify_points(cls.xyz)

    def share(self, label, expected):
        mask = self.truth == label
        return float(np.isin(self.classes[mask], expected).mean())

    def test_ground(self):
        self.assertGreater(self.share(classify.GROUND, [classify.GROUND]), 0.95)

    def test_building(self):
        self.assertGreater(self.share(classify.BUILDING, [classify.BUILDING]), 0.8)
        # Never taken for ground except at the foot of the walls.
        self.assertLess(self.share(classify.BUILDING, [classify.GROUND]), 0.05)

    def test_tree(self):
        vegetation = [classify.LOW_VEGETATION, classify.MEDIUM_VEGETATION, classify.HIGH_VEGETATION]
        self.assertGreater(self.share(classify.HIGH_VEGETATION, vegetation), 0.8)
        self.assertLess(self.share(classify.HIGH_VEGETATION, [classify.BUILDING]), 0.1)

    def test_noise(self):
        self.assertEqual(self.share(classify.NOISE, [classify.NOISE]), 1.0)

    def test_tiny_cloud(self):
        self.assertTrue((classify.classify_points(np.zeros((3, 3))) == classify.UNCLASSIFIED).all())


@unittest.skipUnless(laspy is not None, "numpy/laspy not installed")
class FileTests(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp(prefix="classify-test-"))
        xyz, _ = scene(seed=2)
        header = laspy.LasHeader(point_format=3, version="1.2")
        header.scales = [0.001] * 3
        header.offsets = xyz.min(axis=0)
        las = laspy.LasData(header)
        las.x, las.y, las.z = xyz[:, 0], xyz[:, 1], xyz[:, 2]
        self.source = self.dir / "scan.las"
        las.write(str(self.source))
        self.count = len(xyz)

    def tearDown(self):
        for name in ("WORKER_POINTCLOUD_CLASSIFY", "WORKER_POINTCLOUD_CLASSIFY_MAX_POINTS", "WORKER_POINTCLOUD_CLASSIFIER", "WORKER_POINTCLOUD_CLASSIFIER_CMD"):
            os.environ.pop(name, None)

    def test_off_by_default(self):
        self.assertIsNone(classify.maybe_classify(self.source, self.dir / "work"))

    def test_auto_classifies_unclassified_cloud(self):
        os.environ["WORKER_POINTCLOUD_CLASSIFY"] = "auto"
        stats = self.dir / "scan.classification.json"
        started = []
        target = classify.maybe_classify(self.source, self.dir / "work", stats, on_start=lambda: started.append(1))
        self.assertIsNotNone(target)
        self.assertEqual(started, [1])
        result = laspy.read(str(target))
        self.assertEqual(len(result.points), self.count)
        self.assertGreater(int((np.asarray(result.classification) == classify.GROUND).sum()), 0)
        self.assertIn("ground", stats.read_text())

        # A cloud with classes is left as it is in auto mode.
        self.assertIsNone(classify.maybe_classify(target, self.dir / "work2"))

    def test_too_large(self):
        os.environ["WORKER_POINTCLOUD_CLASSIFY"] = "always"
        os.environ["WORKER_POINTCLOUD_CLASSIFY_MAX_POINTS"] = "10"
        self.assertIsNone(classify.maybe_classify(self.source, self.dir / "work"))

    def test_command(self):
        os.environ["WORKER_POINTCLOUD_CLASSIFY"] = "always"
        os.environ["WORKER_POINTCLOUD_CLASSIFIER"] = "command"
        # Stands in for a trained model: copies the file.
        os.environ["WORKER_POINTCLOUD_CLASSIFIER_CMD"] = "cp {input} {output}"
        target = classify.maybe_classify(self.source, self.dir / "work")
        self.assertTrue(target.is_file())
        os.environ["WORKER_POINTCLOUD_CLASSIFIER_CMD"] = "false"
        self.assertIsNone(classify.maybe_classify(self.source, self.dir / "work3"))



FAKE_POTREE = """#!/usr/bin/env python3
# Stands in for PotreeConverter: records the classes of its input.
import json, sys
from pathlib import Path
import laspy, numpy as np
source, out = sys.argv[1], Path(sys.argv[sys.argv.index("-o") + 1])
out.mkdir(parents=True, exist_ok=True)
classes = sorted(int(c) for c in np.unique(np.asarray(laspy.read(source).classification)))
(out / "metadata.json").write_text(json.dumps({"input": source, "classes": classes}))
"""


@unittest.skipUnless(laspy is not None, "numpy/laspy not installed")
class PipelineTests(unittest.TestCase):
    def test_tiles_get_the_classes(self):
        work = Path(tempfile.mkdtemp(prefix="classify-pipeline-"))
        fake = work / "FakePotree"
        fake.write_text(FAKE_POTREE)
        fake.chmod(0o755)
        os.environ["WORKER_POTREE_CONVERTER"] = str(fake)
        os.environ["WORKER_POINTCLOUD_CLASSIFY"] = "auto"
        os.environ["WORKER_POINTCLOUD_PREVIEW_POINTS"] = "0"
        try:
            import importlib
            import pointcloud
            importlib.reload(pointcloud)
            xyz, _ = scene(seed=3)
            header = laspy.LasHeader(point_format=3, version="1.2")
            header.scales = [0.001] * 3
            header.offsets = xyz.min(axis=0)
            las = laspy.LasData(header)
            las.x, las.y, las.z = xyz[:, 0], xyz[:, 1], xyz[:, 2]
            source = work / "scan.laz"
            las.write(str(source))
            stages = []
            entry = pointcloud.convert_to_tiles(source, work / "tiles" / "scan", work / "tiles" / "scan.work",
                                                fmt="potree", on_classify=lambda: stages.append("classify"))
            import json
            result = json.loads(entry.read_text())
            self.assertIn(classify.GROUND, result["classes"])
            self.assertIn(classify.BUILDING, result["classes"])
            self.assertTrue(result["input"].endswith(".classified.las"))
            self.assertEqual(stages, ["classify"])
            self.assertTrue((work / "tiles" / "scan.classification.json").is_file())
            # The intermediate file is gone.
            self.assertFalse(Path(result["input"]).exists())
        finally:
            for name in ("WORKER_POTREE_CONVERTER", "WORKER_POINTCLOUD_CLASSIFY", "WORKER_POINTCLOUD_PREVIEW_POINTS"):
                os.environ.pop(name, None)


if __name__ == "__main__":
    unittest.main()
