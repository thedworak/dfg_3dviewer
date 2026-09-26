# Mobile app: plans and ads

The Android app (Capacitor, `pnpm run build:mobile`) has three plans:

| Plan | Price | What it adds |
|---|---|---|
| Free | free | Everything for viewing, with ads: a banner along the bottom and a full-screen ad after every 3rd model (at most once per 3 minutes, never for the first model) |
| Pro | one-time purchase | No ads |
| Business | monthly subscription | No ads, higher upload/conversion limits on the repository, a custom repository address, annotations (including IIIF import/export) and the materials editor |

Web builds are not affected: they have no plans, no ads and nothing locked.

## How it fits together

- `viewer/monetization/plan.js`: the current plan and what each plan unlocks (`FEATURES`, `LOCKED_TOOLS`). Changing a plan's features is an edit there. The plan comes from RevenueCat entitlements (`pro`, `business`) and is remembered on the device, so the app starts offline with the last known plan.
- `viewer/monetization/ads.js`: AdMob (`@capacitor-community/admob`), with Google's consent form (UMP) before any ad in the EEA/UK. The page leaves room for the banner, so the toolbar sits above it.
- `viewer/ui/plans-panel.js`: the plans panel (crown button in the header): prices from the store, buy/subscribe, restore purchases, ad privacy options. Locked toolbar tools show a lock and open this panel.
- `worker/entitlements.py`: Business limits on the repository. The app sends its RevenueCat app user id in `X-App-User-Id`, and the worker checks it with RevenueCat (see `worker/README.md`, "Business plan of the mobile app").

## Test build (default)

Without any setup the build uses Google's AdMob test units (test ads are shown) and no RevenueCat key: the store is off and buying is disabled. The plans panel then has a "Test: force plan" selector to try each plan without buying it.

## Going live

1. **Google Play Console** - create the app, then:
   - in-app product (one-time) `explora_pro`,
   - subscription `explora_business_monthly` with a monthly base plan.
2. **RevenueCat** - add the Play app (service account credentials), import both products, and create:
   - entitlements `pro` (product `explora_pro`) and `business` (product `explora_business_monthly`),
   - an offering `default` (current) with a Lifetime package (`explora_pro`) and a Monthly package (`explora_business_monthly`).
3. **AdMob** - create the app and two ad units: an adaptive banner and an interstitial. Set up the GDPR message (Privacy & messaging) for the consent form.
4. **Build the release:**
   ```bash
   MOBILE_MONETIZATION_TESTING=false \
   MOBILE_REVENUECAT_API_KEY=goog_xxx \
   MOBILE_ADMOB_BANNER_ID=ca-app-pub-xxx/yyy \
   MOBILE_ADMOB_INTERSTITIAL_ID=ca-app-pub-xxx/zzz \
   pnpm run cap:sync
   cd android && ./gradlew bundleRelease -PadmobAppId=ca-app-pub-xxx~nnn
   ```
   The AdMob *app* id (with `~`) goes to Gradle; without it the manifest keeps Google's test app id.
5. **Worker** - set `WORKER_REVENUECAT_SECRET_KEY` (RevenueCat secret key) in `.env` next to `docker-compose.yml` and restart the worker.

| Build variable | Default | |
|---|---|---|
| `MOBILE_MONETIZATION_TESTING` | `true` | `false` for release: real ads, no plan override |
| `MOBILE_REVENUECAT_API_KEY` | empty (store off) | RevenueCat public Google API key (`goog_...`) |
| `MOBILE_REVENUECAT_OFFERING` | `default` | Offering to show |
| `MOBILE_PRODUCT_PRO` / `MOBILE_PRODUCT_BUSINESS` | `explora_pro` / `explora_business_monthly` | Product ids (packages are also matched by type: Lifetime = Pro, Monthly = Business) |
| `MOBILE_ADMOB_BANNER_ID` / `MOBILE_ADMOB_INTERSTITIAL_ID` | Google test units | Ad unit ids |
| `MOBILE_ADMOB_INTERSTITIAL_EVERY` | `3` | Full-screen ad after every Nth model |
| `MOBILE_ADMOB_INTERSTITIAL_MIN_INTERVAL_SEC` | `180` | At most one per this many seconds |

Google Play also requires a privacy policy and the Data safety form to declare the advertising ID and purchase data; the manifest gets the `AD_ID` and billing permissions from the plugins.
