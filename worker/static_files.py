"""Serving of converted output (GET/HEAD /files/<id>/<path>, see server.py).

  - HTTP range requests (one range: "bytes=a-b", "bytes=a-", "bytes=-n"):
    Potree 2 clouds are read node by node from one octree.bin, and large
    files can be resumed. 206 with Content-Range, 416 when out of bounds.
  - Files are sent in 1 MB pieces, never read into memory whole.
  - ETag (size + mtime) and Last-Modified, for 304 revalidation.
  - gzip for compressible files (JSON, 3D Tiles content, LAS, OBJ ...) when
    the client accepts it and asks for the whole file: compressed once, in
    the background, into a "<file>.gz" next to it; until that exists the
    file goes out as it is, so nobody waits for the compression. Files that
    compress badly (under 10 % saved) get an empty "<file>.nogz" marker
    instead and are not tried again.

Configuration (environment):
  WORKER_GZIP_MAX_BYTES  largest file compressed (default 268435456, 256 MB;
                         0 turns compression off)
"""

import gzip
import os
import re
import shutil
import threading
from pathlib import Path

CHUNK_BYTES = 1024 * 1024
GZIP_MIN_BYTES = 1024
GZIP_MAX_BYTES = int(os.environ.get("WORKER_GZIP_MAX_BYTES", str(256 * 1024 * 1024)))
GZIP_MIN_SAVING = 0.10

# Formats that are not compressed already: text, uncompressed geometry and
# point records. (GLB from gltfpack, KTX2, PNG, LAZ and Potree's octree.bin -
# read by range - are left alone.)
COMPRESSIBLE_SUFFIXES = {
    ".json", ".gltf", ".obj", ".mtl", ".ply", ".stl", ".xyz", ".pcd", ".las",
    ".pnts", ".b3dm", ".i3dm", ".cmpt", ".svg", ".txt", ".csv", ".ifc", ".dae",
    ".wrl", ".x3d", ".usda", ".hrc",
}
COMPRESSIBLE_NAMES = {"hierarchy.bin"}

_compressing = set()
_compressing_lock = threading.Lock()


def etag_for(path: Path) -> str:
    stat = path.stat()
    return f'"{stat.st_size:x}-{stat.st_mtime_ns:x}"'


def parse_range(header: str, size: int):
    """(start, end) inclusive for a single byte range, None to send the whole
    file (no header, several ranges or a unit other than bytes), or
    "unsatisfiable"."""
    if not header:
        return None
    match = re.fullmatch(r"\s*bytes\s*=\s*(\d*)\s*-\s*(\d*)\s*", header)
    if not match:
        return None
    first, last = match.groups()
    if first == "" and last == "":
        return None
    if first == "":
        # The last n bytes.
        length = int(last)
        if length == 0:
            return "unsatisfiable"
        return (max(0, size - length), size - 1) if size else "unsatisfiable"
    start = int(first)
    end = int(last) if last else size - 1
    if start >= size or end < start:
        return "unsatisfiable"
    return start, min(end, size - 1)


def is_compressible(path: Path) -> bool:
    return path.suffix.lower() in COMPRESSIBLE_SUFFIXES or path.name in COMPRESSIBLE_NAMES


def accepts_gzip(header: str) -> bool:
    for part in (header or "").split(","):
        name, _, params = part.strip().partition(";")
        if name.strip().lower() in ("gzip", "*"):
            return not re.search(r"q\s*=\s*0(\.0*)?\s*$", params.strip())
    return False


def _compress(source: Path) -> None:
    target = source.with_name(source.name + ".gz")
    partial = source.with_name(source.name + ".gz.tmp")
    try:
        with open(source, "rb") as raw, gzip.open(partial, "wb", compresslevel=6) as packed:
            shutil.copyfileobj(raw, packed, CHUNK_BYTES)
        if partial.stat().st_size > source.stat().st_size * (1 - GZIP_MIN_SAVING):
            partial.unlink(missing_ok=True)
            source.with_name(source.name + ".nogz").touch()
        else:
            partial.replace(target)
    except OSError:
        partial.unlink(missing_ok=True)
    finally:
        with _compressing_lock:
            _compressing.discard(str(source))


