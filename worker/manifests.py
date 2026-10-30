"""Thumbnails rendered by the viewer for the AIM3D manifests it ships
(viewer/manifesto/examples, served as manifests/<name>.json): the PNGs and
the manifest with its AIM3DViewer.thumbnails pointing at them, kept on the
worker's volume - the bundled manifests are part of the viewer image and
are replaced on every deployment. The viewer loads the stored copy instead
of the bundled one when there is one (main.js getManifestJson).

<root>/<name>/manifest.json, <root>/<name>/<name>_<view>.png
"""

from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path
from urllib.parse import urlparse

NAME_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,127}")
# The views the viewer renders ("Generate thumbnails", the same as
# scripts/render.py), the main thumbnail first.
VIEWS = ["side45", "side0", "side90", "side135", "side180", "side225", "side270", "side315", "top"]
TOP_LABEL = {"en": ["Top view"], "pl": ["Widok z góry"], "de": ["Draufsicht"]}


def valid_name(name: str) -> bool:
    return bool(NAME_RE.fullmatch(name)) and not name.endswith(".") and name != "index"


def manifest_path(root: Path, name: str) -> Path:
    return root / name / "manifest.json"


def image_path(root: Path, name: str, view: str) -> Path:
    return root / name / f"{name}_{view}.png"


def read_manifest(root: Path, name: str):
    """The stored manifest, or None."""
    try:
        return json.loads(manifest_path(root, name).read_text("utf-8"))
    except (OSError, ValueError):
        return None


def valid_base_url(base_url: str, name: str) -> bool:
    """Where the client reaches GET /api/manifests/<name>/... - the
    thumbnails' URLs in the manifest are absolute, as the viewer resolves
    them against its page, not the manifest."""
    parsed = urlparse(base_url)
    return parsed.scheme in ("http", "https") and bool(parsed.netloc) and \
        parsed.path.endswith(f"/api/manifests/{name}/") and not parsed.query and not parsed.fragment


def _view_of(entry, base_url: str, name: str):
    """The view of a thumbnail stored here (by its URL), else None."""
    src = entry if isinstance(entry, str) else entry.get("src") if isinstance(entry, dict) else None
    if not isinstance(src, str) or not src.startswith(base_url):
        return None
    match = re.fullmatch(rf"{re.escape(name)}_([a-z0-9]+)\.png", src[len(base_url):].split("?")[0])
    return match.group(1) if match and match.group(1) in VIEWS else None


def _entry(view: str, url: str):
    return {"src": url, "label": TOP_LABEL if view == "top" else f"{view[4:]}°"}


def save(root: Path, name: str, manifest: dict, base_url: str, images: dict) -> dict:
    """Writes images ({view: PNG bytes}) and the manifest with them in its
    AIM3DViewer.thumbnails, returned. All the views replace the gallery;
    fewer (the main thumbnail) replace their own entries, the rest stays."""
    folder = root / name
    folder.mkdir(parents=True, exist_ok=True)
    versions = {}
    for view, data in images.items():
        target = image_path(root, name, view)
        target.write_bytes(data)
        versions[view] = int(target.stat().st_mtime)

    viewer = manifest.get("AIM3DViewer")
    if not isinstance(viewer, dict):
        viewer = manifest["AIM3DViewer"] = {}
    existing = viewer.get("thumbnails") if isinstance(viewer.get("thumbnails"), list) else []
    ours, rest = {}, []
    for entry in existing:
        view = _view_of(entry, base_url, name)
        if view:
            ours[view] = entry
        else:
            rest.append(entry)
    for view, version in versions.items():
        ours[view] = _entry(view, f"{base_url}{name}_{view}.png?v={version}")
    if set(versions) == set(VIEWS):
        rest = []
    viewer["thumbnails"] = [ours[view] for view in VIEWS if view in ours] + rest
    if "modified" in manifest:
        manifest["modified"] = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())

    target = manifest_path(root, name)
    temp = target.with_suffix(".json.tmp")
    temp.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), "utf-8")
    os.replace(temp, target)
    return manifest
