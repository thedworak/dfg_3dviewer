#!/usr/bin/env python3
"""Places named in a model's texts, found offline in GeoNames.

The viewer's suggested scene (viewer/editor/scene-suggest.js) puts the sun
where the object stands. A manifest seldom says where that is, but the
metadata usually names the town: "Zamek w Malborku", "Kirche in Tum bei
Łęczyca". This module finds such names in a text and answers with the
place's coordinates, from a GeoNames dump (https://www.geonames.org, CC BY
4.0) read into a SQLite index - no network, no API key, nothing sent on.

  POST /api/geo/places {text}  -> {places: [{name, country, latitude,
                                   longitude, population, timezone, matched,
                                   confidence}]}

The dump is one or more GeoNames text files (tab-separated, the "geoname"
table: cities500.txt, cities15000.txt, a country's PL.txt, allCountries.txt;
.zip as downloaded is read too). The worker image downloads cities500 (all
places with at least 500 people, about 200 000) and builds the index at
build time; elsewhere the index is built in the background on start, or by
hand:

  python3 worker/geonames.py build            # the index of WORKER_GEONAMES
  python3 worker/geonames.py find "Zamek w Malborku, XIV w."

Matching. Names are compared lower-case without diacritics (Łęczyca and
Leczyca alike), with the place's alternate names (Krakau, Cracow, Kraków)
in Latin script. Polish and German case endings are stripped from both the
names and the text (w Malborku -> malbork, w Krakowie -> krak-, Łęczycy ->
leczyc-), so an inflected name still matches, a little less surely. A name
counts when it is written with a capital (Frankfurt am Main, Nowy Sącz);
a single word that is short or common only after a preposition ("w", "in",
"bei", "near"...), and otherwise only a town (2000 people; 5000 at the
start of a sentence). Among places of one name
the larger one wins, and one in a country the text names; the confidence
drops when places of the same name in other countries come close.

Environment:
  WORKER_GEONAMES       comma-separated dump files; empty: off.
                        Default: /app/geonames/places.txt (the image's
                        dump, GEONAMES_DATASET) if present.
  WORKER_GEONAMES_DB    the index (default: <first file>.sqlite, or under
                        /data/jobs when that directory is not writable).
"""

import math
import os
import re
import sqlite3
import sys
import threading
import unicodedata
import zipfile
from pathlib import Path

DEFAULT_FILE = "/app/geonames/places.txt"
MAX_TEXT = 20000
# Words of a name, at most.
MAX_WORDS = 4
# Alternate names of a place kept, at most (some have hundreds).
MAX_ALTERNATES = 40
INDEX_VERSION = "1"

# Lower-case words that may stand inside a name: Frankfurt am Main, Nowe
# Miasto nad Pilicą, Stratford-upon-Avon, Saint-Rémy-de-Provence.
CONNECTORS = {
    "nad", "pod", "am", "an", "der", "im", "in", "bei", "ob", "upon", "on", "de", "la", "le", "les", "sur", "en", "del",
    "di", "da", "do", "dos", "das", "el", "y", "e", "und", "and",
}

# Words before a place: "w Malborku", "in Köln", "bei Tum", "near York".
PREPOSITIONS = {
    "w", "we", "pod", "nad", "kolo", "k", "z", "ze", "niedaleko", "obok", "przy", "miasto", "miasta", "wies", "wsi",
    "in", "im", "bei", "aus", "nahe", "nach", "von", "zu", "stadt", "dorf",
    "near", "at", "of", "from", "town", "village", "city", "outside",
}

# Capitalised words that are seldom meant as places here (titles, the
# objects themselves), though GeoNames has a village of most of them.
STOPWORDS = {
    "model", "scan", "skan", "castle", "church", "cathedral", "museum", "house", "tower", "gate", "palace", "chapel",
    "zamek", "kosciol", "katedra", "muzeum", "dom", "wieza", "brama", "palac", "kaplica", "rynek", "ratusz",
    "burg", "kirche", "dom", "turm", "tor", "schloss", "kapelle", "rathaus", "markt",
    "saint", "sankt", "san", "santa", "st", "sw", "the", "der", "die", "das", "ein", "eine", "a", "an",
    "north", "south", "east", "west", "new", "old", "great", "little", "upper", "lower",
    "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december",
    "styczen", "luty", "marzec", "kwiecien", "maj", "czerwiec", "lipiec", "sierpien", "wrzesien", "pazdziernik", "listopad", "grudzien",
    "januar", "februar", "marz", "mai", "juni", "juli", "oktober", "dezember",
    "photo", "foto", "image", "license", "licence", "author", "autor", "title", "description", "opis",
}

