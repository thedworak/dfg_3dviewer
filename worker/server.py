#!/usr/bin/env python3
"""Standalone conversion worker for the DFG 3D Viewer pipeline.

Wraps scripts/convert.sh and scripts/render.sh (unchanged) behind a small
HTTP API so the model->glTF conversion + thumbnail rendering pipeline can run
without a Drupal install. The response shape intentionally mirrors the
existing Drupal endpoints (src/Controller/ModelController.php) so a client
could talk to either backend interchangeably:

  POST /api/model/create        multipart file upload -> {entity_id, status}
  GET  /api/model/status/<id>   -> {progress, status, message, ...}
  GET  /api/jobs                -> {jobs: [...]} previously converted models
  DELETE /api/jobs/<id>         delete a job's input/converted/render files
  GET  /api/auth/config         -> {mode, registration}   (optional accounts,
  GET  /api/auth/me                 POST /api/auth/register|login|logout -
  POST /api/auth/...                see worker/auth.py and worker/README.md)
  GET  /files/<id>/<path>       static access to converted output
  GET  /healthz                 liveness check

Accepted uploads (see the *_FORMATS sets below): Blender importers via
scripts/convert.sh (abc dae fbx obj ply stl wrl x3d usd usda usdc usdz ifc blend
gml glb), STEP/IGES/3MF via scripts/convert_mesh.py (step stp iges igs 3mf), and
formats the viewer reads itself, stored as uploaded without thumbnails (gltf 3ds
pcd xyz amf kmz vox lwo), plus .zip/.rar/.tar/.xz/.gz archives of any of these.

This process is single-node and keeps in-flight job state (progress/status
messages) in memory only, so that is lost on restart - it is meant for
"download it and run it" use, not as a high-throughput production queue.
Finished jobs are still discoverable afterwards via GET /api/jobs, which
reconstructs their result from JOBS_DIR (a persistent volume in
docker-compose.yml) rather than from the in-memory JOBS dict.
"""

import json
import mimetypes
import os
import re
import shutil
import subprocess
import sys
import threading
import time
import uuid
import zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

import mailer
import optimize
import pointcloud
from auth import AuthError, AuthStore
from limits import LIMIT_KEYS, LimitError, Limits, default_limits, normalize_overrides

APP_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = Path(os.environ.get("WORKER_SCRIPTS_DIR", str(APP_DIR / "scripts")))
CONVERT_SCRIPT = SCRIPTS_DIR / "convert.sh"
RENDER_SCRIPT = SCRIPTS_DIR / "render.sh"
UNCOMPRESS_SCRIPT = SCRIPTS_DIR / "uncompress.sh"
JOBS_DIR = Path(os.environ.get("WORKER_JOBS_DIR", "/data/jobs"))
PORT = int(os.environ.get("WORKER_PORT", "8080"))
SKIP_RENDER = os.environ.get("WORKER_SKIP_RENDER", "false").lower() == "true"
# CPU, GPU, or AUTO - see scripts/render.py's try_enable_gpu(). GPU/AUTO need
# a GPU actually passed through to the container (e.g. Docker Compose's
# `deploy.resources.reservations.devices`, and nvidia-container-toolkit on
# the host) - see docker-compose.yml and worker/README.md.
RENDER_DEVICE = os.environ.get("WORKER_RENDER_DEVICE", "CPU").upper()
MAX_UPLOAD_BYTES = int(os.environ.get("WORKER_MAX_UPLOAD_BYTES", str(100 * 1024 * 1024)))
# A "Render preview" PNG (1024x1024) - far below this.
MAX_THUMBNAIL_BYTES = 20 * 1024 * 1024
# Optional accounts (off by default) - see worker/auth.py. Stored on the same
# persistent volume as the jobs, in a dot-directory the job listing skips.
AUTH = AuthStore(
    JOBS_DIR / ".auth",
    mode=os.environ.get("WORKER_AUTH_MODE", "off").lower(),
    registration=os.environ.get("WORKER_AUTH_REGISTRATION", "approval").lower(),
    secret=os.environ.get("WORKER_AUTH_SECRET", ""),
)
# Upload limits (see worker/limits.py for the per-account WORKER_LIMIT_*
# defaults). Conversions beyond this many at once wait in the "queued" status.
MAX_CONCURRENT_CONVERSIONS = int(os.environ.get("WORKER_MAX_CONCURRENT_CONVERSIONS", "2"))
# How many reverse proxies in front of the worker append to X-Forwarded-For;
# the client IP used for per-IP limits (accounts off) is the entry that many
# places from the right. 0 ignores the header (worker reached directly).
TRUSTED_PROXIES = int(os.environ.get("WORKER_TRUSTED_PROXIES", "1"))
CONVERT_TIMEOUT = int(os.environ.get("WORKER_CONVERT_TIMEOUT", "1800"))
RENDER_TIMEOUT = int(os.environ.get("WORKER_RENDER_TIMEOUT", "900"))

CONVERT_MESH_SCRIPT = SCRIPTS_DIR / "convert_mesh.py"

