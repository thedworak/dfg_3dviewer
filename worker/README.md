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

### Base image

The worker image is split in two so that code changes do not reinstall Blender:

- `worker/Dockerfile.base` - Ubuntu, system packages, Python libraries (trimesh, cascadio, ifcopenshell, py3dtiles, ...), Blender, gltfpack and PotreeConverter (built from source). Built by the `worker-base` service in `docker-compose.yml`, which is never started (`scale: 0`).
- `worker/Dockerfile` - `FROM worker-base` (the service's image, passed in through `additional_contexts`), adds only `scripts/` and `worker/*.py`.

`docker compose build` / `up --build` builds the base first. The first time that downloads Blender; afterwards every base layer comes from the local build cache, so a code change only rebuilds the thin worker layer. Editing `Dockerfile.base` invalidates just the layers from the edit onwards - no tags to bump.

- `.github/workflows/worker-base.yml` publishes the base to `ghcr.io/thedworak/dfg-3dviewer-worker-base:latest` with inline cache metadata whenever `Dockerfile.base` changes; compose uses it as `cache_from`, so machines without a local cache (GitHub runners, a new server) skip the Blender download too. Make the GHCR package public after its first publish (or log the machine in to `ghcr.io`); until then the base is simply built locally - a missing cache image is only a warning.
- `scripts/docker.sh base` rebuilds the base from scratch (`--no-cache --pull`), e.g. to pick up Ubuntu security updates.
- By hand: `docker build -f worker/Dockerfile.base -t dfg-3dviewer-worker-base worker`, then `docker build -f worker/Dockerfile --build-context worker-base=docker-image://dfg-3dviewer-worker-base -t dfg-3dviewer-worker .`

### Exposing this on a real domain

`docker-compose.yml` only publishes plain host ports (`:3000`/`:3001`/`:3002`/`:8080`).
For a real deployment, put a host-level nginx (running directly on the
server, outside Docker - not the same file as `docker/nginx.conf` above,
which runs *inside* each viewer container) in front of it to terminate
HTTPS and route real (sub)domains to those ports, plus Drupal itself if it
runs on the same server. See
[`docker/host-nginx.example.conf`](../docker/host-nginx.example.conf) for a
ready-to-adjust template (separate `test.`/`dev.`/`sandbox.` subdomains,
Let's Encrypt/certbot-shaped HTTPS blocks, and a standard Drupal + PHP-FPM
block) - it has placeholders (`<MAIN_DOMAIN>`, the Drupal docroot, the
PHP-FPM socket) that need filling in for your actual server, and hasn't
been syntax-checked against a real nginx install (`nginx -t` before
reloading).

The template's `server` blocks each set `client_max_body_size 100M;` to
match `WORKER_MAX_UPLOAD_BYTES`'s default - but that's only in the example
file. If you copied an older version of it, or wrote your own host-level
config from scratch, check that directive is actually present: nginx's own
built-in default is just **1 MB**, so without it every upload above 1 MB is
rejected by your host nginx before the request ever reaches the containers
(`docker/nginx.conf`'s own `100m` and the worker's own limit never come into
play). Raise it in every `server` block that proxies to a viewer subdomain,
then `sudo nginx -t && sudo systemctl reload nginx`.

That template deliberately leaves the worker's `:8080` API off the public
domains - each viewer's own `docker/nginx.conf` already reverse-proxies
`/api/` and `/files/` to it, which is all a browser needs. Docker still
publishes `:8080` directly on the host's network interface either way
(`"8080:8080"` in `docker-compose.yml`), so it stays reachable from the
public internet on that raw port unless you also bind it to loopback via
`docker-compose.override.yml` (see
[`docker-compose.override.example.yml`](../docker-compose.override.example.yml)):

```yaml
services:
  worker:
    ports: !override
      - "127.0.0.1:8080:8080"
```

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
  first file part wins). Accepts, plus `.zip` archives containing one of them:
  - Blender importers via `scripts/convert.sh`: `abc dae fbx obj ply stl wrl x3d usd usda usdc usdz ifc blend gml glb`
  - converted without Blender by `scripts/convert_mesh.py` (needs `cascadio`, `trimesh`, `networkx`, installed in the image): `step stp iges igs 3mf`
  - kept as uploaded and served as-is, no GLB and no thumbnails (the viewer loads them itself): `gltf 3ds pcd xyz amf kmz vox lwo`, Gaussian splats `spz splat ksplat sog rad` and a `.ply` of splats (`f_dc_0`/`scale_0`/`rot_0` vertex properties)
  - Gaussian splats (other than `.rad`) also get a level-of-detail tree, `<name>-lod.rad` next to the upload, built by Spark's `build-lod` (`worker/splats.py`, in the image); `modelUrl` points to it. Without `build-lod`, or when it fails, the upload is served as it is and the viewer builds the tree on loading. Uploads without a tree (from before `build-lod`, or where it failed) get one with `docker compose exec worker python3 /app/worker/server.py admin rebuild-splats`; `--force` rebuilds the existing trees too (new `build-lod` or `WORKER_SPLAT_LOD_ARGS`, cached copies purged from Cloudflare when `WORKER_PUBLIC_HOSTS` is set), job ids limit it to those jobs. No restart needed: the model list reads the jobs from disk
  - point clouds converted to a streamed octree (`modelUrl` ends in `tiles/<name>/metadata.json` for Potree 2, `tiles/<name>/tileset.json` for 3D Tiles), no thumbnails: `las laz e57`, and a `ply` without faces - see "Point clouds" below

  Returns:
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
  already knows how to render: `queued` (waiting for a free conversion
  slot), `preparing`, `processing`, `rendering`, `ready`, `failed`.
  While a point cloud is converted, `previewUrl` points at its quick preview
  (`/files/<id>/tiles/<name>.preview.las`) as soon as that exists - see
  "Point clouds" below; `null` otherwise.
  `validation` is the summary of the model's validation report once it
  exists (`{"status": "ok"|"warning"|"error", "errors", "warnings",
  "validator"}`), `null` otherwise - see "Model validation" below. The same
  summary is on every job of `GET /api/jobs`.