def gzip_variant(path: Path):
    """The ready gzip copy of path, or None - in which case one is started in
    the background when worth it."""
    if GZIP_MAX_BYTES <= 0 or not is_compressible(path):
        return None
    size = path.stat().st_size
    if size < GZIP_MIN_BYTES or size > GZIP_MAX_BYTES:
        return None
    packed = path.with_name(path.name + ".gz")
    if packed.is_file() and packed.stat().st_mtime >= path.stat().st_mtime:
        return packed
    if path.with_name(path.name + ".nogz").exists():
        return None
    with _compressing_lock:
        if str(path) in _compressing:
            return None
        _compressing.add(str(path))
    threading.Thread(target=_compress, args=(path,), daemon=True).start()
    return None


def is_derived_file(path: Path) -> bool:
    """The compression's own files, never served by their own URL."""
    return path.name.endswith((".gz.tmp", ".nogz")) or (
        path.suffix == ".gz" and path.with_suffix("").is_file()
    )


def send_file(handler, path: Path, content_type: str, headers: dict, head: bool = False) -> None:
    """Answers handler's request with path: a range, gzip, 304, or the whole
    file. headers: extra response headers (caching, CORS)."""
    size = path.stat().st_size
    etag = etag_for(path)
    compressible = is_compressible(path)
    base = {
        **headers,
        "ETag": etag,
        "Accept-Ranges": "bytes",
        "Access-Control-Expose-Headers": "Content-Length, Content-Range, Content-Encoding, ETag, Accept-Ranges",
    }
    if compressible:
        base["Vary"] = "Accept-Encoding"

    def start(status, extra):
        handler.send_response(status)
        for name, value in {**base, **extra}.items():
            handler.send_header(name, value)
        handler.end_headers()

    # If-None-Match wins over If-Modified-Since (RFC 9110); gzip copies carry
    # the same ETag with a suffix.
    if_none_match = handler.headers.get("If-None-Match")
    if if_none_match:
        tags = {tag.strip() for tag in if_none_match.split(",")}
        if "*" in tags or etag in tags or etag[:-1] + '-gz"' in tags:
            start(304, {})
            return
    elif handler.headers.get("If-Modified-Since") == headers.get("Last-Modified"):
        start(304, {})
        return

    byte_range = parse_range(handler.headers.get("Range", ""), size)
    if byte_range == "unsatisfiable":
        start(416, {"Content-Range": f"bytes */{size}", "Content-Length": "0"})
        return

    if byte_range is None and accepts_gzip(handler.headers.get("Accept-Encoding", "")):
        packed = gzip_variant(path)
        if packed is not None:
            packed_size = packed.stat().st_size
            start(200, {
                "Content-Type": content_type,
                "Content-Encoding": "gzip",
                "Content-Length": str(packed_size),
                "ETag": etag[:-1] + '-gz"',
            })
            if not head:
                _copy(handler, packed, 0, packed_size)
            return

    if byte_range is None:
        start(200, {"Content-Type": content_type, "Content-Length": str(size)})
        if not head:
            _copy(handler, path, 0, size)
        return

    first, last = byte_range
    length = last - first + 1
    start(206, {
        "Content-Type": content_type,
        "Content-Length": str(length),
        "Content-Range": f"bytes {first}-{last}/{size}",
    })
    if not head:
        _copy(handler, path, first, length)


def _copy(handler, path: Path, offset: int, length: int) -> None:
    try:
        with open(path, "rb") as source:
            source.seek(offset)
            remaining = length
            while remaining > 0:
                chunk = source.read(min(CHUNK_BYTES, remaining))
                if not chunk:
                    break
                handler.wfile.write(chunk)
                remaining -= len(chunk)
    except (BrokenPipeError, ConnectionResetError):
        # The client went away (e.g. the viewer cancelled a tile).
        pass