# Extensions scripts/convert.sh actually has a case-branch for (Blender
# importers; the usd* ones need a Blender build with USD support - the
# official release this image installs has it).
DIRECT_FORMATS = {"abc", "dae", "fbx", "obj", "ply", "stl", "wrl", "x3d", "usd", "usda", "usdc", "usdz"}
SPECIAL_FORMATS = {"ifc", "blend", "gml"}
PASSTHROUGH_FORMATS = {"glb"}
# Converted to GLB by scripts/convert_mesh.py (OpenCASCADE / trimesh), not
# Blender.
MESH_CONVERT_FORMATS = {"step", "stp", "iges", "igs", "3mf"}
# Formats the viewer loads directly (three.js loaders): kept as uploaded and
# served as-is. No GLB is produced and, since thumbnails are rendered from a
# GLB by Blender, no thumbnails either. ("gltf" is only useful inside a .zip
# together with its .bin/textures, which stay next to it in the job folder.)
VIEWER_NATIVE_FORMATS = {"gltf", "3ds", "pcd", "xyz", "amf", "kmz", "vox", "lwo"}
# Point clouds become a streamed 3D Tiles tileset (worker/pointcloud.py);
# a .ply without faces joins them at run time (is_point_cloud()).
POINTCLOUD_FORMATS = pointcloud.POINTCLOUD_FORMATS
SUPPORTED_FORMATS = (
    DIRECT_FORMATS | SPECIAL_FORMATS | PASSTHROUGH_FORMATS | MESH_CONVERT_FORMATS | VIEWER_NATIVE_FORMATS
    | POINTCLOUD_FORMATS
)
# Mirrors ModelFormatManager::getZipFormats() on the Drupal side. "zip" is
# extracted in-process (safe_extract_zip); the rest shell out to the same
# scripts/uncompress.sh the Drupal module itself uses locally, so behavior
# (including its "unrar/7z/tar" dependency requirements) stays identical
# between the docker and non-docker paths - just moved into this container.
ARCHIVE_FORMATS = {"zip", "rar", "tar", "gz", "xz"}

JOBS = {}
JOBS_LOCK = threading.Lock()


def new_job(owner_key: str = "") -> str:
    job_id = uuid.uuid4().hex
    with JOBS_LOCK:
        JOBS[job_id] = {
            "owner_key": owner_key,
            "status": "init",
            "progress": 0,
            "message": "",
            "model_url": None,
            "image_urls": [],
        }
    return job_id


def set_job(job_id: str, **fields) -> None:
    with JOBS_LOCK:
        if job_id in JOBS:
            JOBS[job_id].update(fields)


def active_jobs_for(owner_key: str) -> int:
    """Jobs of this uploader (limits.Limits.key_for) still queued or running."""
    with JOBS_LOCK:
        return sum(
            1 for job in JOBS.values()
            if job.get("owner_key") == owner_key and job.get("status") in ACTIVE_STATUSES
        )


def get_job(job_id: str):
    with JOBS_LOCK:
        return dict(JOBS[job_id]) if job_id in JOBS else None


def safe_extract_zip(zip_path: Path, dest: Path) -> None:
    dest.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path) as zf:
        for name in zf.namelist():
            normalized = name.replace("\\", "/")
            if normalized.startswith("/") or ".." in normalized.split("/"):
                raise ValueError(f"Unsafe path entry in archive: {name}")
        zf.extractall(dest)


def extract_archive(archive_path: Path, dest: Path, archive_type: str) -> None:
    """Extracts archive_path (of archive_type, one of ARCHIVE_FORMATS) into
    dest. "zip" is handled in-process; everything else shells out to
    scripts/uncompress.sh (already present in this image - see
    worker/Dockerfile), the same script ConvertProcessService::uncompress()
    calls on the Drupal side for the non-docker backend."""
    if archive_type == "zip":
        safe_extract_zip(archive_path, dest)
        return

    if not UNCOMPRESS_SCRIPT.is_file():
        raise RuntimeError(f"uncompress.sh not found at {UNCOMPRESS_SCRIPT}")

    dest.mkdir(parents=True, exist_ok=True)
    # uncompress.sh's legacy auto-convert loop globs "$OUTPUT"* and expects a
    # trailing slash on -o to treat it as a directory prefix, not a filename
    # prefix - see scripts/uncompress.sh.
    output_arg = str(dest) + "/"
    result = subprocess.run(
        [str(UNCOMPRESS_SCRIPT), "-t", archive_type, "-i", str(archive_path), "-o", output_arg, "-n", archive_path.stem, "-f", "true"],
        capture_output=True, text=True, timeout=CONVERT_TIMEOUT,
    )
    if result.returncode != 0:
        detail = result.stderr.strip() or result.stdout.strip()
        raise RuntimeError(f"uncompress.sh failed (exit={result.returncode}): {detail}")


def find_model_file(root: Path):
    for path in sorted(root.rglob("*")):
        if path.is_file() and path.suffix.lower().lstrip(".") in SUPPORTED_FORMATS:
            return path
    return None


JOB_ID_RE = re.compile(r"[A-Za-z0-9_-]+")
LIMITS = Limits(JOBS_DIR, JOB_ID_RE, MAX_CONCURRENT_CONVERSIONS)
ACTIVE_STATUSES = {"init", "queued", "preparing", "processing", "rendering"}