- `GET /api/model/validation/<id>` - the job's full `validation.json`; 404
  for formats that are not validated and for jobs from before validation.
- `POST /api/model/create-from-url` - JSON `{"url": "https://.../model.glb"}`:
  the worker downloads the file (`remote_fetch.py`) and converts it like an
  upload (same formats, `WORKER_MAX_UPLOAD_BYTES`, limits and login). Only
  http(s) links to public addresses (private, loopback and link-local ones
  are refused, also after redirects, and the connection is pinned to the
  checked address); at most 5 redirects and 80 s, so proxies in front need a
  read timeout above that (`docker/nginx.conf` sets 120 s for this path).
- `POST /api/model/thumbnail` - the viewer's "Render preview" (the old
  `/api/editor/upload-thumbnail`, the Drupal module's route, still works): a
  multipart form with `path` (the model's folder, `/files/<id>/...`),
  `filename` (the model's name without extension) and a PNG in `data`, saved
  as `views/<filename>_side45.png` next to the model - the same file the
  Blender render and Drupal's `ThumbnailUploadController` write. Needs the
  rights of `DELETE /api/jobs/<id>` (with accounts on: the uploader or an
  admin).
- `POST /api/model/settings` - the viewer's "Save settings" (File menu): JSON
  `{"path": "/files/<id>/...", "filename": "<the model's file>", "content": {...}}`,
  saved as `metadata/<filename>_viewer.json` next to the model (position,
  rotation, scale, camera, lights, background, annotations) - the file and
  place of Drupal's `SaveMetadataController`. The viewer reads it back when
  the model opens; served with `Cache-Control: no-cache`, as it is rewritten
  in place. Same rights as the thumbnails.
- `POST /api/geo/places` - JSON `{"text": "Zamek w Malborku, XIV w."}`: the
  places the text names, found offline in GeoNames (`worker/geonames.py`),
  for the viewer's suggested scene - `{"places": [{"name", "country",
  "latitude", "longitude", "population", "timezone", "matched",
  "confidence"}]}`, most sure first, at most 3. `GET /api/geo/config` says
  whether it is on (`state`: `ready`, `building` while the index is built,
  `off`, `error`); off, the POST answers 404 (`503` while building). Open
  to everyone (nothing leaves the server, no key). See "Place search" below.
- `GET /files/<id>/...` - serves the converted model and rendered thumbnails.

## Configuration

Set via environment variables on the `worker` container (see
`worker/Dockerfile.base` for defaults):

| Variable                  | Default        | Meaning                                   |
|----------------------------|----------------|--------------------------------------------|
| `WORKER_PORT`              | `8080`         | HTTP listen port                          |
| `WORKER_JOBS_DIR`          | `/data/jobs`   | Where uploads/outputs are stored          |
| `WORKER_SKIP_RENDER`       | `false`        | Skip Blender thumbnail rendering          |
| `WORKER_MAX_UPLOAD_BYTES`  | `104857600`    | Upload size cap (100 MB); larger uploads get HTTP 413 |
| `WORKER_UPLOAD_CHUNK_BYTES` | `16777216`  | Piece size of an upload sent in pieces (16 MB): the viewer sends files this way (`/api/model/upload/start`, `PUT /api/model/upload/<id>?offset=N`, `.../finish`), so Cloudflare's 100 MB request limit (Free and Pro) does not cap uploads; keep it well below that. Unfinished uploads are deleted after a day |
| `WORKER_LIMIT_UPLOADS_PER_HOUR` / `_PER_DAY` | `20` / `100` | Uploads per account (per client IP with accounts off) in a rolling hour/day; HTTP 429 |
| `WORKER_LIMIT_STORAGE_MB`  | `0`            | Disk space an account's models may use (0 = unlimited); HTTP 507 |
| `WORKER_LIMIT_MAX_MODELS`  | `0`            | Models an account may own (0 = unlimited); HTTP 507 |
| `WORKER_LIMIT_CONCURRENT_JOBS` | `1`        | Uploads of one account/IP queued or converting at once; HTTP 429 |
| `WORKER_MAX_CONCURRENT_CONVERSIONS` | `2`   | Conversions running at once for everyone; further jobs wait as `queued` (0 = unlimited) |
| `WORKER_TRUSTED_PROXIES`   | `1`            | Reverse proxies appending to `X-Forwarded-For` (used for the client IP); `0` ignores the header |
| `CF_API_TOKEN`, `CF_ZONE_ID` | not set      | Cloudflare token (Zone > Cache Purge) and zone: deleting a model and re-rendering a thumbnail purge their cached copies (`cloudflare.py`); off when unset |
| `WORKER_PUBLIC_HOSTS`      | request host   | Viewer hostnames, comma-separated, purged for every one of them |
| `WORKER_AUTH_MODE`         | `off`          | `off` (open, as before) or `required` (upload/delete need a login) |
| `WORKER_AUTH_REGISTRATION` | `approval`     | `open` (instantly active), `approval` (admin must approve), `closed` |
| `WORKER_ADMIN_USER` / `WORKER_ADMIN_PASSWORD` | unset | Creates/resets an admin account on start (password >= 8 chars) |
| `WORKER_SMTP_HOST` (+ `_PORT`, `_SECURITY` = `starttls`\|`ssl`\|`none`, `_USER`, `_PASSWORD`, `_FROM`) | unset | Sends an email to a user when an admin approves their pending account; mail is off without the host |
| `WORKER_PUBLIC_URL`        | unset          | Viewer address included in that email     |
| `WORKER_AUTH_SECRET`       | generated      | Session-signing key; otherwise generated once into the volume |
| `WORKER_AUTH_SESSION_TTL`  | `604800`       | Login lifetime in seconds (7 days)        |
| `WORKER_CONVERT_TIMEOUT`   | `1800`         | Seconds before a convert.sh call is killed|
| `WORKER_RENDER_TIMEOUT`    | `900`          | Seconds before a render.sh call is killed |
| `WORKER_RENDER_DEVICE`     | `CPU`          | `CPU`, `GPU`, or `AUTO` - see below       |
| `WORKER_POINTCLOUD_JOBS`   | CPUs (max 8)   | Parallel py3dtiles workers for point clouds (PotreeConverter uses all cores) |
| `WORKER_POINTCLOUD_TIMEOUT` | `3600`        | Seconds before a point cloud conversion is killed |
| `WORKER_POINTCLOUD_PREVIEW_POINTS` | `1000000` | Points in a point cloud's quick preview; `0` disables it |
| `WORKER_POINTCLOUD_FORMAT` | `auto`          | `potree` (PotreeConverter), `3dtiles` (py3dtiles) or `auto`: Potree when installed |
| `WORKER_POINTCLOUD_CLASSIFY` | `off`         | Classify points before tiling (ground, vegetation, buildings, noise): `auto` (clouds without classes), `always`; Potree output only - see `worker/classify.py` and `docs/ai.md` |
| `WORKER_POINTCLOUD_CLASSIFIER` | `geometric` | `geometric` (built-in rules) or `command` (`WORKER_POINTCLOUD_CLASSIFIER_CMD` with `{input}` `{output}`, e.g. a trained model) |
| `WORKER_AI_ENABLED`        | `false`         | AI assistance through the Claude API (needs `ANTHROPIC_API_KEY`), see `docs/ai.md` |
| `WORKER_POTREE_CONVERTER`  | `PotreeConverter` | PotreeConverter executable (name on `PATH` or a path) |
| `WORKER_SPLAT_LOD`         | `auto`          | `auto`: Gaussian splats become a `.rad` level-of-detail file when `build-lod` is installed; `off`: kept as uploaded |
| `WORKER_SPLAT_LOD_BIN`     | `build-lod`     | Spark's build-lod executable (name on `PATH` or a path) |
| `WORKER_SPLAT_LOD_ARGS`    | `--quality`     | build-lod options, e.g. `--quality --max-sh=1` for smaller files without the higher spherical harmonics |
| `WORKER_SPLAT_LOD_TIMEOUT` | `1800`          | seconds per splat conversion |
| `WORKER_GZIP_MAX_BYTES`    | `268435456`    | Largest file served gzip-compressed (`static_files.py`); `0` turns compression off |
| `WORKER_VALIDATE`          | `true`         | Write `validation.json` for GLB/glTF models (see "Model validation") |
| `WORKER_GLTF_VALIDATOR_BIN` | `gltf_validator` | Khronos glTF-Validator executable (in the image); without it the report has no spec check |
| `WORKER_VALIDATE_TIMEOUT`  | `300`          | Seconds before a validator run is killed  |
| `WORKER_OPTIMIZE`          | `auto`         | gltfpack step (see "GLB optimization"): `auto` = on when `gltfpack` is installed (it is in the image), `true`, `false` |
| `WORKER_TEXTURE_FORMAT`    | `ktx2`         | `ktx2` (Basis Universal), `webp` or `keep` |
| `WORKER_PREVIEW_RATIO`     | `0.1`          | Triangle ratio of the progressive-loading preview; `0` disables previews |
| `WORKER_PREVIEW_TEXTURE_SIZE` / `_MAX_ERROR` / `_MIN_BYTES` | `512` / `0.05` / `2097152` | Preview texture limit (px), allowed simplification error, and the optimized model size below which no preview is made |

`SPATH` and `BLENDER_BIN` are set in the image itself (`/app`, `blender`) -
you don't need `scripts/.env` inside the container.

### Accounts (optional)

With `WORKER_AUTH_MODE=required`, uploading and deleting need a logged-in account, so you can see who uploads what. Browsing and serving finished models (`/api/jobs`, `/files/...`) stays public, so shared links keep working.

- Set the variables in a `.env` next to `docker-compose.yml` (e.g. `WORKER_AUTH_MODE=required`, `WORKER_ADMIN_USER=you`, `WORKER_ADMIN_PASSWORD=...`), then recreate the worker.
- Visitors register in the viewer's upload panel. With the default `approval` registration, new accounts stay *pending* until you approve them.
- Endpoints: `GET /api/auth/config`, `GET /api/auth/me`, `POST /api/auth/register|login|logout` (JSON `{username, password}`; the session is an HttpOnly, SameSite=Lax cookie, `Secure` when the proxy sends `X-Forwarded-Proto: https`). An app build runs on another origin and never gets that cookie: it logs in with `{"session": "token"}`, gets the same signed token back in the response (`token`) and sends it as `Authorization: Bearer <token>`. A failed login says `Unknown username.` or `Invalid password.`; five failed logins lock a username for five minutes.
- Every upload records its account, original filename and size in `<job>/owner.json`. Users can delete only their own uploads; admins can delete any. Jobs from before accounts were enabled are admin-only.
- Admins can correct who uploaded a model and when: on the admin pages, `/exadmin/` ("Edit" next to a model), or `POST /api/admin/jobs/<id>` with `{"owner": "alice", "createdAt": 1767225600}` (`owner: null` = no owner; `createdAt` in Unix seconds). It rewrites `<job>/owner.json`, so storage quotas move with the owner.
- Supervise from the command line (there is deliberately no admin HTTP API):

```bash
docker compose exec worker python3 /app/worker/server.py admin users
docker compose exec worker python3 /app/worker/server.py admin uploads
docker compose exec worker python3 /app/worker/server.py admin approve alice
# also: disable <user>, promote <user>, demote <user>, delete-user <user>
docker compose exec worker python3 /app/worker/server.py admin plan alice business 30   # grant Business for 30 days
docker compose exec worker python3 /app/worker/server.py admin plan acme enterprise      # grant Enterprise, no end
docker compose exec worker python3 /app/worker/server.py admin plan alice purchase      # drop the grant
docker compose exec worker python3 /app/worker/server.py admin rebuild-splats          # .rad for splat uploads without one (--force: all)
# a file too large for the proxies (Cloudflare lets 100 MB through on Free/Pro): copy it in, convert it
docker compose cp model.zip worker:/tmp/model.zip
docker compose exec worker python3 /app/worker/server.py admin import /tmp/model.zip --user alice
docker compose exec worker rm /tmp/model.zip
```

The viewer-side switch lives in the AIM3D manifest (`AIM3DViewer.viewer.auth`, see `viewer/manifesto/AIM3DViewer-schema.md`), but that only controls whether the login UI is shown - **the worker setting is what actually enforces access**, because a manifest is client-side data.

### GLB optimization and progressive loading

After conversion, `worker/optimize.py` runs [gltfpack](https://github.com/zeux/meshoptimizer) on the GLB: Meshopt-compressed geometry (`EXT_meshopt_compression`) and KTX2/Basis textures (`KHR_texture_basisu`), which the viewer decodes. For models of at least 2 MB it also writes `<name>.preview.glb` next to the model (about 10% of the triangles, textures of at most 512 px). The viewer shows that preview first and swaps in the full model once it has downloaded.

- Named nodes, materials and extras are kept (`-kn -km -ke`) so IFC element nodes and the scene hierarchy survive; positions and UVs stay floating point (`-vpf -vtf`).
- gltfpack cannot read Draco, so with optimization on, Blender exports without Draco. A Draco GLB uploaded as-is is served unchanged. On any gltfpack failure the unoptimized GLB is served as before.
- Only new conversions are optimized. Annotations store face indices, which gltfpack reorders, so do not re-run it on models that already have annotations.
- Standalone use, e.g. from the Drupal pipeline: `python3 worker/optimize.py model.glb --preview` (needs `gltfpack` on `PATH` or `WORKER_GLTFPACK_BIN`).
- Example: a 40.6 MB photogrammetry GLB became 6.7 MB, with a 1.4 MB preview, in about 6 s.

### Model validation

Every GLB/glTF model - converted, uploaded as GLB, or an uploaded `.gltf` with its files - is checked by `worker/validate.py`, which writes `<job>/validation.json` (served by `GET /api/model/validation/<id>`, not under `/files/`):

- `validator` - [Khronos glTF-Validator](https://github.com/KhronosGroup/glTF-Validator): spec conformance of the JSON, buffers and images. Issues are grouped by code (`code`, `level` = `error`/`warning`/`info`/`hint`, `count`, the first `message` and up to five JSON pointers). KTX2/WebP images, which the viewer decodes, are reported as info rather than warnings.
- `stats` - triangles, vertices, draw calls, materials, images and the largest texture size, animations, skins, morph targets, extensions.
- `bounds` - world-space bounding box of the default scene in metres (`min`, `max`, `size`).
- `checks` - the worker's own heuristics: no meshes (error), a model above 10 km (warning) or 1 km (info) across, or below 1 mm (wrong export units), above 10 M (warning) or 2 M (info) triangles, textures above 8192 px (warning) or 4096 px (info).
- `status` - `error` if the validator or a check found an error, `warning` for warnings, else `ok`; `summary` has the counts.

The source model is checked, before gltfpack: its Meshopt/KTX2 output is generated by the worker and the validator cannot look into those extensions. Validation never fails a job; with errors the status message says so (`Conversion finished - validation found 1 error(s)`). Point clouds, splats and the other viewer-native formats are not validated. Jobs converted before this have no report; `python3 worker/validate.py <model> <job>/validation.json` writes one (it also works standalone and prints the report).

### Place search

The viewer's suggested scene (Look > Suggested scene, `docs/ai.md`) puts the sun where the object stands. Where the manifest sets no place, it sends the texts it has (file name, metadata, manifest labels) to `POST /api/geo/places`, and `worker/geonames.py` finds the towns they name in a [GeoNames](https://www.geonames.org) dump (CC BY 4.0): offline, from a SQLite index.

- The image downloads `cities500` (every place of 500 people or more, about 200 000) and builds the index at build time; the build arg `GEONAMES_DATASET` picks another dump (`cities1000`, `cities15000`, a country such as `PL`, `allCountries` with castles and sites; empty: none). A failed download leaves the search off rather than failing the build.
- `WORKER_GEONAMES` - the dump files, comma-separated (`.txt` or `.zip`); empty turns the search off. `WORKER_GEONAMES_DB` - the index (default: next to the first file, else `<jobs dir>/.geonames.sqlite`). A missing or outdated index is built in the background on start (`state: building`), or by hand: `python3 worker/geonames.py build`; `python3 worker/geonames.py find "w Malborku"` tries a text.
- Matching: names without diacritics, with the alternate names in Latin script (Krakau, Cracow), Polish and German case endings stripped on both sides (`w Malborku`, `w Krakowie`, `pod Łęczycą`). A name counts when written with a capital; a short or common word (Zamek, Castle) only after a preposition (`w`, `in`, `bei`, `near`...), a single word otherwise only for a town (2 000 people; 5 000 at the start of a sentence, with a lower confidence). The larger place of a name wins, and one in a country the text names; places of the same name in other countries lower the confidence.

### Point clouds

`worker/pointcloud.py` turns LAS, LAZ, E57 and face-less PLY uploads into a level-of-detail octree that the viewer streams node by node (`viewer/tiles.js`) - only the points the current view needs are downloaded. Two output formats (`WORKER_POINTCLOUD_FORMAT`):

| | Potree 2 (default in the image) | 3D Tiles |
| --- | --- | --- |
| Converter | [PotreeConverter](https://github.com/potree/PotreeConverter) 2.1.1 (C++, built in `Dockerfile.base`) | [py3dtiles](https://py3dtiles.org) |
| Output | `tiles/<name>/metadata.json`, `hierarchy.bin`, `octree.bin` - three files | `tiles/<name>/tileset.json` + one `.pnts` per node |
| Kept per point | position, colour, intensity, classification, returns, point source | position, colour |
| Viewer reads | `octree.bin` by HTTP range requests | one file per node |
| Example (100 000 points) | about 1 s | about 2 s for 600 000 |

`auto` (default) uses PotreeConverter when it is installed and falls back to py3dtiles otherwise. Three files instead of thousands keep the file system and backups light, and the viewer's point cloud panel can colour Potree clouds by intensity and classification too.

- Inputs: PotreeConverter reads LAS and LAZ itself; for py3dtiles LAZ is decompressed with `laspy` + `lazrs` first (py3dtiles would need the external LAStools `laszip`). E57 scans are merged with their poses applied (`pye57`), keeping colour and intensity; PLY point clouds are read with `trimesh` - both to an intermediate LAS for either converter.
- Coordinates are kept as they are (no reprojection); the viewer centres the cloud and turns Z-up to Y-up. Projected coordinates (UTM, Gauss-Krüger: millions of metres) are told apart from Earth-centred ones by the viewer (`viewer.tiles.georeferenced`).
- Potree nodes are stored uncompressed (`--encoding DEFAULT`): the viewer's Potree loader reads no BROTLI nodes. Transfers are compressed by the server (below) where it helps.
- **Quick preview**: before the converter starts, a random subsample of the cloud (`WORKER_POINTCLOUD_PREVIEW_POINTS`, default 1 million) is written to `tiles/<name>.preview.las` - uncompressed and in random order, with the standard dimensions of the point format (position, intensity, classification, colour). The job status then carries `previewUrl`, and the viewer's upload panel shows the preview while the octree is built: it decodes LAS while downloading, and since the points are shuffled, the first 100 000 already show the whole object. When the job is `ready`, the streamed cloud replaces it. The preview is written in chunks (larger-than-memory clouds are fine) and takes well under a second for a few million points; a failed preview is only logged. It stays next to the tiles.
- py3dtiles runs with `--disable-processpool`, since Docker's default 64 MB `/dev/shm` is too small for its shared-memory pool.
- Standalone: `python3 worker/pointcloud.py scan.e57 out_dir` (needs `PotreeConverter` or `py3dtiles`, `laspy[lazrs]`, `pye57`, `trimesh`); `WORKER_POINTCLOUD_FORMAT=3dtiles` for 3D Tiles.
- LAS/LAZ files can also be opened in the viewer directly, without conversion (decoded in a Web Worker, thinned above `viewer.pointCloud.maxPoints`) - see [docs/point-clouds.md](../docs/point-clouds.md).

### Serving converted files

`GET`/`HEAD /files/<id>/<path>` (`worker/static_files.py`):

- **Range requests** (one range per request): `206 Partial Content` with `Content-Range`, `416` when out of bounds - Potree clouds are read this way, and large downloads can resume. CORS lets the viewer send `Range` and read `Content-Range`.
- Files go out in 1 MB pieces, never read into memory whole.
- `ETag` and `Last-Modified`; `If-None-Match` / `If-Modified-Since` answer `304`. Cached for 30 days (browsers, Cloudflare); job ids are random, so a URL never changes content.
- **gzip** for formats that are not compressed already (JSON, LAS, `.pnts`/`.b3dm`, OBJ, PLY, STL, IFC, Potree's `hierarchy.bin` ...) when the client accepts it and asks for the whole file. The compressed copy (`<file>.gz`, next to it) is made in the background on the first request - which still gets the plain file, so nobody waits - and used from then on; files that shrink by less than 10 % are marked (`<file>.nogz`) and not tried again. Example: a 1-million-point preview LAS of 2.6 MB goes out as 1.1 MB. `WORKER_GZIP_MAX_BYTES` (default 256 MB, `0` = off) caps the size compressed. Range requests, GLB, LAZ, PNG and Potree's `octree.bin` are sent as they are.
- Behind the viewer's nginx (`docker/nginx.conf`), `/files/` responses are cached; `octree.bin` and the `.rad` trees of Gaussian splats (paged by the viewer, `viewer/splats.js`) are fetched and cached in 1 MB slices, so a range request never waits for nginx to copy the whole file first. Cloudflare caches files up to its size limit (512 MB on the free plan) and answers ranges from them; a larger `octree.bin` or `.rad` is passed through to the origin.

### Upload limits

`POST /api/model/create` checks the limits above before reading the upload and again, atomically, before the job is created. A rejected upload gets a JSON body `{"error", "code", "limit", "retryAfter"}` (`code`: `rate_hour`, `rate_day`, `concurrent`, `storage`, `models`) and, for 429s, a `Retry-After` header; the upload panel shows it translated, together with the caller's current usage.

- `0` disables a limit. Admin accounts are never limited.
- With accounts on, limits are per account and admins can override any of them per account: on the admin pages, `/exadmin/` ("Edit limits"), `POST /api/admin/users/<user>/limits` with e.g. `{"maxModels": 10, "storageMb": null}` (`null` = back to the default), or the CLI below.
- With accounts off, the rate and concurrency limits apply per client IP; storage and model quotas need accounts (anonymous uploads have no owner). The client IP is taken from `X-Forwarded-For`, `WORKER_TRUSTED_PROXIES` entries from the right: `1` behind the viewer's own nginx, `2` with `docker/host-nginx.example.conf` in front. Anyone who can reach the worker's port directly can forge that header, so do not publish port 8080 when you rely on per-IP limits.
- The upload log (`JOBS_DIR/.limits/uploads.json`) survives restarts, and deleting a model does not give an upload back. Storage counts everything in the account's job folders (upload, conversion output, thumbnails).
- `GET /api/limits` returns the caller's effective limits and usage; `GET /api/admin/users` includes both for every account.

```bash
docker compose exec worker python3 /app/worker/server.py admin usage
docker compose exec worker python3 /app/worker/server.py admin limits alice
docker compose exec worker python3 /app/worker/server.py admin limits alice storageMb=2048 maxModels=default
```

#### Business plan

Admins can grant an account a plan on the admin pages, `/exadmin/` ("Change plan"), with `POST /api/admin/users/<user>/plan` `{"tier": "pro"|"business"|"enterprise"|null, "expiresAt": <unix seconds>|null}` or `admin plan` above (stored in `users.json` as `planGrant`). **Enterprise** is only granted this way (its price is agreed individually, it is not sold in the app); it includes everything in Business. An account with Business or Enterprise gets these limits for everything it uploads instead of the defaults (for Enterprise, set the agreed values as the account's overrides); an admin's per-account overrides still win, and the admin pages show the Business values as that account's defaults. `GET /api/auth/me` returns the plan (`plan`), shown next to the signed-in name.

| Variable | Default | |
|---|---|---|
| `WORKER_LIMIT_BUSINESS_UPLOADS_PER_HOUR` / `_PER_DAY` | `100` / `500` | |
| `WORKER_LIMIT_BUSINESS_CONCURRENT_JOBS` | `3` | |
| `WORKER_LIMIT_BUSINESS_STORAGE_MB` / `_MAX_MODELS` | the account defaults | |

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
tarball it installs (see `worker/Dockerfile.base`) bundles its own Cycles GPU
kernels; only the NVIDIA driver's userspace libraries need to reach the
container, which is what the toolkit above provides.

## Known limitations (MVP)

- Job state lives in memory only; restarting the container loses in-flight
  and completed job records (the output files on the `worker-jobs` volume
  survive, only the status lookup by id is lost).
- Archive support covers `zip`, `rar`, `tar`, `gz`, `xz` (`zip` via an
  in-process, path-traversal-checked extractor; the rest by shelling out to
  `scripts/uncompress.sh`, already baked into this image - `unrar-free` and
  `tar` are installed in `worker/Dockerfile.base` for this). `scripts/convert.sh`
  itself has no built-in archive handling; that logic normally lives in
  `ConvertWorker.php` on the Drupal side, so this worker reimplements
  first-supported-file detection after extraction to be useful standalone.
- Uploads are buffered fully in memory before being written to disk; fine for
  the sizes this pipeline already deals with, but not streaming.
