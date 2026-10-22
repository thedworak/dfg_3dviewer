"""Tests of worker/geonames.py on a sample in the GeoNames format
(geonames_sample.txt: a few towns, with the coordinates, populations and
alternate names GeoNames gives them, and places of the same name elsewhere).

  python3 -m unittest discover -s worker/tests
"""

import os
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

WORKER_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(WORKER_DIR))

import geonames  # noqa: E402

SAMPLE = Path(__file__).resolve().parent / "geonames_sample.txt"


class GeoNamesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.db = geonames.build_index([SAMPLE], Path(cls.tmp.name) / "index.sqlite", log=None)
        cls.connection = sqlite3.connect(cls.db)

    @classmethod
    def tearDownClass(cls):
        cls.connection.close()
        cls.tmp.cleanup()

    def find(self, text):
        return geonames.find_places(text, self.connection)

    def test_inflected_polish_names(self):
        best = self.find("Zamek w Malborku, XIV w., stan po rekonstrukcji.")[0]
        self.assertEqual((best["name"], best["country"]), ("Malbork", "PL"))
        self.assertAlmostEqual(best["latitude"], 54.0359, places=3)
        self.assertGreaterEqual(best["confidence"], 0.6)
        self.assertEqual(self.find("Sukiennice w Krakowie")[0]["name"], "Kraków")
        self.assertEqual(self.find("Ratusz w Toruniu")[0]["name"], "Toruń")
        self.assertEqual(self.find("Kamienica w Nowym Sączu")[0]["name"], "Nowy Sącz")

    def test_a_village_after_a_preposition(self):
        names = [place["name"] for place in self.find("Kolegiata w Tumie pod Łęczycą")]
        self.assertIn("Łęczyca", names)
        self.assertIn("Tum", names)

    def test_alternate_names_and_multiword_names(self):
        self.assertEqual(self.find("The cathedral in Cologne")[0]["name"], "Köln")
        self.assertEqual(self.find("Krantor in Danzig")[0]["name"], "Gdańsk")
        self.assertEqual(self.find("Römer, Frankfurt am Main")[0]["name"], "Frankfurt am Main")
        self.assertEqual(self.find("Kirche in Frankfurt an der Oder")[0]["name"], "Frankfurt (Oder)")

    def test_the_country_named_decides_and_rivals_lower_the_confidence(self):
        england = self.find("The Minster in York, England")[0]
        self.assertEqual(england["country"], "GB")
        alone = self.find("The Minster in York")[0]
        self.assertLess(alone["confidence"], england["confidence"])
        self.assertEqual(self.find("Notre-Dame de Paris, Francja")[0]["country"], "FR")

    def test_words_that_are_not_meant_as_places(self):
        # Zamek and Wells are villages too; a capital alone is no evidence.
        self.assertEqual(self.find("Zamek. Model 3D, skan z 2021 roku."), [])
        # A town's name opening a sentence: a guess at most.
        wells = self.find("Wells and cisterns of the castle")
        self.assertTrue(all(place["confidence"] < 0.5 for place in wells))
        self.assertEqual(self.find(""), [])
        self.assertEqual(self.find("malbork castle"), [])

    def test_the_index_is_built_once_and_again_when_the_dump_changes(self):
        with tempfile.TemporaryDirectory() as tmp:
            dump = Path(tmp) / "cities.txt"
            dump.write_text(SAMPLE.read_text("utf-8"), "utf-8")
            os.environ["WORKER_GEONAMES"] = str(dump)
            os.environ.pop("WORKER_GEONAMES_DB", None)
            try:
                index = geonames.GeoIndex()
                index.start()
                index.thread.join(10)
                self.assertEqual(index.state, "ready")
                self.assertEqual(index.db_path, Path(tmp) / "cities.sqlite")
                self.assertEqual(index.find("w Malborku")[0]["name"], "Malbork")
                again = geonames.GeoIndex()
                again.start()
                self.assertEqual(again.state, "ready")
                os.utime(dump, (1, 1))
                changed = geonames.GeoIndex()
                changed.start()
                self.assertEqual(changed.state, "building")
                changed.thread.join(10)
                self.assertEqual(changed.state, "ready")
            finally:
                os.environ.pop("WORKER_GEONAMES", None)

    def test_off_without_files(self):
        os.environ["WORKER_GEONAMES"] = ""
        try:
            self.assertFalse(geonames.enabled())
            index = geonames.GeoIndex()
            index.start()
            self.assertEqual(index.state, "off")
        finally:
            os.environ.pop("WORKER_GEONAMES", None)


if __name__ == "__main__":
    unittest.main()