def scan_job(job_id: str, job_dir: Path):
    """Reconstruct a finished job's result straight from JOBS_DIR, the same
    way run_pipeline() would have reported it - used to make jobs from
    before a worker restart show up in GET /api/jobs, since JOBS (the
    in-memory progress registry) does not survive one but the files on the
    persistent volume do."""
    job_root = job_dir / "input"
    if not job_root.is_dir():
        return None

    # Previews (optimize.py) and gltfpack's temporary output are never the model.
    glb_candidates = sorted(
        p for p in job_root.rglob("*.glb")
        if not p.name.endswith((".preview.glb", ".tmp.glb"))
    )
    if glb_candidates:
        # A file under a "gltf" folder is convert.sh's own output and is
        # preferred; otherwise fall back to whatever .glb is there (e.g. a
        # passthrough upload that skipped conversion entirely).
        glb_path = next(
            (p for p in glb_candidates if "gltf" in p.relative_to(job_root).parts),
            glb_candidates[0],
        )
    elif (tilesets := sorted(job_root.glob("tiles/*/tileset.json"))):
        # A point cloud converted to 3D Tiles (worker/pointcloud.py).
        glb_path = tilesets[0]
    else:
        # Viewer-native formats are served as uploaded (no GLB exists).
        native = [
            p for p in sorted(job_root.rglob("*"))
            if p.is_file() and p.suffix.lower().lstrip(".") in VIEWER_NATIVE_FORMATS
        ]
        if not native:
            return None
        glb_path = native[0]

    image_urls = []
    views_dirs = sorted(job_root.rglob("views"))
    if views_dirs:
        image_urls = [
            f"/files/{job_id}/{img.relative_to(job_root)}"
            for img in sorted(views_dirs[0].glob("*.png"))
        ]

    original_name = next(
        (p.name for p in sorted(job_root.iterdir()) if p.is_file()), None
    )

    return {
        "id": job_id,
        "name": original_name or job_id,
        "status": "ready",
        "modelUrl": f"/files/{job_id}/{glb_path.relative_to(job_root)}",
        "imageUrls": image_urls,
        "createdAt": int(glb_path.stat().st_mtime),
    }


def read_owner(job_id: str):
    try:
        return json.loads((JOBS_DIR / job_id / "owner.json").read_text("utf-8"))
    except (OSError, ValueError):
        return None


def write_owner(job_id: str, username, filename: str, size: int) -> None:
    (JOBS_DIR / job_id / "owner.json").write_text(json.dumps({
        "user": username,
        "filename": filename,
        "size": size,
        "createdAt": int(time.time()),
    }), "utf-8")


def can_delete_job(job_id: str, user) -> bool:
    """Open worker: anyone. With accounts: admins, or the account that
    uploaded it (jobs from before accounts were enabled: admins only)."""
    if not AUTH.enabled:
        return True
    if not user:
        return False
    if user["role"] == "admin":
        return True
    owner = read_owner(job_id)
    return bool(owner and owner.get("user") == user["username"])


def list_jobs(user=None):
    jobs = []
    if not JOBS_DIR.is_dir():
        return jobs
    for job_dir in JOBS_DIR.iterdir():
        if not job_dir.is_dir() or not JOB_ID_RE.fullmatch(job_dir.name):
            continue
        try:
            job = scan_job(job_dir.name, job_dir)
        except OSError:
            continue
        if job is not None:
            job["canDelete"] = can_delete_job(job["id"], user)
            # Shown as "Uploaded by {owner}" in the browse-models panel, to
            # anyone - including anonymous visitors, same as the rest of
            # GET /api/jobs. Jobs uploaded anonymously (accounts off, or
            # from before accounts were enabled) have no owner and the
            # field comes back null.
            owner = read_owner(job["id"])
            job["owner"] = owner.get("user") if owner else None
            jobs.append(job)
    jobs.sort(key=lambda job: job["createdAt"], reverse=True)
    return jobs


def optimize_converted_glb(job_id: str, glb_path: Path, work_path: Path) -> Path:
    """Runs optimize.py on the converted GLB; returns the path to serve.
    Best effort: on failure the unoptimized GLB is served as before."""
    set_job(job_id, status="processing", progress=60, message="Optimizing model...")
    target = work_path.parent / "gltf" / (work_path.stem + ".glb")
    try:
        result = optimize.optimize_glb(glb_path, target, log_prefix=f"[job {job_id}]")
    except (RuntimeError, subprocess.TimeoutExpired, OSError) as exc:
        print(f"[job {job_id}] optimization skipped: {exc}", file=sys.stderr)
        return glb_path
    print(
        f"[job {job_id}] optimized {glb_path.stat().st_size if glb_path.is_file() else '?'} -> "
        f"{result['model'].stat().st_size} bytes, preview={result['preview']}",
        file=sys.stderr,
    )
    return result["model"]