# Case endings (Polish, German, a few English), longest first; a stem keeps
# at least three letters.
SUFFIXES = sorted([
    "owie", "ami", "ach", "iem", "owi", "ego", "emu", "iej", "ich", "ie", "em", "om", "ow", "ym", "im", "ej", "ia", "iu",
    "u", "a", "e", "y", "i", "o", "s", "en", "es", "er", "ens",
], key=len, reverse=True)

# Country names (English, Polish, German; without diacritics) -> code: a
# place in a country the text names is preferred.
COUNTRIES = {
    "PL": ["poland", "polska", "polsce", "polen", "polski", "polnisch"],
    "DE": ["germany", "niemcy", "niemczech", "deutschland", "german", "niemiecki"],
    "AT": ["austria", "austrii", "osterreich"],
    "CH": ["switzerland", "szwajcaria", "szwajcarii", "schweiz"],
    "CZ": ["czech republic", "czechia", "czechy", "czechach", "tschechien"],
    "SK": ["slovakia", "slowacja", "slowacji", "slowakei"],
    "HU": ["hungary", "wegry", "wegrzech", "ungarn"],
    "LT": ["lithuania", "litwa", "litwie", "litauen"],
    "LV": ["latvia", "lotwa", "lotwie", "lettland"],
    "EE": ["estonia", "estonii", "estland"],
    "UA": ["ukraine", "ukraina", "ukrainie"],
    "BY": ["belarus", "bialorus", "bialorusi", "weissrussland"],
    "RU": ["russia", "rosja", "rosji", "russland"],
    "FR": ["france", "francja", "francji", "frankreich"],
    "IT": ["italy", "wlochy", "wloszech", "italien"],
    "ES": ["spain", "hiszpania", "hiszpanii", "spanien"],
    "PT": ["portugal", "portugalia", "portugalii"],
    "GB": ["united kingdom", "england", "scotland", "wales", "britain", "anglia", "anglii", "szkocja", "wielka brytania", "grossbritannien", "schottland"],
    "IE": ["ireland", "irlandia", "irlandii", "irland"],
    "NL": ["netherlands", "holland", "holandia", "holandii", "niderlandy", "niederlande"],
    "BE": ["belgium", "belgia", "belgii", "belgien"],
    "LU": ["luxembourg", "luksemburg", "luxemburg"],
    "DK": ["denmark", "dania", "danii", "danemark"],
    "SE": ["sweden", "szwecja", "szwecji", "schweden"],
    "NO": ["norway", "norwegia", "norwegii", "norwegen"],
    "FI": ["finland", "finlandia", "finlandii", "finnland"],
    "IS": ["iceland", "islandia", "islandii", "island"],
    "GR": ["greece", "grecja", "grecji", "griechenland"],
    "TR": ["turkey", "turkiye", "turcja", "turcji", "turkei"],
    "HR": ["croatia", "chorwacja", "chorwacji", "kroatien"],
    "SI": ["slovenia", "slowenia", "slowenii", "slowenien"],
    "RS": ["serbia", "serbii", "serbien"],
    "BA": ["bosnia", "bosnien"],
    "RO": ["romania", "rumunia", "rumunii", "rumanien"],
    "BG": ["bulgaria", "bulgarii", "bulgarien"],
    "MT": ["malta", "malcie"],
    "CY": ["cyprus", "cypr", "zypern"],
    "IL": ["israel", "izrael"],
    "EG": ["egypt", "egipt", "agypten"],
    "US": ["united states", "usa", "stany zjednoczone", "vereinigte staaten"],
    "CA": ["canada", "kanada"],
    "MX": ["mexico", "meksyk", "mexiko"],
    "BR": ["brazil", "brazylia", "brasilien"],
    "CN": ["china", "chiny", "chinach"],
    "JP": ["japan", "japonia", "japonii"],
    "IN": ["india", "indie", "indien"],
    "AU": ["australia", "australien"],
}


