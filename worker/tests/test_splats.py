"""Tests of worker/splats.py, with a stand-in for Spark's build-lod:

  python3 -m unittest discover -s worker/tests
"""

import importlib
import os
import stat
import sys
import tempfile
import unittest
from pathlib import Path

WORKER_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(WORKER_DIR))

# Writes <name>-lod.rad next to its last argument, as build-lod does, and
# records its arguments; "fail" in the file name makes it exit 101 (a panic).
FAKE_BUILD_LOD = """#!/usr/bin/env python3
import sys
from pathlib import Path
src = Path(sys.argv[-1])
Path("args.txt").write_text(" ".join(sys.argv[1:]))
if "fail" in src.name:
    sys.exit(101)
src.with_name(src.stem + "-lod.rad").write_bytes(b"RAD0 tree of " + src.read_bytes())
"""


class BuildRadTest(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp(prefix="splats-test-"))
        tool = self.dir / "build-lod"
        tool.write_text(FAKE_BUILD_LOD)
        tool.chmod(tool.stat().st_mode | stat.S_IXUSR)
        self.env = {"WORKER_SPLAT_LOD_BIN": str(tool), "WORKER_SPLAT_LOD": "auto"}

    def load(self, **env):
        old = {key: os.environ.get(key) for key in {**self.env, **env}}
        os.environ.update({**self.env, **env})
        try:
            import splats
            return importlib.reload(splats)
        finally:
            for key, value in old.items():
                if value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = value

    def upload(self, name):
        path = self.dir / "job" / name
        path.parent.mkdir(exist_ok=True)
        path.write_bytes(b"splats")
        return path

    def test_builds_rad_next_to_upload(self):
        splats = self.load()
        upload = self.upload("Angel.spz")
        rad = splats.build_rad(upload)
        self.assertEqual(rad, upload.with_name("Angel-lod.rad"))
        self.assertEqual(rad.read_bytes(), b"RAD0 tree of splats")
        self.assertTrue(upload.is_file())
        self.assertEqual((upload.parent / "args.txt").read_text(), "--quality --rad Angel.spz")

    def test_options_from_environment(self):
        splats = self.load(WORKER_SPLAT_LOD_ARGS="--quick --max-sh=1")
        upload = self.upload("Skull.ply")
        self.assertIsNotNone(splats.build_rad(upload))
        self.assertEqual((upload.parent / "args.txt").read_text(), "--quick --max-sh=1 --rad Skull.ply")

    def test_upload_named_like_a_tree(self):
        # build-lod skips *-lod.spz inputs; a copy under another name is used.
        splats = self.load()
        upload = self.upload("Crown-lod.spz")
        rad = splats.build_rad(upload)
        self.assertEqual(rad.name, "Crown-lod-src-lod.rad")
        self.assertFalse(upload.with_name("Crown-lod-src.spz").exists())

    def test_failure_keeps_upload(self):
        splats = self.load()
        upload = self.upload("fail.spz")
        self.assertIsNone(splats.build_rad(upload))
        self.assertEqual(sorted(p.name for p in upload.parent.glob("*.rad")), [])

    def test_off_or_missing_tool(self):
        self.assertFalse(self.load(WORKER_SPLAT_LOD="off").available())
        splats = self.load(WORKER_SPLAT_LOD_BIN=str(self.dir / "missing"))
        self.assertFalse(splats.available())
        self.assertIsNone(splats.build_rad(self.upload("Angel.spz")))

    def test_rad_and_other_formats_are_not_converted(self):
        splats = self.load()
        self.assertIsNone(splats.build_rad(self.upload("Ready-lod.rad")))
        self.assertIsNone(splats.build_rad(self.upload("model.glb")))


if __name__ == "__main__":
    unittest.main()