def convert_and_render(job_id: str, work_path: Path, ext: str, is_archive: bool, job_root: Path):
    """Converts work_path to GLB (unless it already is one) and renders its
    thumbnails. Returns (glb_path, image_urls). Runs inside a conversion
    slot - see limits.Limits.conversion_slot()."""
    # gltfpack (optimize.py) re-compresses the GLB with Meshopt and cannot
    # read Draco, so Blender skips its own Draco step when it will run.
    optimizing = optimize.enabled()
    if ext in PASSTHROUGH_FORMATS:
        glb_path = work_path
    elif ext in MESH_CONVERT_FORMATS:
        set_job(job_id, status="processing", progress=25, message="Converting model...")
        glb_path = work_path.parent / "gltf" / (work_path.stem + ".glb")
        # Print before running, not just after: some formats (notably .ifc,
        # handled below) can sit inside this call for a long time with no
        # other output, so without this line a slow-but-healthy conversion
        # looks identical to a hung one in `docker logs`.
        print(f"[job {job_id}] running convert_mesh.py on {work_path}...", file=sys.stderr)
        result = subprocess.run(
            [sys.executable, str(CONVERT_MESH_SCRIPT), "-i", str(work_path), "-o", str(glb_path)],
            capture_output=True, text=True, timeout=CONVERT_TIMEOUT,
        )
        # Always print, not just on a non-zero exit - see the render.sh
        # logging below for why a 0 exit code alone isn't enough signal.
        print(
            f"[job {job_id}] convert_mesh.py exit={result.returncode}:\n"
            f"--- stdout ---\n{result.stdout}\n--- stderr ---\n{result.stderr}",
            file=sys.stderr,
        )
        if result.returncode != 0:
            detail = result.stderr.strip() or result.stdout.strip()
            raise RuntimeError(f"convert_mesh.py failed (exit={result.returncode}): {detail}")
    else:
        set_job(job_id, status="processing", progress=25, message="Converting model...")
        print(f"[job {job_id}] running convert.sh on {work_path}...", file=sys.stderr)
        result = subprocess.run(
            [str(CONVERT_SCRIPT), "-i", str(work_path), "-c", "false" if optimizing else "true", "-l", "3", "-b", "true", "-f", "true"],
            capture_output=True, text=True, timeout=CONVERT_TIMEOUT,
        )
        print(
            f"[job {job_id}] convert.sh exit={result.returncode}:\n"
            f"--- stdout ---\n{result.stdout}\n--- stderr ---\n{result.stderr}",
            file=sys.stderr,
        )
        if result.returncode != 0:
            detail = result.stderr.strip() or result.stdout.strip()
            raise RuntimeError(f"convert.sh failed (exit={result.returncode}): {detail}")
        glb_path = work_path.parent / "gltf" / (work_path.stem + ".glb")

    if not glb_path.is_file():
        raise RuntimeError(f"Expected converted output missing: {glb_path}")

    if optimizing:
        glb_path = optimize_converted_glb(job_id, glb_path, work_path)

    if not SKIP_RENDER:
        set_job(job_id, status="rendering", progress=70, message="Rendering thumbnails...")
        render_result = subprocess.run(
            [str(RENDER_SCRIPT), "-i", str(work_path), "-a", "true" if is_archive else "false", "-d", RENDER_DEVICE],
            capture_output=True, text=True, timeout=RENDER_TIMEOUT,
        )
        # Always print render.sh's output (not just on a non-zero exit) -
        # a Python exception inside render.py can leave Blender's own
        # process exiting 0 while writing no output files, which a
        # returncode-only check would miss entirely.
        print(
            f"[job {job_id}] render.sh exit={render_result.returncode}:\n"
            f"--- stdout ---\n{render_result.stdout}\n--- stderr ---\n{render_result.stderr}",
            file=sys.stderr,
        )
        if render_result.returncode != 0:
            # Thumbnails are best-effort - a converted model without
            # preview images is still a usable result.
            set_job(job_id, message=f"Model converted; thumbnail rendering failed: {render_result.stderr.strip()[:300]}")

    views_dir = work_path.parent / "views"
    image_urls = []
    if views_dir.is_dir():
        for img in sorted(views_dir.glob(f"{work_path.stem}_*.png")):
            image_urls.append(f"/files/{job_id}/{img.relative_to(job_root)}")
    print(f"[job {job_id}] views_dir={views_dir} exists={views_dir.is_dir()} found={len(image_urls)} thumbnail(s)", file=sys.stderr)
    return glb_path, image_urls


def run_pipeline(job_id: str, input_path: Path, original_ext: str) -> None:
    job_root = input_path.parent
    try:
        set_job(job_id, status="preparing", progress=5, message="Preparing...")

        work_path = input_path
        is_archive = original_ext in ARCHIVE_FORMATS

        if is_archive:
            set_job(job_id, status="processing", progress=10, message="Extracting archive...")
            extract_dir = job_root / "extracted"
            extract_archive(input_path, extract_dir, original_ext)
            model_file = find_model_file(extract_dir)
            if model_file is None:
                raise RuntimeError("No supported 3D model found in archive.")
            work_path = model_file

        ext = work_path.suffix.lower().lstrip(".")
        if ext not in SUPPORTED_FORMATS:
            raise RuntimeError(f"Unsupported source format: .{ext}")

        if pointcloud.is_point_cloud(work_path):
            tiles_dir = job_root / "tiles" / work_path.stem
            with LIMITS.conversion_slot(
                on_wait=lambda: set_job(job_id, status="queued", message="Waiting for a free conversion slot..."),
            ):
                set_job(job_id, status="processing", progress=25, message="Building streamed point cloud tiles...")
                tileset = pointcloud.convert_to_tiles(
                    work_path, tiles_dir, job_root / "tiles" / (work_path.stem + ".work"),
                    log_prefix=f"[job {job_id}]",
                )
            set_job(
                job_id,
                status="ready",
                progress=100,
                message="Point cloud converted to 3D Tiles (no thumbnails)",
                model_url=f"/files/{job_id}/{tileset.relative_to(job_root)}",
                image_urls=[],
            )
            return

        if ext in VIEWER_NATIVE_FORMATS:
            # Nothing to convert or render: the viewer reads this format itself.
            set_job(
                job_id,
                status="ready",
                progress=100,
                message="Uploaded (viewer-native format, no conversion or thumbnails)",
                model_url=f"/files/{job_id}/{work_path.relative_to(job_root)}",
                image_urls=[],
            )
            return

        # Blender/OpenCASCADE are the expensive part: only
        # WORKER_MAX_CONCURRENT_CONVERSIONS of them run at once, the rest wait.
        with LIMITS.conversion_slot(
            on_wait=lambda: set_job(job_id, status="queued", message="Waiting for a free conversion slot..."),
        ):
            glb_path, image_urls = convert_and_render(job_id, work_path, ext, is_archive, job_root)

        set_job(
            job_id,
            status="ready",
            progress=100,
            message="Conversion finished",
            model_url=f"/files/{job_id}/{glb_path.relative_to(job_root)}",
            image_urls=image_urls,
        )
    except Exception as exc:  # noqa: BLE001 - reported back via job status
        print(f"[job {job_id}] pipeline failed: {exc}", file=sys.stderr)
        set_job(job_id, status="failed", progress=100, message=str(exc))