def normalize(text: str) -> str:
    """Lower case, without diacritics, punctuation inside names as spaces."""
    text = str(text or "").lower().replace("ß", "ss").replace("ł", "l").replace("ø", "o").replace("æ", "ae").replace("đ", "d").replace("œ", "oe")
    text = unicodedata.normalize("NFD", text)
    text = "".join(char for char in text if not unicodedata.combining(char))
    text = re.sub(r"[-'’.,()/]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def stem_word(word: str) -> str:
    for suffix in SUFFIXES:
        if word.endswith(suffix) and len(word) - len(suffix) >= 3:
            return word[: -len(suffix)]
    return word


def stem_key(key: str) -> str:
    return " ".join(stem_word(word) for word in key.split(" "))


LATIN_NAME = re.compile(r"^[a-z][a-z0-9 ]{1,48}[a-z0-9]$")


# ---- configuration -------------------------------------------------------------

def source_files() -> list:
    raw = os.environ.get("WORKER_GEONAMES")
    if raw is None:
        return [Path(DEFAULT_FILE)] if Path(DEFAULT_FILE).exists() else []
    return [Path(part.strip()) for part in raw.split(",") if part.strip()]


def index_path(files=None) -> Path | None:
    raw = os.environ.get("WORKER_GEONAMES_DB", "").strip()
    if raw:
        return Path(raw)
    files = files if files is not None else source_files()
    if not files:
        return None
    beside = files[0].with_suffix(".sqlite")
    if os.access(beside.parent, os.W_OK) or beside.exists():
        return beside
    return Path(os.environ.get("WORKER_JOBS_DIR", "/data/jobs")) / ".geonames.sqlite"


def enabled() -> bool:
    return bool(source_files())


# ---- the index -----------------------------------------------------------------

def _rows(path: Path):
    """The lines of a dump, from a .txt or the .txt inside a .zip."""
    if path.suffix.lower() == ".zip":
        with zipfile.ZipFile(path) as archive:
            names = [name for name in archive.namelist() if name.endswith(".txt") and not name.lower().startswith("readme")]
            for name in names:
                with archive.open(name) as handle:
                    for raw in handle:
                        yield raw.decode("utf-8", "replace")
        return
    with open(path, encoding="utf-8", errors="replace") as handle:
        yield from handle


def _signature(files) -> str:
    parts = [INDEX_VERSION]
    for path in files:
        stat = path.stat()
        parts.append(f"{path.resolve()}:{stat.st_size}:{int(stat.st_mtime)}")
    return "|".join(parts)


def build_index(files=None, db_path=None, log=print) -> Path:
    """(Re)builds the SQLite index of the dump files."""
    files = files if files is not None else source_files()
    db_path = Path(db_path) if db_path else index_path(files)
    if not files or db_path is None:
        raise RuntimeError("No GeoNames files configured (WORKER_GEONAMES).")
    tmp = db_path.with_name(db_path.name + ".building")
    tmp.unlink(missing_ok=True)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(tmp)
    connection.executescript("""
        PRAGMA journal_mode = OFF;
        PRAGMA synchronous = OFF;
        CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
        CREATE TABLE places (id INTEGER PRIMARY KEY, name TEXT, country TEXT, latitude REAL, longitude REAL,
                             population INTEGER, feature TEXT, timezone TEXT);
        CREATE TABLE names (key TEXT, exact INTEGER, place INTEGER);
    """)
    places = 0
    batch_places, batch_names = [], []

    def flush():
        connection.executemany("INSERT OR IGNORE INTO places VALUES (?, ?, ?, ?, ?, ?, ?, ?)", batch_places)
        connection.executemany("INSERT INTO names VALUES (?, ?, ?)", batch_names)
        batch_places.clear()
        batch_names.clear()

    for path in files:
        for line in _rows(path):
            fields = line.rstrip("\n").split("\t")
            if len(fields) < 18:
                continue
            try:
                place_id = int(fields[0])
                latitude, longitude = float(fields[4]), float(fields[5])
                population = int(fields[14] or 0)
            except ValueError:
                continue
            # Populated places, administrative areas, and spots (castles,
            # monasteries, archaeological sites) of a fuller dump.
            if fields[6] not in ("P", "A", "S"):
                continue
            batch_places.append((place_id, fields[1], fields[8], latitude, longitude, population, f"{fields[6]}.{fields[7]}", fields[17]))
            keys = set()
            for name in [fields[1], fields[2], *fields[3].split(",")[:MAX_ALTERNATES]]:
                key = normalize(name)
                if LATIN_NAME.match(key) and not key.isdigit():
                    keys.add(key)
            for key in keys:
                batch_names.append((key, 1, place_id))
                stemmed = stem_key(key)
                if stemmed != key:
                    batch_names.append((stemmed, 0, place_id))
            places += 1
            if len(batch_places) >= 20000:
                flush()
    flush()
    connection.execute("CREATE INDEX names_key ON names (key)")
    connection.execute("INSERT INTO meta VALUES ('signature', ?)", (_signature(files),))
    connection.commit()
    connection.close()
    os.replace(tmp, db_path)
    if log:
        log(f"[geonames] {places} places indexed into {db_path}")
    return db_path


class GeoIndex:
    """The index of the configured dump, built in the background when it is
    missing or older than the files."""

    def __init__(self):
        self.lock = threading.Lock()
        self.state = "off"
        self.error = None
        self.local = threading.local()
        self.db_path = None
        self.thread = None

    def start(self) -> None:
        files = source_files()
        if not files:
            self.state = "off"
            return
        self.db_path = index_path(files)
        try:
            current = self._signature_of(self.db_path) == _signature(files)
        except OSError as exc:
            self.state, self.error = "error", str(exc)
            print(f"[geonames] {exc}", file=sys.stderr)
            return
        if current:
            self.state = "ready"
            return
        self.state = "building"
        self.thread = threading.Thread(target=self._build, args=(files,), daemon=True)
        self.thread.start()

    def _build(self, files) -> None:
        try:
            build_index(files, self.db_path)
            self.state = "ready"
        except Exception as exc:  # noqa: BLE001 - logged, the feature reports itself off
            self.state, self.error = "error", str(exc)
            print(f"[geonames] building the index failed: {exc}", file=sys.stderr)

    @staticmethod
    def _signature_of(db_path) -> str | None:
        if not db_path or not Path(db_path).exists():
            return None
        try:
            connection = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
            try:
                row = connection.execute("SELECT value FROM meta WHERE key = 'signature'").fetchone()
            finally:
                connection.close()
        except sqlite3.Error:
            return None
        return row[0] if row else None

    def connection(self) -> sqlite3.Connection:
        connection = getattr(self.local, "connection", None)
        if connection is None:
            connection = sqlite3.connect(f"file:{self.db_path}?mode=ro", uri=True, check_same_thread=False)
            self.local.connection = connection
        return connection

    def find(self, text: str) -> list:
        return find_places(text, self.connection())


INDEX = GeoIndex()


# ---- finding places in a text ----------------------------------------------------

WORD = re.compile(r"[^\W\d_]+(?:['’][^\W\d_]+)*")


def _tokens(text: str) -> list:
    """Words with their normalized form, whether capitalised, whether they
    open a sentence, and the word before."""
    tokens = []
    for match in WORD.finditer(text):
        original = match.group(0)
        before = text[: match.start()].rstrip()
        sentence_start = not before or before[-1] in ".!?:;\n\"„“(" or text[max(0, match.start() - 2): match.start()].count("\n") > 0
        norm = normalize(original)
        if not norm:
            continue
        tokens.append({
            "original": original,
            "norm": norm.replace(" ", ""),
            "capital": original[0].isupper(),
            "sentence_start": sentence_start,
            "gap": before[-1:] in (",", ";", ":", ".", "(", ")") if before else True,
        })
    return tokens


def _countries(normalized_text: str) -> set:
    found = set()
    for code, names in COUNTRIES.items():
        for name in names:
            if re.search(rf"(^|[^a-z]){re.escape(name)}([^a-z]|$)", normalized_text):
                found.add(code)
                break
    return found


def _candidates(tokens: list) -> list:
    """Spans of capitalised words (with lower-case connectors inside)."""
    spans = []
    for start, token in enumerate(tokens):
        if not token["capital"]:
            continue
        for size in range(1, MAX_WORDS + 1):
            end = start + size
            if end > len(tokens):
                break
            words = tokens[start:end]
            last = words[-1]
            # A comma or a full stop between ends the name.
            if any(word["gap"] for word in words[1:]):
                break
            if not last["capital"]:
                if last["norm"] in CONNECTORS:
                    continue
                break
            key = " ".join(word["norm"] for word in words)
            previous = tokens[start - 1]["norm"] if start > 0 and not token["gap"] else ""
            spans.append({
                "key": key,
                "stem": stem_key(key),
                "words": size,
                "matched": " ".join(word["original"] for word in words),
                "after_preposition": previous in PREPOSITIONS,
                "sentence_start": token["sentence_start"],
            })
    return spans


def find_places(text: str, connection: sqlite3.Connection, limit: int = 3) -> list:
    text = str(text or "")[:MAX_TEXT]
    tokens = _tokens(text)
    spans = _candidates(tokens)
    if not spans:
        return []
    countries = _countries(normalize(text))
    keys = sorted({span["key"] for span in spans} | {span["stem"] for span in spans})
    hits = {}
    for offset in range(0, len(keys), 500):
        chunk = keys[offset: offset + 500]
        marks = ",".join("?" * len(chunk))
        for key, exact, place in connection.execute(f"SELECT key, exact, place FROM names WHERE key IN ({marks})", chunk):
            hits.setdefault(key, []).append((exact, place))
    place_ids = {place for entries in hits.values() for _, place in entries}
    if not place_ids:
        return []
    places = {}
    ids = sorted(place_ids)
    for offset in range(0, len(ids), 500):
        chunk = ids[offset: offset + 500]
        marks = ",".join("?" * len(chunk))
        for row in connection.execute(f"SELECT id, name, country, latitude, longitude, population, feature, timezone FROM places WHERE id IN ({marks})", chunk):
            places[row[0]] = {
                "id": row[0], "name": row[1], "country": row[2], "latitude": row[3], "longitude": row[4],
                "population": row[5], "feature": row[6], "timezone": row[7],
            }

    results = []
    for span in spans:
        # Quality: the name as written (1), or by its stem (0.8).
        quality = {}
        for exact, place in hits.get(span["key"], []):
            quality[place] = max(quality.get(place, 0), 1.0 if exact else 0.8)
        if span["stem"] != span["key"] or not quality:
            for _exact, place in hits.get(span["stem"], []):
                quality[place] = max(quality.get(place, 0), 0.8)
        if not quality:
            continue
        single = span["words"] == 1
        if single and not span["after_preposition"] and (span["key"] in STOPWORDS or len(span["key"]) <= 3):
            continue
        # A capital opening a sentence says little: a town at least.
        least = 2000 if not span["sentence_start"] else 5000
        scored = []
        for place_id, match_quality in quality.items():
            place = places.get(place_id)
            if not place:
                continue
            population = max(place["population"] or 0, 0)
            # Hamlets of a common word are no evidence on their own.
            if single and not span["after_preposition"] and population < least:
                continue
            score = (match_quality * 0.45
                     - (0.12 if single and span["sentence_start"] and not span["after_preposition"] else 0)
                     + (0.25 if span["after_preposition"] else 0)
                     + min(math.log10(population + 1) / 6.5, 1) * 0.2
                     + (0.15 if place["country"] in countries else 0)
                     + 0.05 * (span["words"] - 1))
            scored.append((score, population, place))
        if not scored:
            continue
        scored.sort(key=lambda item: (item[0], item[1]), reverse=True)
        best_score, _, best = scored[0]
        confidence = best_score
        # Places of this name elsewhere that score nearly as well.
        rival = next((item for item in scored[1:] if item[2]["country"] != best["country"]), None)
        if rival and rival[0] > best_score - 0.06:
            confidence *= 0.7
        results.append({
            "name": best["name"],
            "country": best["country"],
            "latitude": round(best["latitude"], 5),
            "longitude": round(best["longitude"], 5),
            "population": best["population"],
            "timezone": best["timezone"],
            "feature": best["feature"],
            "matched": span["matched"],
            "confidence": round(max(0.2, min(0.95, confidence)), 2),
            "_id": best["id"],
        })

    # The best of each place, most sure first.
    best_by_place = {}
    for result in results:
        current = best_by_place.get(result["_id"])
        if current is None or result["confidence"] > current["confidence"]:
            best_by_place[result["_id"]] = result
    ranked = sorted(best_by_place.values(), key=lambda item: (item["confidence"], item["population"] or 0), reverse=True)
    for result in ranked:
        result.pop("_id", None)
    return ranked[:limit]


def main(argv) -> int:
    if len(argv) >= 2 and argv[1] == "build":
        build_index()
        return 0
    if len(argv) >= 3 and argv[1] == "find":
        db_path = index_path()
        if db_path is None or not db_path.exists():
            print("No index: run `geonames.py build` first.", file=sys.stderr)
            return 1
        connection = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
        for place in find_places(" ".join(argv[2:]), connection):
            print(place)
        return 0
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
