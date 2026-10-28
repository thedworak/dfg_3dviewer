"""A model's descriptive metadata: name, type, author, copyright, licence,
date... - entered in the viewer's form when the model is added to the
repository and edited later by its owner (POST /api/jobs/<id>/metadata).

Kept in the job's folder as metadata.json, next to owner.json - outside
input/, so it is not served under /files/; GET /api/jobs and
GET /api/jobs/<id>/metadata hand it out.

The viewer shows it in the model list and the metadata window; the
suggested scene (viewer/editor/scene-rules.js) reads it with the rest of
the model's texts, and the type and unit are there for the type, scale and
lighting heuristics.
"""

import json
import re
import time
from pathlib import Path

# What a model shows; the viewer's form offers the same (viewer/ui/model-metadata.js).
TYPES = ("building", "interior", "urban", "site", "object", "sculpture", "other")
# SPDX identifiers, plus "public-domain" and "all-rights-reserved".
LICENSES = (
    "CC-BY-4.0", "CC-BY-SA-4.0", "CC-BY-NC-4.0", "CC-BY-NC-SA-4.0", "CC-BY-ND-4.0", "CC-BY-NC-ND-4.0",
    "CC0-1.0", "public-domain", "all-rights-reserved",
)
# The size of one model unit (viewer/editor/model-units.js MODEL_UNITS).
UNITS = ("m", "cm", "mm", "in", "ft")

# Free text fields and their longest value.
TEXT_FIELDS = {
    "name": 200,
    "author": 200,
    "copyright": 300,
    "date": 100,
    "location": 200,
    "description": 4000,
}
CHOICE_FIELDS = {"type": TYPES, "license": LICENSES, "unit": UNITS}
REQUIRED = ("name", "type")
FIELDS = (*TEXT_FIELDS, *CHOICE_FIELDS)


class MetadataError(ValueError):
    pass


def _clean_text(value, limit: int, field: str) -> str:
    if value is None:
        return ""
    if not isinstance(value, str):
        raise MetadataError(f"{field} must be text")
    # One line, but the description keeps its line breaks.
    if field == "description":
        value = re.sub(r"[^\S\n]+", " ", value.replace("\r\n", "\n")).strip()
    else:
        value = re.sub(r"\s+", " ", value).strip()
    if len(value) > limit:
        raise MetadataError(f"{field} is longer than {limit} characters")
    return value


def validate(data) -> dict:
    """The stored form of what the viewer sent: every field, as text ("" when
    not given). Raises MetadataError naming the first wrong field."""
    if not isinstance(data, dict):
        raise MetadataError("metadata must be an object")
    clean = {}
    for field, limit in TEXT_FIELDS.items():
        clean[field] = _clean_text(data.get(field), limit, field)
    for field, choices in CHOICE_FIELDS.items():
        value = data.get(field)
        value = "" if value is None else value
        if not isinstance(value, str) or (value and value not in choices):
            raise MetadataError(f"{field} must be one of: {', '.join(choices)}")
        clean[field] = value
    for field in REQUIRED:
        if not clean[field]:
            raise MetadataError(f"{field} is required")
    return clean


def path(job_dir: Path) -> Path:
    return job_dir / "metadata.json"


def read(job_dir: Path):
    """The stored metadata, or None (a model added without it)."""
    try:
        data = json.loads(path(job_dir).read_text("utf-8"))
    except (OSError, ValueError):
        return None
    return data if isinstance(data, dict) else None


def write(job_dir: Path, metadata: dict, username=None) -> dict:
    """Stores validated metadata with who changed it and when."""
    stored = {**metadata, "updatedAt": int(time.time()), "updatedBy": username}
    target = path(job_dir)
    partial = target.with_name("metadata.json.tmp")
    partial.write_text(json.dumps(stored, ensure_ascii=False), "utf-8")
    partial.replace(target)
    return stored