class UploadTooLarge(ValueError):
    pass


def _multipart_parts(handler: "Handler", max_bytes: int = MAX_UPLOAD_BYTES):
    """Yields (headers_text, content) for each part of a multipart body."""
    content_type = handler.headers.get("Content-Type", "")
    if "multipart/form-data" not in content_type:
        raise ValueError("Expected multipart/form-data")

    boundary = None
    for part in content_type.split(";"):
        part = part.strip()
        if part.startswith("boundary="):
            boundary = part[len("boundary="):].strip('"')
    if not boundary:
        raise ValueError("Missing multipart boundary")

    length = int(handler.headers.get("Content-Length", "0"))
    if length > max_bytes:
        raise UploadTooLarge(f"Upload exceeds the {max_bytes // (1024 * 1024)} MB limit")
    if length <= 0:
        raise ValueError("Empty upload")
    body = handler.rfile.read(length)

    boundary_bytes = ("--" + boundary).encode()
    for part in body.split(boundary_bytes):
        # Each segment is framed as exactly "\r\n" + headers + "\r\n\r\n" +
        # content + "\r\n" (that trailing CRLF belongs to the delimiter, not
        # the file). Strip precisely those 2-byte markers positionally -
        # never bytes.strip(b"\r\n"), which would eat real \r/\n bytes at the
        # edges of arbitrary binary content instead of just the framing.
        if part in (b"", b"--", b"--\r\n"):
            continue
        if part.startswith(b"\r\n"):
            part = part[2:]
        else:
            continue
        header_blob, sep, content = part.partition(b"\r\n\r\n")
        if not sep:
            continue
        if content.endswith(b"\r\n"):
            content = content[:-2]
        yield header_blob.decode("latin-1"), content


def parse_multipart_file(handler: "Handler"):
    for headers_text, content in _multipart_parts(handler):
        match = re.search(r'filename="([^"]*)"', headers_text)
        if not match or not match.group(1):
            continue
        return match.group(1), content

    raise ValueError("No file part found in upload")


def parse_multipart_form(handler: "Handler", max_bytes: int):
    """(fields, files) of a multipart form: text fields by name, and the
    file parts' content by name."""
    fields, files = {}, {}
    for headers_text, content in _multipart_parts(handler, max_bytes):
        name = re.search(r'\bname="([^"]*)"', headers_text)
        if not name:
            continue
        if re.search(r'filename="', headers_text):
            files[name.group(1)] = content
        else:
            fields[name.group(1)] = content.decode("utf-8", "replace")
    return fields, files


