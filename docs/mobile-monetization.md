# Mobile app: plans and ads

The Android app (Capacitor, `pnpm run build:mobile`; the same bundle is prepared for iOS, see [iOS](#ios)) has three plans:

| Plan | Price | What it adds |
|---|---|---|
| Free | free | Everything for viewing, with ads: a banner along the bottom and a full-screen ad after every 3rd model (at most once per 3 minutes, never for the first model) |
| Pro | 20 €, one-time purchase | No ads |
| Business | 20 € per month, subscription | No ads, browsing the models on the repository (viewer.thedworak.com; the other plans have the models on the device, uploading works on every plan), higher upload/conversion limits on the repository, a custom repository address, annotations (including IIIF import/export) and the materials editor |

The prices in the plans panel are the store's (localized) once it answers; until then, and in builds without the store, it shows 20 € (`DEFAULT_PRICES` in `plan.js`, or `mobile.monetization.prices` in the settings). The price actually charged is the one set in Google Play Console.

Whatever the current plan does not include carries the same lock as the locked toolbar tools: the features on the plan cards (on the Free card, what Free lacks), the toolbar tools, "Remote" in the models panel's device/remote switch and the repository address field. A tap on a locked tool, tab or field opens the plans panel. Browsing is locked in the app only: `GET /api/jobs` stays public, since the web viewer uses it.

Web builds are not affected: they have no plans, no ads and nothing locked.

## How it fits together

- `viewer/monetization/plan.js`: the current plan and what each plan unlocks (`FEATURES`, `LOCKED_TOOLS`). Changing a plan's features is an edit there. The plan comes from RevenueCat entitlements (`pro`, `business`) and is remembered on the device, so the app starts offline with the last known plan.
- `viewer/monetization/ads.js`: AdMob (`@capacitor-community/admob`), with Google's consent form (UMP) before any ad in the EEA/UK. The page leaves room for the banner, so the toolbar sits above it.
- `viewer/ui/plans-panel.js`: the plans panel (crown button in the header): prices from the store, buy/subscribe, restore purchases, ad privacy options. Locked toolbar tools show a lock and open this panel.
- `viewer/monetization/account-link.js`: links the purchase to an account on the repository (plans panel, "Account"). The worker verifies the plan with RevenueCat and stores it on the account; the admin panel and the account panel show it next to the user name, and a Business account gets the Business limits for uploads from the browser too. See `worker/README.md`, "App plans linked to accounts".
- `worker/entitlements.py`: Business limits on the repository and the plan of linked accounts. The app sends its RevenueCat app user id in `X-App-User-Id`, and the worker checks it with RevenueCat (see `worker/README.md`, "Business plan of the mobile app").

## Test build (default)

Without any setup the build uses Google's AdMob test units (test ads are shown) and no RevenueCat key: the store is off and buying is disabled. The plans panel then has a "Test: force plan" selector to try each plan without buying it.

## Going live

The full pre-release checklist (server settings, signing, Play Console listing) is in [`publishing.md`](publishing.md).

1. **Google Play Console** - create the app, then:
   - in-app product (one-time) `explora_pro`,
   - subscription `explora_business_monthly` with a monthly base plan.
2. **RevenueCat** - add the Play app (service account credentials), import both products, and create:
   - entitlements `pro` (product `explora_pro`) and `business` (product `explora_business_monthly`),
   - an offering `default` (current) with a Lifetime package (`explora_pro`) and a Monthly package (`explora_business_monthly`).
3. **AdMob** - create the app and two ad units: an adaptive banner and an interstitial. Set up the GDPR message (Privacy & messaging) for the consent form.
4. **Build the release:** fill in the `MOBILE_*` part of `.env` (see `.env.example`: RevenueCat public key, AdMob app id and ad units, GlitchTip DSN), then
   ```bash
   scripts/build-android-release.sh
   ```
   It refuses test values, checks the synced settings and builds the signed bundle; the AdMob *app* id (with `~`) goes to Gradle, without it the manifest keeps Google's test app id. The manual commands are in `docs/publishing.md`, "Build variables".
5. **Worker** - set `WORKER_REVENUECAT_SECRET_KEY` (RevenueCat v2 secret key, read-only Customers + Entitlements) and `WORKER_REVENUECAT_PROJECT_ID` in `.env` (see `.env.example`) next to `docker-compose.yml` and restart the worker.

| Build variable | Default | |
|---|---|---|
| `MOBILE_MONETIZATION_TESTING` | `true` | `false` for release: real ads, no plan override |
| `MOBILE_REVENUECAT_API_KEY` | empty (store off) | RevenueCat public Google API key (`goog_...`) |
| `MOBILE_IOS_REVENUECAT_API_KEY` | empty (store off) | RevenueCat public Apple API key (`appl_...`) |
| `MOBILE_REVENUECAT_OFFERING` | `default` | Offering to show |
| `MOBILE_PRODUCT_PRO` / `MOBILE_PRODUCT_BUSINESS` | `explora_pro` / `explora_business_monthly` | Product ids (packages are also matched by type: Lifetime = Pro, Monthly = Business) |
| `MOBILE_ADMOB_BANNER_ID` / `MOBILE_ADMOB_INTERSTITIAL_ID` | Google test units | Android ad unit ids |
| `MOBILE_IOS_ADMOB_BANNER_ID` / `MOBILE_IOS_ADMOB_INTERSTITIAL_ID` | Google test units | iOS ad unit ids |
| `MOBILE_ADMOB_INTERSTITIAL_EVERY` | `3` | Full-screen ad after every Nth model |
| `MOBILE_ADMOB_INTERSTITIAL_MIN_INTERVAL_SEC` | `180` | At most one per this many seconds |

Google Play also requires a privacy policy and the Data safety form to declare the advertising ID and purchase data; the manifest gets the `AD_ID` and billing permissions from the plugins.

## iOS

One web bundle (`dist/mobile`) serves both apps: `cap sync` copies it into `android/` and `ios/`. The settings carry the store key and the ad units per platform (`mobile.monetization.revenuecat.apiKeys.{android,ios}`, `mobile.monetization.admob.{android,ios}`), and the app picks its own at run time (`appPlatform()` in `plan.js`, `Capacitor.getPlatform()`). An iOS build needs a Mac with Xcode:

1. `npx cap add ios` once (creates `ios/`, commit it), then `pnpm run cap:assets:ios` for the icon and splash, and `pnpm run cap:ios` to build the bundle, sync and open Xcode.
2. `ios/App/App/Info.plist`:
   - `GADApplicationIdentifier`: `MOBILE_IOS_ADMOB_APP_ID` (the iOS app's AdMob id, with `~`; without it the app crashes on start once AdMob loads),
   - `SKAdNetworkItems`: Google's list from the AdMob iOS quick start,
   - `NSUserTrackingUsageDescription`: the text of the App Tracking Transparency prompt. `ads.js` asks after Google's consent form; a refusal still shows ads, just not personalized ones.
3. **App Store Connect**: the same products as on Google Play (`explora_pro` non-consumable, `explora_business_monthly` auto-renewable subscription). **RevenueCat**: add the App Store app, import them into the same entitlements (`pro`, `business`) and packages of the `default` offering, and use its public Apple key (`appl_...`) as `MOBILE_IOS_REVENUECAT_API_KEY`. The worker checks entitlements, not stores, so nothing changes on the server.
4. **AdMob**: a separate iOS app with its own banner and interstitial units (`MOBILE_IOS_ADMOB_*`).

There is no iOS release script yet: set `MOBILE_MONETIZATION_TESTING=false` and the `MOBILE_IOS_*` values in the shell, run `pnpm run cap:sync`, then archive in Xcode. As for Android, check `dist/mobile/viewer-settings.json` first: `"testing": false`, a non-empty `revenuecat.apiKeys.ios` and no `3940256099942544` in `admob.ios`.
