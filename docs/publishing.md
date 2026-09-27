# Publishing to production

A checklist of what has to be set or changed before a release. Anything left at its default here is safe for testing and wrong for production. Details for each part are in the linked pages.

Order matters when the app and the server change together: **deploy the server first, then publish the app.** The app's plans panel calls worker endpoints (`/api/app/link|sync|unlink`) that an older worker answers with 404.

## 1. Server (worker and web viewer)

Set these in `.env` next to `docker-compose.yml` on the server (never in `docker-compose.yml` itself, which is in git), then `docker compose up -d --build`.

### Must set

| Variable | Production value | Why |
|---|---|---|
| `WORKER_APP_PLANS_UNVERIFIED` | `false` (the default) - **never `true`** | `true` makes the worker trust the plan the app reports, so anyone can claim Business |
| `WORKER_REVENUECAT_SECRET_KEY` | RevenueCat **secret** API key (`sk_...`) | Without it: no Business limits for app users, and linking a purchase to an account answers 503 |
| `WORKER_ADMIN_PASSWORD` | a long, unique password | The bootstrap admin (`WORKER_ADMIN_USER`) is created or **reset to this password on every start** |
| `WORKER_AUTH_MODE` | `required` | Accounts, upload limits per account and app plans on accounts need it; `off` leaves uploading open to anyone |
| `WORKER_TRUSTED_PROXIES` | `1` behind the bundled nginx only; `2` with a host nginx / Cloudflare-terminating proxy in front (see `docker/host-nginx.example.conf`) | A wrong value makes per-IP limits count the proxy instead of the visitor (or lets visitors fake their IP) |

### Check

| Variable | Default | Note |
|---|---|---|
| `WORKER_AUTH_REGISTRATION` | `approval` | `open` lets accounts upload right after registering |
| `WORKER_AUTH_SECRET` | generated into the volume | Set it only if the volume can be lost or several workers share sessions |
| `WORKER_SMTP_*`, `WORKER_PUBLIC_URL` | unset (no mail) | Needed for the "account approved" email |
| `WORKER_LIMIT_*` | 20/h, 100/day, 1 concurrent | Free/Pro accounts and anonymous (per IP) uploads |
| `WORKER_LIMIT_BUSINESS_*` | 100/h, 500/day, 3 concurrent | Business: app users and accounts with Business linked |
| `WORKER_REVENUECAT_BUSINESS_ENTITLEMENT` / `_PRO_ENTITLEMENT` | `business` / `pro` | Must match the entitlement ids in RevenueCat |
| `WORKER_MAX_UPLOAD_BYTES` | 100 MB | Keep `client_max_body_size` in `docker/nginx.conf` in step |

Everything the worker reads is described in [`worker/README.md`](../worker/README.md).

### Deploy pipeline

Pushing to `main` or `stable-release` deploys automatically (`.github/workflows/deploy.yml`, self-hosted runner). Before the first deploy:

- repository variables `DEPLOY_PATH_MAIN` / `DEPLOY_PATH_STABLE` point at the checkouts on the server,
- repository secrets `CF_API_TOKEN` (Zone > Cache Purge), `CF_ACCOUNT_ID` and `CF_ZONE_ID` are set - the workflow fails without them.

### After deploying

- Log in as the admin and open **Manage users**: the list loads, and linked app plans show next to user names.
- `curl -X POST https://<server>/api/app/sync -H 'X-App-User-Id: test:1'` answers `{"user": null, "plan": null}`. A 404 means the old worker is still running, or accounts are off (`{"error": "Accounts are not enabled."}`).
- `docker compose exec worker python3 /app/worker/server.py admin usage` shows the expected limits.

## 2. Android app

### Store accounts (once)

Follow "Going live" in [`mobile-monetization.md`](mobile-monetization.md):

1. **Google Play Console**: the app, the one-time product `explora_pro` (20 €) and the subscription `explora_business_monthly` (20 € per month).
2. **RevenueCat**: the Play app, entitlements `pro` and `business`, and the offering `default` with a Lifetime and a Monthly package.
3. **AdMob**: the app, an adaptive banner and an interstitial ad unit, and the GDPR consent message (Privacy & messaging).

The prices charged are the ones set in Play Console. The app shows the store's price once it answers; its fallback (`DEFAULT_PRICES` in `viewer/monetization/plan.js`, 20 €) only shows until then, so keep it in step with Play Console.

### Build variables

The defaults build a **test** app: Google's test ads, no store, and a "force plan" selector in the plans panel. A release build must set all of these:

| Variable | Release value | Default (test) |
|---|---|---|
| `MOBILE_MONETIZATION_TESTING` | `false` | `true`: test ads, anyone can force any plan |
| `MOBILE_REVENUECAT_API_KEY` | RevenueCat **public** Google key (`goog_...`) | empty: store off, buying disabled |
| `MOBILE_ADMOB_BANNER_ID` | `ca-app-pub-xxx/yyy` | Google test unit |
| `MOBILE_ADMOB_INTERSTITIAL_ID` | `ca-app-pub-xxx/zzz` | Google test unit |
| `-PadmobAppId` (Gradle) | `ca-app-pub-xxx~nnn` (the app id, with `~`) | Google's test app id |
| `MOBILE_REMOTE_URL` | the production repository | `https://viewer.thedworak.com` (set in `package.json` `build:mobile`) |

```bash
MOBILE_MONETIZATION_TESTING=false \
MOBILE_REVENUECAT_API_KEY=goog_xxx \
MOBILE_ADMOB_BANNER_ID=ca-app-pub-xxx/yyy \
MOBILE_ADMOB_INTERSTITIAL_ID=ca-app-pub-xxx/zzz \
pnpm run cap:sync
cd android && ./gradlew bundleRelease -PadmobAppId=ca-app-pub-xxx~nnn
```

Check the result before uploading: `dist/mobile/viewer-settings.json` must have `"testing": false`, a non-empty `revenuecat.apiKey` and no `3940256099942544` (Google's test publisher id) in the AdMob ids.

### Version and signing

- Raise `versionCode` (every upload) and `versionName` in `android/app/build.gradle`. Play rejects a `versionCode` it has seen.
- Sign the bundle with the upload key. `android/app/build.gradle` has no `signingConfigs` yet, so either add one that reads the keystore from `~/.gradle/gradle.properties` (never commit the keystore or its passwords) or sign in Android Studio (Build > Generate Signed Bundle). Keep the upload key backed up: Play App Signing holds the app key, but a lost upload key has to be reset through Google support.
- `appId` (`com.thedworak.explora4d`) must never change after the first upload.

### Play Console listing

- Privacy policy URL (required: ads and purchases).
- Data safety form: advertising ID, purchase history, and the account user name and password sent when linking a plan to an account.
- Content rating questionnaire, target audience, and the "contains ads" declaration.
- Test the release on an internal testing track with a licence tester account first: buy Pro, subscribe to Business, restore purchases, link to an account and check the plan in the admin panel.

## 3. Web viewer settings

- `viewer-settings.json` / the Docker profile manifest (`docker/profiles/*.manifest.json`): production URLs, and `editor`/`sandbox` as intended for the public site. See [`viewer-settings.md`](viewer-settings.md) and [`docker.md`](docker.md).
- Web builds have no plans, ads or locks. Nothing from the app's monetization needs setting there.