class Handler(BaseHTTPRequestHandler):
    server_version = "DFG3DWorker/0.1"

    def _send_json(self, status: int, payload: dict, cookie: str = None, headers: dict = None) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        for name, value in (headers or {}).items():
            self.send_header(name, value)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        if cookie:
            self.send_header("Set-Cookie", cookie)
        self.end_headers()
        self.wfile.write(body)

    def _current_user(self):
        return AUTH.user_from_cookie_header(self.headers.get("Cookie", ""))

    def _client_ip(self) -> str:
        forwarded = [part.strip() for part in self.headers.get("X-Forwarded-For", "").split(",") if part.strip()]
        if TRUSTED_PROXIES > 0 and len(forwarded) >= TRUSTED_PROXIES:
            return forwarded[-TRUSTED_PROXIES]
        return self.client_address[0]

    def _limit_context(self, user):
        """(key, username, effective limits) of the caller."""
        username = (user or {}).get("username")
        overrides = AUTH.get_limits(username) if username else {}
        return Limits.key_for(user, self._client_ip()), username, Limits.effective_limits(user, overrides)

    def _send_limit_error(self, exc: LimitError) -> None:
        headers = {"Retry-After": str(exc.retry_after)} if exc.retry_after else None
        self._send_json(exc.status, exc.payload(), headers=headers)

    def _require_user(self):
        """Returns the account allowed to change things, or None after
        sending a 401. With accounts off, everyone is allowed (returns {})."""
        if not AUTH.enabled:
            return {}
        user = self._current_user()
        if user is None:
            self._send_json(401, {"error": "Login required"})
        return user

    def _require_admin(self):
        """Returns the admin account calling this endpoint, or None after
        sending 404 (accounts off - nothing to administer), 401 (not logged
        in) or 403 (logged in but not an admin)."""
        if not AUTH.enabled:
            self._send_json(404, {"error": "Accounts are not enabled."})
            return None
        user = self._current_user()
        if user is None:
            self._send_json(401, {"error": "Login required"})
            return None
        if user["role"] != "admin":
            self._send_json(403, {"error": "Admin role required"})
            return None
        return user

    def _read_json_body(self) -> dict:
        length = int(self.headers.get("Content-Length", "0") or 0)
        if length <= 0 or length > 4096:
            raise AuthError(400, "Invalid request body")
        try:
            data = json.loads(self.rfile.read(length))
        except ValueError:
            raise AuthError(400, "Body must be JSON")
        if not isinstance(data, dict):
            raise AuthError(400, "Body must be a JSON object")
        return data

    def _cookie_is_secure(self) -> bool:
        return self.headers.get("X-Forwarded-Proto", "").lower() == "https"

    def _handle_auth(self, action: str) -> None:
        try:
            if action == "logout":
                self._send_json(200, {"status": "ok"}, cookie=AUTH.cookie_header("", self._cookie_is_secure(), clear=True))
                return
            data = self._read_json_body()
            if action == "register":
                result = AUTH.register(data.get("username", ""), data.get("password", ""), data.get("email", ""))
                self._send_json(201, result)
            elif action == "login":
                user = AUTH.login(data.get("username", ""), data.get("password", ""))
                self._send_json(
                    200, user,
                    cookie=AUTH.cookie_header(AUTH.issue_token(user["username"]), self._cookie_is_secure()),
                )
        except AuthError as exc:
            self._send_json(exc.status, {"error": exc.message})

    def _handle_admin_user_action(self, username: str, action: str) -> None:
        admin = self._require_admin()
        if admin is None:
            return
        if username == admin["username"] and action in ("disable", "demote"):
            self._send_json(400, {"error": "You cannot demote or disable your own account."})
            return
        try:
            if action == "approve":
                approved = AUTH.approve_user(username)
                if approved:
                    mailer.send_account_approved(approved["username"], approved["email"])
            elif action == "disable":
                AUTH.update_user(username, status="disabled")
            elif action == "promote":
                AUTH.update_user(username, role="admin")
            elif action == "demote":
                AUTH.update_user(username, role="user")
            self._send_json(200, {"status": "ok"})
        except AuthError as exc:
            self._send_json(exc.status, {"error": exc.message})

    def _handle_admin_set_limits(self, username: str) -> None:
        admin = self._require_admin()
        if admin is None:
            return
        try:
            overrides = normalize_overrides(self._read_json_body())
            limits = AUTH.set_limits(username, overrides)
            self._send_json(200, {"status": "ok", "limits": limits})
        except ValueError as exc:
            self._send_json(400, {"error": str(exc)})
        except AuthError as exc:
            self._send_json(exc.status, {"error": exc.message})

    def _handle_admin_delete_user(self, username: str) -> None:
        admin = self._require_admin()
        if admin is None:
            return
        if username == admin["username"]:
            self._send_json(400, {"error": "You cannot delete your own account."})
            return
        try:
            AUTH.delete_user(username)
            self._send_json(200, {"status": "deleted"})
        except AuthError as exc:
            self._send_json(exc.status, {"error": exc.message})

    def log_message(self, fmt, *args) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:
        path = unquote(urlparse(self.path).path)

        if path == "/healthz":
            self._send_json(200, {"status": "ok"})
            return

        match = re.fullmatch(r"/api/model/status/([A-Za-z0-9_-]+)", path)
        if match:
            job = get_job(match.group(1))
            if job is None:
                self._send_json(404, {"error": "not found"})
                return
            self._send_json(200, {
                "progress": job["progress"],
                "status": job["status"],
                "message": job["message"],
                "modelUrl": job.get("model_url"),
                "imageUrls": job.get("image_urls", []),
            })
            return

        if path == "/api/auth/config":
            self._send_json(200, {
                "mode": AUTH.mode,
                "registration": AUTH.registration,
                "maxUploadBytes": MAX_UPLOAD_BYTES,
            })
            return

        if path == "/api/auth/me":
            user = self._current_user()
            self._send_json(200, {"user": user["username"] if user else None, "role": user["role"] if user else None})
            return

        if path == "/api/jobs":
            self._send_json(200, {"jobs": list_jobs(self._current_user())})
            return

        if path == "/api/limits":
            user = self._current_user()
            key, username, limits = self._limit_context(user)
            self._send_json(200, {
                "limits": limits,
                "usage": LIMITS.usage(key, username, active_jobs_for(key)),
                "maxConcurrentConversions": MAX_CONCURRENT_CONVERSIONS,
            })
            return

        if path == "/api/admin/users":
            admin = self._require_admin()
            if admin is None:
                return
            users = AUTH.list_users()
            for user in users:
                key = Limits.key_for(user, "")
                user["effectiveLimits"] = Limits.effective_limits(user, user.get("limits"))
                user["usage"] = LIMITS.usage(key, user["username"], active_jobs_for(key))
            self._send_json(200, {"users": users, "defaultLimits": default_limits()})
            return

        match = re.match(r"/files/([A-Za-z0-9_-]+)/(.+)", path)
        if match:
            self._serve_file(match.group(1), match.group(2))
            return

        self._send_json(404, {"error": "not found"})

    def do_POST(self) -> None:
        path = unquote(urlparse(self.path).path)
        if path == "/api/model/create":
            self._handle_create()
            return
        if path == "/api/editor/upload-thumbnail":
            self._handle_thumbnail_upload()
            return
        match = re.fullmatch(r"/api/auth/(register|login|logout)", path)
        if match:
            self._handle_auth(match.group(1))
            return
        match = re.fullmatch(r"/api/admin/users/([A-Za-z0-9_.-]+)/limits", path)
        if match:
            self._handle_admin_set_limits(match.group(1))
            return
        match = re.fullmatch(r"/api/admin/users/([A-Za-z0-9_.-]+)/(approve|disable|promote|demote)", path)
        if match:
            self._handle_admin_user_action(match.group(1), match.group(2))
            return
        self._send_json(404, {"error": "not found"})

    def do_DELETE(self) -> None:
        path = unquote(urlparse(self.path).path)
        match = re.fullmatch(r"/api/admin/users/([A-Za-z0-9_.-]+)", path)
        if match:
            self._handle_admin_delete_user(match.group(1))
            return
        match = re.fullmatch(r"/api/jobs/([A-Za-z0-9_-]+)", path)
        if match:
            self._handle_delete(match.group(1))
            return
        self._send_json(404, {"error": "not found"})

    def _handle_delete(self, job_id: str) -> None:
        user = self._require_user()
        if user is None:
            return
        job_dir = JOBS_DIR / job_id
        if not job_dir.is_dir():
            self._send_json(404, {"error": "not found"})
            return
        if not can_delete_job(job_id, user or None):
            self._send_json(403, {"error": "You can only delete your own uploads"})
            return
        shutil.rmtree(job_dir)
        with JOBS_LOCK:
            JOBS.pop(job_id, None)
        self._send_json(200, {"status": "deleted"})

    def _handle_create(self) -> None:
        # Authenticate before reading the (up to MAX_UPLOAD_BYTES) body, so
        # anonymous clients can't make the worker buffer uploads.
        user = self._require_user()
        if user is None:
            return
        # Likewise check the limits (using the declared size) before reading
        # the body; reserve() below re-checks them atomically.
        key, username, limits = self._limit_context(user)
        declared_size = int(self.headers.get("Content-Length", "0") or 0)
        try:
            LIMITS.check(key, username, limits, declared_size, active_jobs_for(key))
        except LimitError as exc:
            self._send_limit_error(exc)
            return
        try:
            filename, content = parse_multipart_file(self)
        except UploadTooLarge as exc:
            self._send_json(413, {"error": str(exc)})
            return
        except ValueError as exc:
            self._send_json(400, {"error": str(exc)})
            return

        ext = Path(filename).suffix.lower().lstrip(".")
        if ext not in SUPPORTED_FORMATS | ARCHIVE_FORMATS:
            self._send_json(400, {"error": f"Unsupported file type: .{ext}"})
            return

        try:
            job_id = LIMITS.reserve(
                key, username, limits, len(content),
                active_jobs_fn=lambda: active_jobs_for(key),
                create_job=lambda: new_job(key),
            )
        except LimitError as exc:
            self._send_limit_error(exc)
            return
        input_dir = JOBS_DIR / job_id / "input"
        input_dir.mkdir(parents=True, exist_ok=True)
        input_path = input_dir / Path(filename).name
        input_path.write_bytes(content)
        write_owner(job_id, user.get("username") if user else None, input_path.name, len(content))

        thread = threading.Thread(target=run_pipeline, args=(job_id, input_path, ext), daemon=True)
        thread.start()

        self._send_json(200, {"entity_id": job_id, "status": "started"})

    def _handle_thumbnail_upload(self) -> None:
        """The viewer's "Render preview": a PNG of the current view, saved as
        the model's <name>_side45.png in its views/ folder - the file the
        Blender render (and Drupal's ThumbnailUploadController) writes too.
        `path` is the model's folder URL (/files/<job>/...)."""
        user = self._require_user()
        if user is None:
            return
        try:
            fields, files = parse_multipart_form(self, MAX_THUMBNAIL_BYTES)
        except UploadTooLarge as exc:
            self._send_json(413, {"error": str(exc)})
            return
        except ValueError as exc:
            self._send_json(400, {"error": str(exc)})
            return

        image = files.get("data")
        if not image or not image.startswith(b"\x89PNG\r\n\x1a\n"):
            self._send_json(415, {"error": "Expected a PNG image"})
            return
        name = re.sub(r"[^A-Za-z0-9_.-]", "_", fields.get("filename", "")).strip(".")
        if not name:
            self._send_json(400, {"error": "Invalid filename"})
            return
        match = re.fullmatch(r"/files/([A-Za-z0-9_-]+)(?:/(.*))?", unquote(urlparse(fields.get("path", "")).path))
        if not match or not JOB_ID_RE.fullmatch(match.group(1)):
            self._send_json(400, {"error": "Not an uploaded model"})
            return
        job_id = match.group(1)
        job_root = (JOBS_DIR / job_id / "input").resolve()
        model_dir = (job_root / (match.group(2) or "")).resolve()
        if not (model_dir == job_root or str(model_dir).startswith(str(job_root) + os.sep)) or not model_dir.is_dir():
            self._send_json(404, {"error": "not found"})
            return
        if not can_delete_job(job_id, user or None):
            self._send_json(403, {"error": "You can only change your own uploads"})
            return

        views_dir = model_dir / "views"
        views_dir.mkdir(exist_ok=True)
        target = views_dir / f"{name}_side45.png"
        target.write_bytes(image)
        image_url = f"/files/{job_id}/{target.relative_to(job_root)}"
        with JOBS_LOCK:
            job = JOBS.get(job_id)
            if job is not None and image_url not in job.get("image_urls", []):
                job["image_urls"] = [*job.get("image_urls", []), image_url]
        self._send_json(200, {"message": f"Thumbnail saved ({len(image)} bytes)", "imageUrl": image_url})

    def _serve_file(self, job_id: str, rel_path: str) -> None:
        job_root = (JOBS_DIR / job_id / "input").resolve()
        target = (job_root / rel_path).resolve()
        if not str(target).startswith(str(job_root) + os.sep) or not target.is_file():
            self._send_json(404, {"error": "not found"})
            return

        content_type = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        data = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(data)


