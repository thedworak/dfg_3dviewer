"""Thumbnails rendered by the viewer for its bundled example models
(viewer/examples, the "Load example model" list): kept on the worker's
volume, as the examples are part of the viewer image and replaced on every
deployment. Admins render them in the viewer ("Generate thumbnails" on an
example, editor/thumbnail-capture.js); the viewer's gallery shows the copy
stored here before the bundled renders (ui/thumbnail-gallery.js).

A set is named as the bundled renders are (viewer/examples/gallery/<dir>/
<basename>_<view>.png): <dir> is the example's own folder under examples/
(tempietto: one model in every format, one set for all) or else its
filename, <basename> its file name without the extension.

<root>/<dir>/<basename>_<view>.png
"""

from __future__ import annotations

import re
from pathlib import Path

# A folder or file name of viewer/examples (no paths, no dot files).
NAME_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.() -]{0,127}")
# The views the viewer renders, the main thumbnail first (manifests.VIEWS).
VIEWS = ["side45", "side0", "side90", "side135", "side180", "side225", "side270", "side315", "top"]
IMAGE_RE = re.compile(r"(.+)_(side(?:0|45|90|135|180|225|270|315)|top)\.png")


def valid_name(name: str) -> bool:
    return isinstance(name, str) and bool(NAME_RE.fullmatch(name)) and ".." not in name \
        and not name.endswith((".", " "))


def image_path(root: Path, folder: str, basename: str, view: str):
    """Where a view is stored, or None for names that are not allowed."""
    if not (valid_name(folder) and valid_name(basename) and view in VIEWS):
        return None
    return root / folder / f"{basename}_{view}.png"


def save(root: Path, folder: str, basename: str, images: dict) -> dict:
    """Writes images ({view: PNG bytes}); answers the set as list_sets()
    lists it."""
    (root / folder).mkdir(parents=True, exist_ok=True)
    for view, data in images.items():
        target = image_path(root, folder, basename, view)
        temp = target.with_suffix(".png.tmp")
        temp.write_bytes(data)
        temp.replace(target)
    return list_sets(root).get(f"{folder}/{basename}", {})


def list_sets(root: Path) -> dict:
    """{"<dir>/<basename>": {"views": [...], "version": newest mtime}} of
    every stored set - the viewer asks once which examples have one."""
    sets: dict = {}
    if not root.is_dir():
        return sets
    for folder in sorted(root.iterdir()):
        if not folder.is_dir() or not valid_name(folder.name):
            continue
        for image in sorted(folder.glob("*.png")):
            match = IMAGE_RE.fullmatch(image.name)
            if not match or not valid_name(match.group(1)):
                continue
            entry = sets.setdefault(f"{folder.name}/{match.group(1)}", {"views": [], "version": 0})
            entry["views"].append(match.group(2))
            entry["version"] = max(entry["version"], int(image.stat().st_mtime))
    for entry in sets.values():
        entry["views"].sort(key=VIEWS.index)
    return sets


def delete(root: Path, folder: str, basename: str) -> int:
    """Removes a stored set (the bundled renders show again); answers how
    many images were removed."""
    removed = 0
    for view in VIEWS:
        target = image_path(root, folder, basename, view)
        if target is not None and target.is_file():
            target.unlink()
            removed += 1
    try:
        (root / folder).rmdir()
    except OSError:
        pass
    return removed
