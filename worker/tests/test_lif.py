"""Tests of worker/lif.py, on LIF files made up here:

  python3 -m unittest discover -s worker/tests
"""

import gzip
import json
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
    import lif


def series_xml(name, block, dims, channels):
    """An image element: dims [(DimID, count, length in m, stride)],
    channels [(LUT, byte offset)], 16-bit."""
    channel_xml = "".join(
        f'<ChannelDescription DataType="0" Resolution="16" LUTName="{lut}" BytesInc="{offset}">'
        f"<ChannelProperty><Key>DetectorName</Key><Value>HyD {i + 1}</Value></ChannelProperty>"
        "</ChannelDescription>"
        for i, (lut, offset) in enumerate(channels)
    )
    dim_xml = "".join(
        f'<DimensionDescription DimID="{dim}" NumberOfElements="{count}" Length="{length}" Unit="m" BytesInc="{stride}"/>'
        for dim, count, length, stride in dims
    )
    return (
        f'<Element Name="{name}"><Data><Image><ImageDescription><Channels>{channel_xml}</Channels>'
        f"<Dimensions>{dim_xml}</Dimensions></ImageDescription>"
        '<ATLConfocalSettingDefinition ObjectiveName="HC PL APO   20x/0.75  DRY" NumericalAperture="0.75"/>'
        f'</Image></Data><Memory Size="{{size:{block}}}" MemoryBlockID="{block}"/><Children/></Element>'
    )


def write_lif(path, elements, blocks):
    """elements: series XML strings; blocks: [(id, bytes)] in file order."""
    xml = '<LMSDataContainerHeader Version="2"><Element Name="test.lif"><Data><Experiment/></Data>'
    xml += '<Memory Size="0" MemoryBlockID="MemBlock_0"/><Children>' + "".join(elements) + "</Children></Element></LMSDataContainerHeader>"
    for block_id, data in blocks:
        xml = xml.replace(f"{{size:{block_id}}}", str(len(data)))
    encoded = xml.encode("utf-16-le")
    out = bytearray(struct.pack("<IIBI", 0x70, len(encoded) + 5, 0x2A, len(xml)) + encoded)
    for block_id, data in [("MemBlock_0", b""), *blocks]:
        name = block_id.encode("utf-16-le")
        out += struct.pack("<IIBQBI", 0x70, 0, 0x2A, len(data), 0x2A, len(block_id)) + name + data
    Path(path).write_bytes(bytes(out))


def stack(nz, ny, nx, seed):
    rng = np.random.default_rng(seed)
    return rng.integers(0, 4000, size=(nz, ny, nx), dtype=np.uint16)