def admin_cli(args) -> None:
    """docker compose exec worker python3 /app/worker/server.py admin <command>"""
    commands = (
        "users | uploads | usage | limits <user> [key=value|key=default ...] | "
        "approve <user> | disable <user> | promote <user> | demote <user> | delete-user <user>"
    )
    if not args:
        sys.exit(f"usage: server.py admin {commands}")
    command, rest = args[0], args[1:]
    try:
        if command == "users":
            for u in AUTH.list_users():
                created = time.strftime("%Y-%m-%d", time.localtime(u["createdAt"]))
                print(f"{u['username']:<32} {u['email']:<32} {u['role']:<6} {u['status']:<9} created {created}")
        elif command == "uploads":
            rows = []
            for job_dir in JOBS_DIR.iterdir():
                if job_dir.is_dir() and JOB_ID_RE.fullmatch(job_dir.name):
                    owner = read_owner(job_dir.name) or {}
                    rows.append((owner.get("createdAt", 0), job_dir.name, owner.get("user") or "(none)",
                                 owner.get("filename", "?"), owner.get("size", 0)))
            for created, job_id, user, filename, size in sorted(rows):
                when = time.strftime("%Y-%m-%d %H:%M", time.localtime(created)) if created else "unknown"
                print(f"{when}  {job_id}  {user:<20} {size / 1048576:8.1f} MB  {filename}")
        elif command == "usage":
            print(f"defaults: {default_limits()}  (0 = unlimited)")
            for u in AUTH.list_users():
                key = Limits.key_for(u, "")
                usage = LIMITS.usage(key, u["username"], 0)
                limits = Limits.effective_limits(u, u.get("limits"))
                print(
                    f"{u['username']:<32} uploads {usage['uploadsLastHour']}/{limits['uploadsPerHour'] or '-'} h, "
                    f"{usage['uploadsLastDay']}/{limits['uploadsPerDay'] or '-'} day  "
                    f"storage {usage['storageBytes'] / 1048576:.1f}/{limits['storageMb'] or '-'} MB  "
                    f"models {usage['models']}/{limits['maxModels'] or '-'}"
                )
        elif command == "limits" and rest:
            user, assignments = rest[0], rest[1:]
            if assignments:
                overrides = {}
                for assignment in assignments:
                    name, sep, value = assignment.partition("=")
                    if not sep:
                        sys.exit(f"expected key=value, got {assignment!r} (keys: {', '.join(LIMIT_KEYS)})")
                    overrides[name] = None if value == "default" else value
                try:
                    AUTH.set_limits(user, normalize_overrides(overrides))
                except ValueError as exc:
                    sys.exit(str(exc))
            record = next((u for u in AUTH.list_users() if u["username"] == user), None)
            if record is None:
                sys.exit(f"No such user: {user}")
            effective = Limits.effective_limits(record, record.get("limits"))
            for name in LIMIT_KEYS:
                source = "override" if name in record.get("limits", {}) else "default"
                if record["role"] == "admin":
                    source = "admin"
                print(f"{name:<16} {effective[name] or 'unlimited':<10} ({source})")
        elif command in ("approve", "disable", "promote", "demote", "delete-user") and len(rest) == 1:
            user = rest[0]
            if command == "approve":
                approved = AUTH.approve_user(user)
                if approved:
                    # The CLI process exits right after, so send inline.
                    mailer.send_account_approved(approved["username"], approved["email"], background=False)
            elif command == "disable":
                AUTH.update_user(user, status="disabled")
            elif command == "promote":
                AUTH.update_user(user, role="admin")
            elif command == "demote":
                AUTH.update_user(user, role="user")
            else:
                AUTH.delete_user(user)
            print(f"ok: {command} {user}")
        else:
            sys.exit(f"usage: server.py admin {commands}")
    except AuthError as exc:
        sys.exit(exc.message)


