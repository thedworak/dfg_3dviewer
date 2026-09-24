# Standalone Docker setup

The conversion pipeline (Blender + Python + `scripts/convert.sh`/`scripts/render.sh`) can also run without Drupal, as a small HTTP worker, alongside a static build of the viewer:

```bash
docker compose up --build
```

This starts one shared conversion API on `:8080`, plus three viewer endpoints — each a static build fronted by nginx, reverse-proxying to that same worker (same-origin, no CORS/config needed):

| Service          | Port   | Build          | Notes |
|------------------|--------|----------------|-------|
| `viewer-test`    | `:3000`| `dist/test`    | `npm run build:test` |
| `viewer-dev`     | `:3001`| `dist/dev`     | `npm run build:dev` |
| `viewer-sandbox` | `:3002`| `dist/test`    | same build as `viewer-test`, but opens straight into drag-and-drop upload mode (`viewer/sandbox.js`) — normally reached via `?sandbox=1` on any build, baked on here by default |

## Docker profiles (settings from an AIM3D manifest)

Each viewer image takes its settings from an AIM3D manifest instead of a hand-edited `viewer-settings.json`. The three profiles live in [`docker/profiles/`](../docker/profiles/) and are selected with the `VIEWER_PROFILE` build arg:

| Profile   | File                                   | Used by          | Difference |
|-----------|----------------------------------------|------------------|------------|
| `test`    | `docker/profiles/test.manifest.json`    | `viewer-test`    | baseline settings |
| `dev`     | `docker/profiles/dev.manifest.json`     | `viewer-dev`     | adds the gradient `background` |
| `sandbox` | `docker/profiles/sandbox.manifest.json` | `viewer-sandbox` | `viewer.sandbox: true` (drag-and-drop mode) |

At build time the profile is validated (`node scripts/validate-docker-profiles.mjs [profile]`, so a broken profile fails the build), installed as `manifests/docker-profile.json`, and `viewer-settings.json` is pointed at it (`entity.metadata.sourceType = AIM3IF`, `url = manifests/docker-profile.json`). `viewer-settings.json` remains the fallback for anything the profile doesn't define; see `viewer/manifesto/AIM3DViewer-schema.md` for precedence and which keys apply at startup (`editor`, `lightweight`, `sandbox`, `presentationMode`). To build one image by hand:

```bash
docker build -f Dockerfile.viewer --build-arg BUILD_TARGET=dev --build-arg VIEWER_PROFILE=dev -t dfg-3dviewer-viewer-dev .
```

## Helper script: `scripts/docker.sh`

A small wrapper around `docker compose` for the everyday operations. Requirements: Docker with the Compose plugin, run from anywhere (the script switches to the repo root itself).

```bash
scripts/docker.sh <command> [profile] [--up]
scripts/docker.sh                # no arguments: interactive menu
scripts/docker.sh --help
```

**Commands**

| Command   | What it does |
|-----------|--------------|
| `build`   | Builds the image(s). |
| `down`    | Stops and removes the container(s); volumes (settings, converted models) are kept. |
| `rebuild` | `down`, then `build`. Use this after changing code, a profile manifest or `.env`. |
| `prune`   | `docker system prune` (unused containers, networks, dangling images). Docker asks for confirmation first; the script does not force it. |

**Profile** (optional): `dev`, `test` or `sandbox` - acts only on that service (`viewer-dev`, `viewer-test`, `viewer-sandbox`) and builds it with the matching manifest from `docker/profiles/`. Without a profile, `build` and `down` act on everything, including the shared `worker`. `prune` ignores the profile.

**`--up`** (with `build` or `rebuild`): starts the result afterwards (`docker compose up -d`). Without it, images are built but nothing is started.

**Output**: each step prints a green `✔` line saying what just happened (e.g. `✔ Image for viewer-dev built (profile: dev)`). `build`/`rebuild` end with the URLs the services are available on. After `--up` they are read from Docker, so port remaps from `docker-compose.override.yml` are shown correctly; without `--up` the defaults are listed as "once started":

