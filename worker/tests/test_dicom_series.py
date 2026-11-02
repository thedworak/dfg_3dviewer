"""Tests of worker/dicom_series.py, on DICOM files written here with pydicom:

  python3 -m unittest discover -s worker/tests
"""

import gzip
import json
import sys
import tempfile
import unittest
from pathlib import Path

WORKER_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(WORKER_DIR))

try:
    import numpy as np
    import pydicom  # noqa: F401
    from pydicom.dataset import Dataset, FileDataset, FileMetaDataset
    from pydicom.sequence import Sequence
    from pydicom.uid import CTImageStorage, ExplicitVRLittleEndian, ImplicitVRLittleEndian, generate_uid
except ImportError:  # the worker's image has both (Dockerfile.base)
    np = None

if np is not None:
    import dicom_series
    import volumes

ENHANCED_CT = "1.2.840.10008.5.1.4.1.1.2.1"


def hounsfield(nz=8, ny=12, nx=10, seed=1):
    rng = np.random.default_rng(seed)
    values = rng.integers(-1000, 1500, size=(nz, ny, nx)).astype(np.int16)
    values[nz // 2, ny // 2, nx // 2] = 3000  # a single metal voxel
    return values


def dataset(sop_class, syntax=None):
    meta = FileMetaDataset()
    meta.MediaStorageSOPClassUID = sop_class
    meta.MediaStorageSOPInstanceUID = generate_uid()
    meta.TransferSyntaxUID = syntax or ExplicitVRLittleEndian
    ds = FileDataset(None, {}, file_meta=meta, preamble=b"\0" * 128)
    ds.SOPClassUID, ds.SOPInstanceUID = sop_class, meta.MediaStorageSOPInstanceUID
    ds.PatientName, ds.PatientID, ds.PatientBirthDate, ds.StudyDate = "Doe^Jane", "PID-123", "19700101", "20260102"
    ds.Modality, ds.Manufacturer = "CT", "Test"
    ds.SamplesPerPixel, ds.PhotometricInterpretation = 1, "MONOCHROME2"
    ds.BitsAllocated, ds.BitsStored, ds.HighBit, ds.PixelRepresentation = 16, 16, 15, 0
    return ds


def write_series(folder, values, series_uid=None, syntax=None, spacing=(0.5, 0.5, 1.25)):
    """One file per slice, without extensions, written in a shuffled order."""
    folder.mkdir(parents=True, exist_ok=True)
    series_uid = series_uid or generate_uid()
    nz, ny, nx = values.shape
    for n, z in enumerate(np.random.default_rng(2).permutation(nz)):
        ds = dataset(CTImageStorage, syntax)
        ds.SeriesInstanceUID, ds.SeriesNumber, ds.SeriesDescription = series_uid, 3, "Head"
        ds.InstanceNumber = int(z) + 1
        ds.ImageOrientationPatient = [1, 0, 0, 0, 1, 0]
        ds.ImagePositionPatient = [0, 0, float(z) * spacing[2]]
        ds.PixelSpacing, ds.SliceThickness = [spacing[1], spacing[0]], spacing[2]
        ds.Rows, ds.Columns = ny, nx
        # Stored as unsigned with an intercept; slice-dependent, to check it is applied per slice.
        intercept = -1024 - (z % 2)
        ds.RescaleIntercept, ds.RescaleSlope = intercept, 1
        ds.WindowCenter, ds.WindowWidth, ds.WindowCenterWidthExplanation = [40, 400], [400, 1800], ["SOFT", "BONE"]
        ds.PixelData = (values[z].astype(np.int32) - intercept).astype(np.uint16).tobytes()
        ds.save_as(folder / f"IM{n:04d}", enforce_file_format=True)
    return series_uid


@unittest.skipIf(np is None, "numpy or pydicom not installed")
class DicomSeriesTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def convert(self, root):
        manifest = self.dir / "volume" / "scan.dfgvol"
        manifest.parent.mkdir(exist_ok=True)
        first = dicom_series.find_files(root)[0]
        result = dicom_series.convert(first, manifest, root=root)
        return manifest, result

    def voxels(self, manifest, series):
        nx, ny, nz = series["dims"]
        with gzip.open(manifest.parent / series["data"], "rb") as file:
            return np.frombuffer(file.read(), dtype=np.uint8).reshape(nz, ny, nx)

    def test_series_sorted_rescaled_and_anonymous(self):
        values = hounsfield()
        write_series(self.dir / "study" / "series", values)
        (self.dir / "study" / "notes.txt").write_text("not DICOM")
        manifest, result = self.convert(self.dir / "study")
        series = result["series"][0]
        self.assertEqual(series["name"], "3 Head")
        self.assertEqual(series["dims"], [10, 12, 8])
        self.assertEqual(series["voxelSize"], [500.0, 500.0, 1250.0])
        channel = series["channels"][0]
        self.assertEqual(channel["unit"], "HU")
        self.assertEqual([w["name"] for w in channel["windows"]], ["SOFT", "BONE"])
        # Up to the maximum for HU: the metal voxel is in the range.
        self.assertEqual(channel["range"][1], 3000.0)
        voxels = self.voxels(manifest, series)
        self.assertGreater(np.corrcoef(voxels.ravel().astype(float), values.ravel().astype(float))[0, 1], 0.99)
        text = manifest.read_text()
        for private in ("Doe", "Jane", "PID-123", "1970", "20260102"):
            self.assertNotIn(private, text)
        self.assertEqual(json.loads(text)["series"][0]["acquisition"]["modality"], "CT")

    def test_implicit_vr(self):
        values = hounsfield(seed=3)
        write_series(self.dir / "s", values, syntax=ImplicitVRLittleEndian)
        manifest, result = self.convert(self.dir / "s")
        voxels = self.voxels(manifest, result["series"][0])
        self.assertGreater(np.corrcoef(voxels.ravel().astype(float), values.ravel().astype(float))[0, 1], 0.99)

    def test_two_series_and_a_single_image(self):
        write_series(self.dir / "a", hounsfield(nz=6, seed=4))
        write_series(self.dir / "b", hounsfield(nz=9, seed=5))
        write_series(self.dir / "c", hounsfield(nz=1, seed=6))
        _manifest, result = self.convert(self.dir)
        self.assertEqual([s["sourceDims"][2] for s in result["series"]], [9, 6])
        self.assertIn("single image", result["skipped"][0]["reason"])

    def test_multiframe(self):
        values = hounsfield(nz=5, seed=7)
        nz, ny, nx = values.shape
        ds = dataset(ENHANCED_CT)
        ds.SeriesInstanceUID, ds.SeriesNumber = generate_uid(), 1
        ds.Rows, ds.Columns, ds.NumberOfFrames = ny, nx, nz
        shared = Dataset()
        measures = Dataset()
        measures.PixelSpacing, measures.SliceThickness = [0.4, 0.4], 0.8
        shared.PixelMeasuresSequence = Sequence([measures])
        transform = Dataset()
        transform.RescaleIntercept, transform.RescaleSlope = -1024, 1
        shared.PixelValueTransformationSequence = Sequence([transform])
        orientation = Dataset()
        orientation.ImageOrientationPatient = [1, 0, 0, 0, 1, 0]
        shared.PlaneOrientationSequence = Sequence([orientation])
        ds.SharedFunctionalGroupsSequence = Sequence([shared])
        # Frames stored top to bottom: put in order by their positions.
        frames = []
        for f in range(nz):
            item, plane = Dataset(), Dataset()
            plane.ImagePositionPatient = [0, 0, float(nz - 1 - f) * 0.8]
            item.PlanePositionSequence = Sequence([plane])
            frames.append(item)
        ds.PerFrameFunctionalGroupsSequence = Sequence(frames)
        ds.PixelData = (values[::-1].astype(np.int32) + 1024).astype(np.uint16).tobytes()
        ds.save_as(self.dir / "enhanced.dcm", enforce_file_format=True)
        manifest, result = self.convert(self.dir)
        series = result["series"][0]
        self.assertEqual(series["voxelSize"], [400.0, 400.0, 800.0])
        voxels = self.voxels(manifest, series)
        self.assertGreater(np.corrcoef(voxels.ravel().astype(float), values.ravel().astype(float))[0, 1], 0.99)

    def test_no_series(self):
        (self.dir / "x.dcm").write_bytes(b"\0" * 200)
        with self.assertRaises(dicom_series.DicomError):
            self.convert_any()

    def convert_any(self):
        manifest = self.dir / "volume" / "x.dfgvol"
        manifest.parent.mkdir(exist_ok=True)
        return dicom_series.convert(self.dir / "x.dcm", manifest, root=self.dir)

    def test_manifest_name(self):
        self.assertEqual(volumes.manifest_path_for(Path("/jobs/1/input/head-ct.zip")).name, "head-ct.dfgvol")


if __name__ == "__main__":
    unittest.main()
