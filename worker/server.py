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
  GET  /files/<id>/<path>       static access to converted output
  GET  /healthz                 liveness check

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
import uuid
import zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

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
MAX_UPLOAD_BYTES = int(os.environ.get("WORKER_MAX_UPLOAD_BYTES", str(500 * 1024 * 1024)))
CONVERT_TIMEOUT = int(os.environ.get("WORKER_CONVERT_TIMEOUT", "1800"))
RENDER_TIMEOUT = int(os.environ.get("WORKER_RENDER_TIMEOUT", "900"))

# Extensions scripts/convert.sh actually has a case-branch for.
DIRECT_FORMATS = {"abc", "dae", "fbx", "obj", "ply", "stl", "wrl", "x3d"}
SPECIAL_FORMATS = {"ifc", "blend", "gml"}
PASSTHROUGH_FORMATS = {"glb"}
SUPPORTED_FORMATS = DIRECT_FORMATS | SPECIAL_FORMATS | PASSTHROUGH_FORMATS
# Mirrors ModelFormatManager::getZipFormats() on the Drupal side. "zip" is
# extracted in-process (safe_extract_zip); the rest shell out to the same
# scripts/uncompress.sh the Drupal module itself uses locally, so behavior
# (including its "unrar/7z/tar" dependency requirements) stays identical
# between the docker and non-docker paths - just moved into this container.
ARCHIVE_FORMATS = {"zip", "rar", "tar", "gz", "xz"}

JOBS = {}
JOBS_LOCK = threading.Lock()


def new_job() -> str:
    job_id = uuid.uuid4().hex
    with JOBS_LOCK:
        JOBS[job_id] = {
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


def scan_job(job_id: str, job_dir: Path):
    """Reconstruct a finished job's result straight from JOBS_DIR, the same
    way run_pipeline() would have reported it - used to make jobs from
    before a worker restart show up in GET /api/jobs, since JOBS (the
    in-memory progress registry) does not survive one but the files on the
    persistent volume do."""
    job_root = job_dir / "input"
    if not job_root.is_dir():
        return None

    glb_candidates = sorted(job_root.rglob("*.glb"))
    if not glb_candidates:
        return None
    # A file under a "gltf" folder is convert.sh's own output and is
    # preferred; otherwise fall back to whatever .glb is there (e.g. a
    # passthrough upload that skipped conversion entirely).
    glb_path = next(
        (p for p in glb_candidates if "gltf" in p.relative_to(job_root).parts),
        glb_candidates[0],
    )

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


def list_jobs():
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
            jobs.append(job)
    jobs.sort(key=lambda job: job["createdAt"], reverse=True)
    return jobs


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

        if ext in PASSTHROUGH_FORMATS:
            glb_path = work_path
        else:
            set_job(job_id, status="processing", progress=25, message="Converting model...")
            result = subprocess.run(
                [str(CONVERT_SCRIPT), "-i", str(work_path), "-c", "true", "-l", "3", "-b", "true", "-f", "true"],
                capture_output=True, text=True, timeout=CONVERT_TIMEOUT,
            )
            if result.returncode != 0:
                detail = result.stderr.strip() or result.stdout.strip()
                raise RuntimeError(f"convert.sh failed (exit={result.returncode}): {detail}")
            glb_path = work_path.parent / "gltf" / (work_path.stem + ".glb")

        if not glb_path.is_file():
            raise RuntimeError(f"Expected converted output missing: {glb_path}")

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


def parse_multipart_file(handler: "Handler"):
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
    if length <= 0 or length > MAX_UPLOAD_BYTES:
        raise ValueError("Invalid or too large upload")
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
        headers_text = header_blob.decode("latin-1")
        match = re.search(r'filename="([^"]*)"', headers_text)
        if not match or not match.group(1):
            continue
        if content.endswith(b"\r\n"):
            content = content[:-2]
        return match.group(1), content

    raise ValueError("No file part found in upload")


class Handler(BaseHTTPRequestHandler):
    server_version = "DFG3DWorker/0.1"

    def _send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

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

        if path == "/api/jobs":
            self._send_json(200, {"jobs": list_jobs()})
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
        self._send_json(404, {"error": "not found"})

    def do_DELETE(self) -> None:
        path = unquote(urlparse(self.path).path)
        match = re.fullmatch(r"/api/jobs/([A-Za-z0-9_-]+)", path)
        if match:
            self._handle_delete(match.group(1))
            return
        self._send_json(404, {"error": "not found"})

    def _handle_delete(self, job_id: str) -> None:
        job_dir = JOBS_DIR / job_id
        if not job_dir.is_dir():
            self._send_json(404, {"error": "not found"})
            return
        shutil.rmtree(job_dir)
        with JOBS_LOCK:
            JOBS.pop(job_id, None)
        self._send_json(200, {"status": "deleted"})

    def _handle_create(self) -> None:
        try:
            filename, content = parse_multipart_file(self)
        except ValueError as exc:
            self._send_json(400, {"error": str(exc)})
            return

        ext = Path(filename).suffix.lower().lstrip(".")
        if ext not in SUPPORTED_FORMATS | ARCHIVE_FORMATS:
            self._send_json(400, {"error": f"Unsupported file type: .{ext}"})
            return

        job_id = new_job()
        input_dir = JOBS_DIR / job_id / "input"
        input_dir.mkdir(parents=True, exist_ok=True)
        input_path = input_dir / Path(filename).name
        input_path.write_bytes(content)

        thread = threading.Thread(target=run_pipeline, args=(job_id, input_path, ext), daemon=True)
        thread.start()

        self._send_json(200, {"entity_id": job_id, "status": "started"})

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


def main() -> None:
    JOBS_DIR.mkdir(parents=True, exist_ok=True)
    if not CONVERT_SCRIPT.is_file():
        sys.exit(f"convert.sh not found at {CONVERT_SCRIPT} - set WORKER_SCRIPTS_DIR")

    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"DFG 3D Viewer worker listening on :{PORT} (jobs dir: {JOBS_DIR})")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