```text
>> Available on:
   viewer-sandbox  http://localhost:3002
```

Default ports: `viewer-test` 3000, `viewer-dev` 3001, `viewer-sandbox` 3002, `worker` 8080.

**Examples**

```bash
scripts/docker.sh build                  # all images
scripts/docker.sh rebuild sandbox --up   # rebuild and start just the sandbox viewer
scripts/docker.sh down dev               # remove only the dev viewer container
scripts/docker.sh down                   # remove everything (volumes are kept)
scripts/docker.sh prune                  # free disk space, asks first
```

**Notes**
- The profile is passed to `docker-compose.yml` as the `VIEWER_PROFILE` variable (`${VIEWER_PROFILE:-<default>}` in each service's build args); the compose file itself is never rewritten. A `VIEWER_PROFILE` already exported in your shell therefore also affects plain `docker compose build`.
- Compose variables such as `WORKER_AUTH_MODE` or `WORKER_ADMIN_USER` come from a `.env` file next to `docker-compose.yml` (git-ignored). After editing it, run `scripts/docker.sh rebuild --up`.
- Existing settings volumes keep their old `viewer-settings.json`; see the volume note under "Docker profiles" above.

## Publishing for a portfolio (cheap static hosting)

Instead of exposing the conversion worker publicly, export the finished models and host them statically:

```bash
docker compose cp worker:/data/jobs ./jobs-export
python3 scripts/export-static.py --jobs-dir ./jobs-export --out ./static-export --base-url https://models.example.com
```

This copies each GLB and its renders and writes an AIM3D manifest per model (view-only: editor off, no worker dependency), plus `index.json`. `--only <job-id>` and `--owner <account>` narrow the selection. Upload the folder to any static host (Cloudflare R2/Pages, GitHub Pages, ...) with a long `Cache-Control`; `--base-url` must be the public URL it will be served from. Validate a result with `node scripts/validate-docker-profiles.mjs static-export/manifests/<name>.json`.

## Upload limit and accounts

Uploads are capped at 100 MB by default (`WORKER_MAX_UPLOAD_BYTES` in `docker-compose.yml`, mirrored by `client_max_body_size` in `docker/nginx.conf`); larger files get HTTP 413 and the upload panel shows the worker's limit. Upload counts, per-account storage/model quotas and concurrent conversions are limited too (`WORKER_LIMIT_*`, `WORKER_MAX_CONCURRENT_CONVERSIONS`; admins can override them per account in the user panel) - see "Upload limits" in [`worker/README.md`](../worker/README.md). To see and control who uploads, enable optional accounts (`WORKER_AUTH_MODE=required` in a `.env` file: registration with admin approval, per-upload ownership, admin CLI) - see "Accounts" in [`worker/README.md`](../worker/README.md). The manifest option `AIM3DViewer.viewer.auth` only shows/hides the login UI; the worker enforces access.

Both `viewer-settings.json` and the profile manifest are persisted in the service's settings volume and seeded only on first start, so edits survive rebuilds. **Existing volumes** keep their old `viewer-settings.json` (without the manifest pointer) and will not pick up the profile until you delete the volume (`docker compose down -v` for that service) or add the two `entity.metadata` values yourself. The `dev` build still loads IIIF models (that build forces the IIIF source); it only takes its settings from the profile.

See [`worker/README.md`](../worker/README.md) for the worker's API contract/configuration, and how to add a fourth `dist/prod` service the same way. Each viewer's main menu gets an "Upload & convert" button in this mode, driving the same pipeline through the browser. This is additive — the existing Drupal-integrated pipeline (`ConvertWorker` queue plugin, `scripts/worker.sh`, `drush`) is untouched and keeps working as-is for the current instance.

The Drupal module can also optionally be pointed at the `worker` container instead of running Blender locally — set the module's "Conversion backend" to Docker and give it the worker's URL — without changing anything else about the module's own upload/queue/field workflow. See "Using this worker from the Drupal module" in [`worker/README.md`](../worker/README.md).
