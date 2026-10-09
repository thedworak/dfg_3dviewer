# Bug reports and error tracking (GlitchTip)

The editor toolbar has a **Report a bug** button (`viewer/bug-report.js`). Where the report goes depends on the settings:

- **GlitchTip configured** (`viewer.errorTracking.dsn`): the button opens a short form (description, optional e-mail, technical details). The report is sent to GlitchTip as an issue titled `User report: …`, tagged `user_report:true`. Uncaught JavaScript errors are also sent automatically, unless `autoCapture` is `false`.
- **Not configured**: the button opens a new GitHub issue, pre-filled with the same technical details (`viewer.bugReport.url` points it at another tracker).

[GlitchTip](https://glitchtip.com) is open source and accepts data from the Sentry SDK (`@sentry/browser`), so reports stay on your own server. The viewer loads the SDK as a separate chunk, and only when a DSN is set.

## 1. Run GlitchTip

In `.env` next to `docker-compose.glitchtip.yml`:

```sh
GLITCHTIP_DOMAIN=https://glitchtip.example.org
GLITCHTIP_SECRET_KEY=...        # openssl rand -hex 32
GLITCHTIP_DB_PASSWORD=...       # openssl rand -hex 16
# Optional:
# GLITCHTIP_EMAIL_URL=smtp://user:password@smtp.example.org:587
# GLITCHTIP_FROM_EMAIL=glitchtip@example.org
# GLITCHTIP_PORT=8000
# GLITCHTIP_EVENT_RETENTION_DAYS=90
```

```sh
docker compose -f docker-compose.glitchtip.yml up -d
```

It runs as its own compose project (`glitchtip`): Postgres plus one GlitchTip container in `all_in_one` mode, without Valkey. That needs roughly 256–512 MB of RAM.

The container listens on `127.0.0.1:8000` only. Put the host's HTTPS proxy in front of it: a viewer served over HTTPS cannot send to plain HTTP. For example, next to `docker/host-nginx.example.conf`:

```nginx
server {
    listen 443 ssl;
    server_name glitchtip.example.org;
    # ssl_certificate ... (e.g. certbot)
    client_max_body_size 20m;
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 2. Create the project

1. Open `GLITCHTIP_DOMAIN`, register the first account and create an organization. Registration then closes by itself: invite other people from the organization settings (or set `GLITCHTIP_ENABLE_REGISTRATION=True`).
2. Create a project (platform: JavaScript). Its **DSN** is under *Settings → Projects → (project) → Client keys*.

One project for both the web viewer and the app is enough; events carry `environment` and a `platform` tag (`app` / `web`).

## 3. Point the viewer at it

**Web (`viewer-settings.json`):**

```json
"viewer": {
  "errorTracking": {
    "dsn": "https://<key>@glitchtip.example.org/<project id>",
    "environment": "production",
    "autoCapture": true,
    "sampleRate": 1
  }
}
```

| Key | Default | Meaning |
|---|---|---|
| `dsn` | – | Project DSN; without it error tracking is off. |
| `environment` | `app` in the app, otherwise the build (`test`, `dev`, `prod`, …) | Shown and filterable in GlitchTip. |
| `autoCapture` | `true` | `false`: send only reports submitted with the button, not uncaught errors. |
| `sampleRate` | `1` | Share of automatic error events sent (0–1). |

`viewer.bugReport.enabled: false` hides the button.

## What is sent

- **User reports:** the description, the e-mail if given, and, when the box is ticked: build (commit hash, also used as the release), app/web, page URL (web only), model file name, language, browser/OS (user agent), screen size, GPU name and the last five JavaScript errors.
- **Automatic errors:** the stack trace, browser/OS, page URL and the SDK's breadcrumbs (recent clicks, console messages, network requests). `sendDefaultPii` is off, so no IP address or cookies are attached by the SDK. GlitchTip itself may still log the client IP of incoming requests.

## Limits

- Stack traces are minified. Source maps are built for web builds (`dist/*/assets/*.js.map`) but not uploaded to GlitchTip yet. For readable traces, upload them per release with `sentry-cli` (GlitchTip supports its sourcemaps API).
