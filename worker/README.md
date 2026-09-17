# Standalone conversion worker

Runs the existing model → glTF conversion + thumbnail-rendering pipeline
(`scripts/convert.sh`, `scripts/render.sh`, Blender, the Python converters)
in a container, behind a small HTTP API - no Drupal required.

This is additive: the Drupal-integrated path (`ConvertWorker` queue plugin →
`scripts/worker.sh` → `drush` → `convert.sh`) is untouched and keeps working
exactly as before for the existing instance. This worker is a second, generic
front door onto the same conversion scripts.

### Using this worker from the Drupal module

`ConvertProcessService` (used by the `ConvertWorker` queue plugin) can
optionally delegate conversion/rendering to this worker container instead of
running `scripts/convert.sh`/`render.sh` directly on the Drupal host — useful
when you don't want Blender installed next to Drupal. This is opt-in and
fully backward compatible:

- Default (`conversion_backend` unset or `local`): behaviour is unchanged —
  `ConvertProcessService` runs the local scripts exactly as before.
- Set `dfg_3dviewer_conversion_backend` to `docker` and
  `dfg_3dviewer_worker_url` to this worker's base URL (e.g. `http://worker:8080`
  on the same Docker network, or a remote `https://` URL) in the module's
  admin form (`/admin/config/.../dfg-3dviewer`, "Conversion backend" section)
  to have Drupal upload files to `POST /api/model/create`, poll
  `GET /api/model/status/<id>`, and download the resulting model/thumbnails
  back onto the Drupal filesystem at the same paths the local scripts would
  have produced. `ConvertWorker.php` and the entity field logic are
  unmodified either way — only where the actual Blender/Python work happens
  changes.
- With the `docker` backend, archive extraction (`zip`/`rar`/`tar`/`gz`/`xz`)
  also happens inside the worker container — Drupal uploads the raw archive
  as-is and never runs `ZipArchive` or `scripts/uncompress.sh` locally, so no
  archive-tool dependencies (`unzip`, `unrar`, `7z`, `tar`) need to be
  installed next to Drupal. With the `local` backend, extraction still runs
  on the Drupal host exactly as before.
- This worker's pipeline always attempts thumbnail rendering (controlled
  server-side by `WORKER_SKIP_RENDER`, not per-request), so the "Lightweight"
  module setting simply causes Drupal to skip downloading/using the
  thumbnails rather than telling the worker not to render them.

## Run it

```bash
docker compose up --build
```

This starts:
- `worker` on `:8080` - the conversion API described below. Shared by all
  three viewer services below - there is only ever one worker.
- `viewer-test` on `:3000` - static `dist/test` build (`npm run build:test`).
- `viewer-dev` on `:3001` - static `dist/dev` build (`npm run build:dev`).
- `viewer-sandbox` on `:3002` - the same `dist/test` build as `viewer-test`,
  but with `viewer.sandboxMode` baked into its `viewer-settings.json` (see
  `Dockerfile.viewer`'s `SANDBOX_MODE` build arg), so it opens straight into
  the drag-and-drop upload mode (`viewer/sandbox.js`, normally reached via
  `?sandbox=1` on any build) without needing the query param.

Each viewer service is nginx fronting its static build, reverse-proxying
`/api/` and `/files/` to `worker` (see `docker/nginx.conf`). This keeps each
viewer and the API on the same origin, so `viewer/status-poller.js` and the
"Upload & convert" panel (`viewer/ui/upload-panel.js`) can use plain relative
`fetch()` calls - exactly like the existing Drupal integration does. To build
a `dist/prod` variant the same way, add a fourth service in
`docker-compose.yml` copying one of the existing `viewer-*` blocks with
`BUILD_TARGET: prod` and a free host port.

The worker's `:8080` port is still published directly too, for calling the
API from outside the viewer (curl, scripts, etc).

### Local overrides (ports, GPU, etc.)

For machine-specific tweaks - a different host port because `:3000` is
already taken, enabling GPU passthrough, or similar - don't edit
`docker-compose.yml` itself. Copy `docker-compose.override.example.yml` to
`docker-compose.override.yml` (gitignored) and uncomment/edit only the keys
you need:

```bash
cp docker-compose.override.example.yml docker-compose.override.yml
```

The example file is entirely commented out, so copying it as-is is a safe
no-op - `docker compose config` will just show the unchanged base file. To
actually override something, uncomment **both** the `services:` line and
the specific example block underneath it; a `services:` key left with
nothing but comments under it parses as empty/null, which Compose rejects
with `services must be a mapping` (a real error message you'll get if you
uncomment an example without also uncommenting the `services:` line above
it - easy to hit if only skimming the file).

`docker compose up`/`docker compose build` read and merge
`docker-compose.override.yml` on top of `docker-compose.yml` automatically,
no extra flags needed. This keeps `docker-compose.yml` itself untouched, so
pulling in upstream changes (new services, etc.) never conflicts with local
setup - only the specific keys you actually overrode in your local file
differ from the tracked one.

One gotcha worth knowing if you add your own overrides beyond the provided
examples: Compose's default merge behavior for list-valued keys (`ports`,
`volumes`, ...) is to **concatenate** the base file's list with the
override's, not replace it - overriding `ports: ["3010:3000"]` without
anything else would leave the service published on both `:3000` (from
`docker-compose.yml`) and `:3010`. Use the `!override` tag to replace
instead of merge (see the port-remap example in
`docker-compose.override.example.yml`) - this doesn't apply to
`environment`, which Compose treats as a key-value map even when written as
a list, so a repeated variable name there already overrides cleanly without
needing the tag.

