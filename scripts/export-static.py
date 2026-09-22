#!/usr/bin/env python3
"""Collects converted models into a static folder you can host anywhere
(Cloudflare R2/Pages, GitHub Pages, any object storage) without running the
conversion worker publicly.

For every finished job it copies the GLB and the rendered thumbnails and writes
an AIM3D manifest pointing at the public URL of the copy:

  <out>/models/<slug>/model.glb        (or model.<ext> for viewer-native uploads)
  <out>/models/<slug>/views/*.png
  <out>/manifests/<slug>.json
  <out>/index.json                     list of everything exported

Typical use, with the worker running in Docker:

  docker compose cp worker:/data/jobs ./jobs-export
  python3 scripts/export-static.py --jobs-dir ./jobs-export \\
      --out ./static-export --base-url https://models.example.com

then upload <out> to your host (e.g. `rclone sync ./static-export r2:bucket`).
--base-url is where <out> will be served from; manifests contain absolute model
URLs built from it, since a manifest's model ids are not resolved relative to
the manifest file.
"""

import argparse
import json
import os
import re
import shutil
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DEFAULT_TEMPLATE = REPO / "docker" / "profiles" / "test.manifest.json"


def load_worker_scan():
    """Reuse the worker's own job scanner so exports pick the same GLB and
    renders the API would report."""
    os.environ.setdefault("WORKER_JOBS_DIR", str(REPO / "jobs-export"))
    sys.path.insert(0, str(REPO / "worker"))
    import server  # noqa: PLC0415 - needs the env var above set first
    return server


def slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", Path(name).stem.lower()).strip("-")
    return slug or "model"


def build_manifest(name: str, model_url: str, template: dict, keep_editor: bool, mime: str = None) -> dict:
    scene_id = f"{model_url}/scene"
    block = json.loads(json.dumps(template.get("AIM3DViewer", {})))  # deep copy
    viewer = block.setdefault("viewer", {})
    # A public portfolio should be view-only and not depend on a worker.
    viewer["sandbox"] = False
    viewer["presentationMode"] = False
    if not keep_editor:
        viewer["editor"] = False
    block.get("integration", {}).pop("api", None)
    if not block.get("integration"):
        block.pop("integration", None)
    return {
        "@context": "http://iiif.io/api/presentation/4/context.json",
        "id": f"{model_url}/manifest.json",
        "type": "Manifest",
        "label": {"en": [name]},
        "items": [{
            "id": scene_id,
            "type": "Scene",
            "label": {"en": [name]},
            "items": [{
                "id": f"{scene_id}/page/model",
                "type": "AnnotationPage",
                "items": [{
                    "id": f"{scene_id}/annotation/model",
                    "type": "Annotation",
                    "motivation": ["painting"],
                    "body": {k: v for k, v in {"id": model_url, "type": "Model", "format": mime}.items() if v},
                    "target": {"id": scene_id, "type": "Scene"},
                }],
            }],
            "annotations": [{"id": f"{scene_id}/page/annotations", "type": "AnnotationPage", "items": []}],
        }],
        "AIM3DViewer": block,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--jobs-dir", required=True, type=Path, help="copy of the worker's /data/jobs")
    parser.add_argument("--out", required=True, type=Path, help="output folder")
    parser.add_argument("--base-url", required=True, help="public URL <out> will be served from")
    parser.add_argument("--only", action="append", default=[], metavar="JOB_ID", help="export just these jobs (repeatable)")
    parser.add_argument("--owner", help="export only jobs uploaded by this account")
    parser.add_argument("--template", type=Path, default=DEFAULT_TEMPLATE, help="manifest whose AIM3DViewer block is reused")
    parser.add_argument("--keep-editor", action="store_true", help="leave the editor enabled in the manifests")
    args = parser.parse_args()

    if not args.jobs_dir.is_dir():
        return print(f"error: {args.jobs_dir} is not a directory", file=sys.stderr) or 1
    base = args.base_url.rstrip("/")
    template = json.loads(args.template.read_text("utf-8"))

    server = load_worker_scan()
    server.JOBS_DIR = args.jobs_dir  # scan_job/read_owner resolve paths from here

    used_slugs, exported, total_bytes = set(), [], 0
    for job_dir in sorted(args.jobs_dir.iterdir()):
        if not job_dir.is_dir() or not server.JOB_ID_RE.fullmatch(job_dir.name):
            continue
        if args.only and job_dir.name not in args.only:
            continue
        owner = server.read_owner(job_dir.name) or {}
        if args.owner and owner.get("user") != args.owner:
            continue
        job = server.scan_job(job_dir.name, job_dir)
        if job is None:
            continue

        job_root = job_dir / "input"
        glb = job_root / job["modelUrl"].split(f"/files/{job['id']}/", 1)[1]
        model_ext = glb.suffix.lower()  # ".glb", or the original for viewer-native formats
        slug = base_slug = slugify(job["name"])
        n = 2
        while slug in used_slugs:
            slug, n = f"{base_slug}-{n}", n + 1
        used_slugs.add(slug)

        model_dir = args.out / "models" / slug
        (model_dir / "views").mkdir(parents=True, exist_ok=True)
        shutil.copyfile(glb, model_dir / f"model{model_ext}")
        total_bytes += glb.stat().st_size
        images = []
        for url in job["imageUrls"]:
            src = job_root / url.split(f"/files/{job['id']}/", 1)[1]
            shutil.copyfile(src, model_dir / "views" / src.name)
            total_bytes += src.stat().st_size
            images.append(f"{base}/models/{slug}/views/{src.name}")

        model_url = f"{base}/models/{slug}/model{model_ext}"
        manifest = build_manifest(job["name"], model_url, template, args.keep_editor,
                                  "model/gltf-binary" if model_ext == ".glb" else None)
        manifest_path = args.out / "manifests" / f"{slug}.json"
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", "utf-8")

        exported.append({
            "name": job["name"],
            "slug": slug,
            "model": model_url,
            "manifest": f"{base}/manifests/{slug}.json",
            "images": images,
        })
        print(f"exported {job['name']} -> {slug}")

    if not exported:
        print("nothing to export (no finished jobs matched)", file=sys.stderr)
        return 1
    (args.out / "index.json").write_text(json.dumps({"models": exported}, indent=2, ensure_ascii=False) + "\n", "utf-8")
    print(f"\n{len(exported)} model(s), {total_bytes / 1048576:.1f} MB -> {args.out}")
    print("Upload that folder to your host and serve it with a long Cache-Control (files are immutable per slug).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
