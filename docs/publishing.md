# Publishing to production

A checklist of what has to be set or changed before a release. Anything left at its default here is safe for testing and wrong for production. Details for each part are in the linked pages.

## 1. Server (worker and web viewer)

Set these in `.env` next to `docker-compose.yml` on the server (never in `docker-compose.yml` itself, which is in git), then `docker compose up -d --build`. [`.env.example`](../.env.example) lists every variable with its default: `cp .env.example .env` and fill it in. Only variables passed in `docker-compose.yml` reach the worker - anything else in `.env` is ignored.

### Must set

| Variable | Production value | Why |
|---|---|---|
| `WORKER_ADMIN_PASSWORD` | a long, unique password | The bootstrap admin (`WORKER_ADMIN_USER`) is created or **reset to this password on every start** |
| `WORKER_AUTH_MODE` | `required` | Accounts and upload limits per account need it; `off` leaves uploading open to anyone |
| `WORKER_TRUSTED_PROXIES` | `1` behind the bundled nginx only; `2` with a host nginx / Cloudflare-terminating proxy in front (see `docker/host-nginx.example.conf`) | A wrong value makes per-IP limits count the proxy instead of the visitor (or lets visitors fake their IP) |

### Check

| Variable | Default | Note |
|---|---|---|
| `WORKER_AUTH_REGISTRATION` | `approval` | `open` lets accounts upload right after registering |
| `WORKER_AUTH_SECRET` | empty: generated into the `worker-jobs` volume | Set it only if the volume can be lost (everyone would be logged out) or several workers share sessions |
| `WORKER_SMTP_*`, `WORKER_PUBLIC_URL` | unset (no mail) | Needed for the "account approved" email |
| `WORKER_LIMIT_*` | 20/h, 100/day, 1 concurrent | Accounts and anonymous (per IP) uploads |
| `WORKER_LIMIT_BUSINESS_*` | 100/h, 500/day, 3 concurrent | Accounts with the Business plan (granted by an admin) |
| `WORKER_MAX_UPLOAD_BYTES` | 100 MB | Keep `client_max_body_size` in `docker/nginx.conf` (and in a host nginx) in step |

Everything the worker reads is described in [`worker/README.md`](../worker/README.md).

### Viewer settings on the server

Each viewer service copies its `viewer-settings.json` and profile manifest into its settings volume on the first start (`docker/viewer-entrypoint.d/10-persist-viewer-settings.sh`) and keeps using that copy, so a rebuild does not change them - edit them there, e.g. `docker compose exec viewer-test vi /data/viewer-config/viewer-settings.json`. The example settings they start from still have placeholders and test values:

| Key | Example value | Production |
|---|---|---|
| `mainUrl`, `entity.exportViewerUrl` | `https://your.domain.com` | The public address of the site |
| `viewer.credits.logo.url` | `https://your-domain.com` | Your site, or remove the link |
| `viewer.gallery.buildFake` | `true`: placeholder "Preview 1-9" images for models without renders | `false`, with `viewer.gallery.build: true` - converted models keep their gallery (the worker's renders) |
| `viewer.errorTracking.dsn` | not set: bug reports and crashes go nowhere | The GlitchTip project DSN ([`error-tracking.md`](error-tracking.md)) |

Also check the profile manifest (`VIEWER_PROFILE`, `docker/profiles/*.manifest.json`): all three profiles have `editor: true`, and `sandbox` turns the site into drag-and-drop mode.

### After deploying

- Log in as the admin and open **Manage users**: the list loads.
- `docker compose exec worker python3 /app/worker/server.py admin usage` shows the expected limits.

## 2. Web viewer settings

- `viewer-settings.json` / the Docker profile manifest (`docker/profiles/*.manifest.json`): production URLs, no placeholder gallery, error tracking, and `editor`/`sandbox` as intended for the public site - see "Viewer settings on the server" in section 1, [`viewer-settings.md`](viewer-settings.md) and [`docker.md`](docker.md).
