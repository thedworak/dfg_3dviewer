"""Tests of the GLB optimization (optimize.py) around gltfpack itself:

  python3 -m unittest discover -s worker/tests
"""

import os
import stat
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

WORKER_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(WORKER_DIR))

import optimize  # noqa: E402

# Killed like the kernel kills it out of memory while encoding textures in
# parallel; with -tj 1 it copies the input to the output.
FAKE_GLTFPACK = """#!/bin/sh
while [ $# -gt 0 ]; do
  case "$1" in
    -i) input="$2"; shift ;;
    -o) output="$2"; shift ;;
    -tj) jobs="$2"; shift ;;
  esac
  shift
done
[ "$jobs" = "1" ] || kill -9 $$
cp "$input" "$output"
"""


class GltfpackOutOfMemoryTest(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp(prefix="optimize-test-"))
        fake = self.dir / "gltfpack"
        fake.write_text(FAKE_GLTFPACK)
        fake.chmod(fake.stat().st_mode | stat.S_IEXEC)
        for patch in (
            mock.patch.object(optimize, "GLTFPACK_BIN", str(fake)),
            mock.patch.object(optimize, "TEXTURE_JOBS", 4),
        ):
            patch.start()
            self.addCleanup(patch.stop)

    def test_killed_run_is_tried_again_one_texture_at_a_time(self):
        source = self.dir / "model.glb"
        source.write_bytes(b"glTF" + bytes(100))
        result = optimize.optimize_glb(source, self.dir / "gltf" / "model.glb", make_preview=False)
        self.assertEqual(result["model"].read_bytes(), source.read_bytes())

    def test_killed_with_one_texture_at_a_time_too_says_so(self):
        with mock.patch.object(optimize, "TEXTURE_JOBS", 1), mock.patch.dict(os.environ):
            source = self.dir / "model.glb"
            source.write_bytes(b"glTF")
            (self.dir / "gltfpack").write_text("#!/bin/sh\nkill -9 $$\n")
            with self.assertRaisesRegex(RuntimeError, "out of memory"):
                optimize.optimize_glb(source, self.dir / "out.glb", make_preview=False)


if __name__ == "__main__":
    unittest.main()
