"""GLB optimization with gltfpack (meshoptimizer), stdlib only.

After conversion the worker rewrites the GLB it serves:

  <name>.glb          Meshopt-compressed geometry (EXT_meshopt_compression)
                      and KTX2/Basis (or WebP) textures
  <name>.preview.glb  simplified geometry and small textures, shown by the
                      viewer first while the full model downloads (only for
                      models large enough to benefit)

gltfpack keeps named nodes, materials and extras (-kn -km -ke), so IFC
element nodes (named by GUID) and the scene hierarchy survive, and keeps
positions and texture coordinates as floats (-vpf -vtf), so measurements
and tiled textures are unaffected. gltfpack cannot read Draco-compressed
input: with optimization on, the worker asks Blender for an uncompressed
GLB instead, and a Draco GLB uploaded as-is is served unchanged.

Configuration (environment):
  WORKER_OPTIMIZE              auto (default: on when gltfpack is installed) | true | false
  WORKER_GLTFPACK_BIN          gltfpack executable (default: gltfpack)
  WORKER_TEXTURE_FORMAT        ktx2 (default) | webp | keep
  WORKER_PREVIEW_RATIO         triangle ratio of the preview (default 0.1; 0 disables it)
  WORKER_PREVIEW_TEXTURE_SIZE  max preview texture size in px (default 512)
  WORKER_PREVIEW_MAX_ERROR     simplification error allowed for the preview (default 0.05 = 5%)
  WORKER_PREVIEW_MIN_BYTES     only make a preview for optimized models at least this big (default 2 MB)
  WORKER_OPTIMIZE_TIMEOUT      seconds per gltfpack run (default 900)

Also usable on its own, e.g. from the Drupal pipeline:
  python3 optimize.py model.glb [--preview]
"""

import os
import shutil
import subprocess
import sys
from pathlib import Path

GLTFPACK_BIN = os.environ.get("WORKER_GLTFPACK_BIN", "gltfpack")
TEXTURE_FORMAT = os.environ.get("WORKER_TEXTURE_FORMAT", "ktx2").lower()
PREVIEW_RATIO = float(os.environ.get("WORKER_PREVIEW_RATIO", "0.1"))
PREVIEW_TEXTURE_SIZE = int(os.environ.get("WORKER_PREVIEW_TEXTURE_SIZE", "512"))
PREVIEW_MAX_ERROR = float(os.environ.get("WORKER_PREVIEW_MAX_ERROR", "0.05"))
PREVIEW_MIN_BYTES = int(os.environ.get("WORKER_PREVIEW_MIN_BYTES", str(2 * 1024 * 1024)))
OPTIMIZE_TIMEOUT = int(os.environ.get("WORKER_OPTIMIZE_TIMEOUT", "900"))

if TEXTURE_FORMAT not in ("ktx2", "webp", "keep"):
    raise ValueError(f"WORKER_TEXTURE_FORMAT must be ktx2, webp or keep, got {TEXTURE_FORMAT!r}")

# Structure-preserving, float positions/UVs - see the module docstring.
BASE_FLAGS = ["-cc", "-kn", "-km", "-ke", "-vpf", "-vtf"]
TEXTURE_FLAGS = {"ktx2": ["-tc"], "webp": ["-tw"], "keep": []}


def gltfpack_path():
    return shutil.which(GLTFPACK_BIN)


def enabled() -> bool:
    setting = os.environ.get("WORKER_OPTIMIZE", "auto").lower()
    if setting in ("false", "0", "off", "no"):
        return False
    available = gltfpack_path() is not None
    if setting in ("true", "1", "on", "yes") and not available:
        print(f"WORKER_OPTIMIZE is on but {GLTFPACK_BIN!r} was not found - skipping optimization", file=sys.stderr)
    return available


def _run(args, log_prefix: str) -> None:
    command = [gltfpack_path() or GLTFPACK_BIN, *args, "-tj", str(os.cpu_count() or 1)]
    result = subprocess.run(command, capture_output=True, text=True, timeout=OPTIMIZE_TIMEOUT)
    print(
        f"{log_prefix} gltfpack exit={result.returncode}: {' '.join(args)}\n"
        f"--- stdout ---\n{result.stdout}\n--- stderr ---\n{result.stderr}",
        file=sys.stderr,
    )
    if result.returncode != 0:
        detail = (result.stderr.strip() or result.stdout.strip())[:300]
        raise RuntimeError(f"gltfpack failed (exit={result.returncode}): {detail}")


def preview_path_for(glb_path: Path) -> Path:
    return glb_path.with_name(glb_path.stem + ".preview.glb")


def optimize_glb(source: Path, target: Path, make_preview: bool = True, log_prefix: str = "") -> dict:
    """Writes the optimized model to target (source may equal target) and,
    when worthwhile, the preview next to it. Both are made from source -
    gltfpack cannot shrink textures that are already KTX2 - and target is
    replaced last. Raises on failure, leaving source untouched. Returns
    {"model": Path, "preview": Path | None}."""
    source, target = Path(source), Path(target)
    target.parent.mkdir(parents=True, exist_ok=True)
    temp_target = target.with_name(target.stem + ".optimized.tmp.glb")
    preview_target = preview_path_for(target)
    preview_target.unlink(missing_ok=True)
    preview = None
    try:
        _run(["-i", str(source), "-o", str(temp_target), *BASE_FLAGS, *TEXTURE_FLAGS[TEXTURE_FORMAT]], log_prefix)
        if not temp_target.is_file() or temp_target.stat().st_size == 0:
            raise RuntimeError("gltfpack produced no output")

        if make_preview and 0 < PREVIEW_RATIO < 1 and temp_target.stat().st_size >= PREVIEW_MIN_BYTES:
            try:
                _run(
                    [
                        "-i", str(source), "-o", str(preview_target), *BASE_FLAGS,
                        *TEXTURE_FLAGS[TEXTURE_FORMAT],
                        "-si", str(PREVIEW_RATIO), "-se", str(PREVIEW_MAX_ERROR),
                        "-tl", str(PREVIEW_TEXTURE_SIZE),
                    ],
                    log_prefix,
                )
                # Not worth an extra request unless clearly smaller.
                if preview_target.stat().st_size < temp_target.stat().st_size * 0.6:
                    preview = preview_target
                else:
                    print(f"{log_prefix} preview skipped: not much smaller than the model", file=sys.stderr)
                    preview_target.unlink(missing_ok=True)
            except (RuntimeError, subprocess.TimeoutExpired, OSError) as exc:
                # The preview is a nicety; the optimized model stands on its own.
                print(f"{log_prefix} preview skipped: {exc}", file=sys.stderr)
                preview_target.unlink(missing_ok=True)

        os.replace(temp_target, target)
    finally:
        temp_target.unlink(missing_ok=True)
    return {"model": target, "preview": preview}


def main(argv) -> None:
    if not argv or argv[0] in ("-h", "--help"):
        sys.exit("usage: optimize.py <model.glb> [--preview]  (rewrites the file in place)")
    if gltfpack_path() is None:
        sys.exit(f"{GLTFPACK_BIN!r} not found - install gltfpack or set WORKER_GLTFPACK_BIN")
    model = Path(argv[0])
    result = optimize_glb(model, model, make_preview="--preview" in argv[1:], log_prefix="[optimize]")
    print(f"model: {result['model']} ({result['model'].stat().st_size} bytes)")
    if result["preview"]:
        print(f"preview: {result['preview']} ({result['preview'].stat().st_size} bytes)")


if __name__ == "__main__":
    main(sys.argv[1:])