## API

- `POST /api/model/create` - multipart upload, one file field (any name,
  first file part wins). Accepts the formats `scripts/convert.sh` already
  understands (`abc dae fbx obj ply stl wrl x3d ifc blend gml glb`) plus
  `.zip` archives containing one of those. Returns:
  ```json
  { "entity_id": "<job id>", "status": "started" }
  ```
- `GET /api/model/status/<id>` - matches the field names returned by
  `src/Controller/ModelController.php::status()` (`progress`, `status`,
  `message`), plus `modelUrl` / `imageUrls` once the job reaches `ready`:
  ```json
  {
    "progress": 100,
    "status": "ready",
    "message": "Conversion finished",
    "modelUrl": "/files/<id>/gltf/model.glb",
    "imageUrls": ["/files/<id>/views/model_side45.png", "..."]
  }
  ```
  `status` values follow the same vocabulary `viewer/status-poller.js`
  already knows how to render: `preparing`, `processing`, `rendering`,
  `ready`, `failed`.
- `GET /files/<id>/...` - serves the converted model and rendered thumbnails.

## Configuration

Set via environment variables on the `worker` container (see
`worker/Dockerfile` for defaults):

| Variable                  | Default        | Meaning                                   |
|----------------------------|----------------|--------------------------------------------|
| `WORKER_PORT`              | `8080`         | HTTP listen port                          |
| `WORKER_JOBS_DIR`          | `/data/jobs`   | Where uploads/outputs are stored          |
| `WORKER_SKIP_RENDER`       | `false`        | Skip Blender thumbnail rendering          |
| `WORKER_MAX_UPLOAD_BYTES`  | `524288000`    | Upload size cap (500 MB)                  |
| `WORKER_CONVERT_TIMEOUT`   | `1800`         | Seconds before a convert.sh call is killed|
| `WORKER_RENDER_TIMEOUT`    | `900`          | Seconds before a render.sh call is killed |
| `WORKER_RENDER_DEVICE`     | `CPU`          | `CPU`, `GPU`, or `AUTO` - see below       |

`SPATH` and `BLENDER_BIN` are set in the image itself (`/app`, `blender`) -
you don't need `scripts/.env` inside the container.

### GPU rendering

Thumbnail rendering (`scripts/render.py`, Cycles) runs on CPU by default.
To use a GPU instead:

1. In `docker-compose.yml`, set `WORKER_RENDER_DEVICE` to `GPU` (fails if no
   GPU is found) or `AUTO` (falls back to CPU silently), and uncomment the
   `deploy.resources.reservations.devices` block on the `worker` service.
2. Install and configure [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html)
   on the Docker host - required so Docker even knows about an `nvidia`
   device driver (without it, `docker compose up` fails immediately with
   `could not select device driver "nvidia"`, before the container - and
   `try_enable_gpu()`'s own CPU fallback - ever runs). On Ubuntu/Debian:

   ```bash
   curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg

   curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
     sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
     sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

   sudo apt-get update
   sudo apt-get install -y nvidia-container-toolkit

   sudo nvidia-ctk runtime configure --runtime=docker
   sudo systemctl restart docker
   ```

   The last command restarts the Docker daemon, which restarts every
   container on the host, not just this project - plan around that on a
   shared machine. Only NVIDIA/CUDA and OptiX are exercised on the Python
   side today - `scripts/render.py`'s `try_enable_gpu()` also tries HIP and
   oneAPI backends if present, but those are untested here.

The worker image itself needs no CUDA toolkit - the official Blender
tarball it installs (see `worker/Dockerfile`) bundles its own Cycles GPU
kernels; only the NVIDIA driver's userspace libraries need to reach the
container, which is what the toolkit above provides.

## Known limitations (MVP)

- Job state lives in memory only; restarting the container loses in-flight
  and completed job records (the output files on the `worker-jobs` volume
  survive, only the status lookup by id is lost).
- Archive support covers `zip`, `rar`, `tar`, `gz`, `xz` (`zip` via an
  in-process, path-traversal-checked extractor; the rest by shelling out to
  `scripts/uncompress.sh`, already baked into this image - `unrar-free` and
  `tar` are installed in `worker/Dockerfile` for this). `scripts/convert.sh`
  itself has no built-in archive handling; that logic normally lives in
  `ConvertWorker.php` on the Drupal side, so this worker reimplements
  first-supported-file detection after extraction to be useful standalone.
- Uploads are buffered fully in memory before being written to disk; fine for
  the sizes this pipeline already deals with, but not streaming.