def main() -> None:
    if len(sys.argv) > 1 and sys.argv[1] == "admin":
        admin_cli(sys.argv[2:])
        return

    JOBS_DIR.mkdir(parents=True, exist_ok=True)
    admin_user = os.environ.get("WORKER_ADMIN_USER", "")
    admin_password = os.environ.get("WORKER_ADMIN_PASSWORD", "")
    if AUTH.enabled and admin_user and admin_password:
        AUTH.ensure_admin(admin_user, admin_password)
        print(f"Accounts enabled (registration: {AUTH.registration}); admin '{admin_user}' ensured.")
    elif AUTH.enabled:
        print(f"Accounts enabled (registration: {AUTH.registration}); no WORKER_ADMIN_USER/PASSWORD set.")
    print(f"Upload limits: {default_limits()} per account (0 = unlimited), "
          f"{MAX_CONCURRENT_CONVERSIONS or 'unlimited'} concurrent conversion(s).")
    if not CONVERT_SCRIPT.is_file():
        sys.exit(f"convert.sh not found at {CONVERT_SCRIPT} - set WORKER_SCRIPTS_DIR")
    if not CONVERT_MESH_SCRIPT.is_file():
        sys.exit(f"convert_mesh.py not found at {CONVERT_MESH_SCRIPT} - set WORKER_SCRIPTS_DIR")

    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"DFG 3D Viewer worker listening on :{PORT} (jobs dir: {JOBS_DIR})")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