@unittest.skipIf(np is None, "numpy not installed")
class LifTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def make_file(self):
        nz, ny, nx = 6, 8, 10
        a, b = stack(nz, ny, nx, 1), stack(nz, ny, nx, 2)
        plane, volume = nx * ny * 2, nx * ny * nz * 2
        # Channels one after another: a whole stack, then the next.
        planar = a.tobytes() + b.tobytes()
        # Channels interleaved plane by plane: z0 a, z0 b, z1 a, ...
        interleaved = np.stack([a, b], axis=1).tobytes()
        xy = [(1, nx, 9e-6, 2), (2, ny, 7e-6, nx * 2)]
        elements = [
            series_xml("Planar", "MemBlock_1", [*xy, (3, nz, 10e-6, plane)], [("Green", 0), ("Magenta", volume)]),
            series_xml("Interleaved", "MemBlock_2", [*xy, (3, nz, 10e-6, plane * 2)], [("Red", 0), ("Gray", plane)]),
            series_xml("Single plane", "MemBlock_3", xy, [("Green", 0)]),
            series_xml("Mosaic", "MemBlock_4", [*xy, (10, 2, 1, plane)], [("Green", 0)]),
        ]
        blocks = [
            ("MemBlock_1", planar),
            ("MemBlock_2", interleaved),
            ("MemBlock_3", a[0].tobytes()),
            ("MemBlock_4", a[:2].tobytes()),
        ]
        source = self.dir / "test.lif"
        write_lif(source, elements, blocks)
        return source, a, b

    def read_volume(self, manifest, series):
        nx, ny, nz = series["dims"]
        with gzip.open(manifest.parent / series["data"], "rb") as file:
            return np.frombuffer(file.read(), dtype=np.uint8).reshape(len(series["channels"]), nz, ny, nx)

    def test_both_channel_layouts_read_alike(self):
        source, a, b = self.make_file()
        manifest = lif.manifest_path_for(source)
        manifest.parent.mkdir(parents=True)
        result = lif.convert(source, manifest)
        series = {s["name"]: s for s in result["series"]}
        self.assertEqual(set(series), {"Planar", "Interleaved"})
        for name in series:
            voxels = self.read_volume(manifest, series[name])
            for values, expected in zip(voxels, (a, b)):
                # 8-bit, but ordered as the 16-bit source: the same voxels.
                self.assertGreater(np.corrcoef(values.ravel(), expected.ravel())[0, 1], 0.99, name)
        self.assertEqual(series["Planar"]["dims"], [10, 8, 6])
        self.assertEqual([c["color"] for c in series["Planar"]["channels"]], ["#00ff00", "#ff00ff"])
        self.assertEqual(series["Planar"]["channels"][0]["name"], "HyD 1 (Green)")
        self.assertEqual(series["Planar"]["acquisition"]["objective"], "HC PL APO 20x/0.75 DRY")
        self.assertAlmostEqual(series["Planar"]["voxelSize"][0], 1.0, places=4)
        self.assertAlmostEqual(series["Planar"]["voxelSize"][2], 2.0, places=4)
        skipped = {s["name"]: s["reason"] for s in result["skipped"]}
        self.assertIn("single plane", skipped["Single plane"])
        self.assertIn("mosaic", skipped["Mosaic"])
        self.assertEqual(json.loads(manifest.read_text())["format"], "dfg-volume")

    def test_large_axes_are_reduced(self):
        source, _a, _b = self.make_file()
        manifest = self.dir / "out" / "test.dfgvol"
        manifest.parent.mkdir()
        result = lif.convert(source, manifest, max_size=4)
        series = result["series"][0]
        self.assertEqual(series["dims"], [4, 4, 3])
        self.assertEqual(series["sourceDims"], [10, 8, 6])
        self.assertAlmostEqual(series["voxelSize"][0], 3.0, places=4)
        self.assertEqual(self.read_volume(manifest, series).shape, (2, 3, 4, 4))

    def test_preview(self):
        source, _a, _b = self.make_file()
        manifest = lif.manifest_path_for(source)
        manifest.parent.mkdir(parents=True)
        result = lif.convert(source, manifest)
        preview = lif.write_preview(manifest, result, self.dir / "views" / "test_side45.png")
        self.assertTrue(preview.read_bytes().startswith(b"\x89PNG\r\n\x1a\n"))

    def test_not_a_lif(self):
        source = self.dir / "fake.lif"
        source.write_bytes(b"PK\x03\x04 not a lif at all")
        with self.assertRaises(lif.LifError):
            lif.convert(source, self.dir / "fake.dfgvol")

    def test_no_stack(self):
        nx, ny = 4, 4
        source = self.dir / "flat.lif"
        write_lif(
            source,
            [series_xml("Flat", "MemBlock_1", [(1, nx, 1e-5, 2), (2, ny, 1e-5, nx * 2)], [("Green", 0)])],
            [("MemBlock_1", bytes(nx * ny * 2))],
        )
        with self.assertRaises(lif.LifError) as caught:
            lif.convert(source, self.dir / "flat.dfgvol")
        self.assertIn("single plane", str(caught.exception))


if __name__ == "__main__":
    unittest.main()
