#!/usr/bin/env bash
# Release build of the Android app (docs/publishing.md, "2. Android app"):
# loads the MOBILE_* build variables from an env file, refuses test values,
# builds and syncs the web bundle (pnpm run cap:sync), checks the result and
# builds the signed app bundle (./gradlew bundleRelease).
#
#   scripts/build-android-release.sh [--env FILE] [--sync-only]
#
#   --env FILE    variables file (default: .env in the repository root; see
#                 .env.example). Only MOBILE_* lines are read - the WORKER_*
#                 secrets of a server .env in the same file are ignored.
#   --sync-only   stop after cap:sync and the checks (no gradle build)
#
# Variables already set in the shell win over the file.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/.env"
SYNC_ONLY=false
TEST_PUBLISHER="3940256099942544" # Google's AdMob test ids

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env) ENV_FILE="$2"; shift 2 ;;
    --sync-only) SYNC_ONLY=true; shift ;;
    -h|--help) sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

fail() { echo "ERROR: $*" >&2; exit 1; }
warn() { echo "WARNING: $*" >&2; }

# ---- load MOBILE_* from the env file --------------------------------------
# Parsed, not sourced: the file is data (KEY=value, optional quotes, # comments).
[[ -f "$ENV_FILE" ]] || fail "no env file at $ENV_FILE (copy .env.example to .env)"
while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line#"${line%%[![:space:]]*}"}"           # trim leading spaces
  [[ -z "$line" || "$line" == \#* ]] && continue
  line="${line#export }"
  [[ "$line" =~ ^(MOBILE_[A-Z0-9_]+)=(.*)$ ]] || continue
  key="${BASH_REMATCH[1]}"
  value="${BASH_REMATCH[2]}"
  if [[ "$value" =~ ^\"(.*)\"[[:space:]]*(#.*)?$ || "$value" =~ ^\'(.*)\'[[:space:]]*(#.*)?$ ]]; then
    value="${BASH_REMATCH[1]}"
  else
    value="${value%%[[:space:]]#*}"                   # trailing comment
    value="${value%"${value##*[![:space:]]}"}"        # trailing spaces
  fi
  # The shell wins over the file.
  if [[ -z "${!key+x}" ]]; then
    export "$key=$value"
  fi
done < "$ENV_FILE"

# A release build is never a testing build.
export MOBILE_MONETIZATION_TESTING="${MOBILE_MONETIZATION_TESTING:-false}"

# ---- check the values -----------------------------------------------------
[[ "$MOBILE_MONETIZATION_TESTING" == "false" ]] ||
  fail "MOBILE_MONETIZATION_TESTING must be false for a release (test ads, plans can be forced)"

for key in MOBILE_REVENUECAT_API_KEY MOBILE_ADMOB_APP_ID MOBILE_ADMOB_BANNER_ID MOBILE_ADMOB_INTERSTITIAL_ID; do
  [[ -n "${!key:-}" ]] || fail "$key is not set"
done
[[ "$MOBILE_REVENUECAT_API_KEY" == goog_* ]] ||
  fail "MOBILE_REVENUECAT_API_KEY must be RevenueCat's public Google key (goog_...), never the secret sk_ key"
[[ "$MOBILE_ADMOB_APP_ID" == ca-app-pub-*~* ]] ||
  fail "MOBILE_ADMOB_APP_ID must be the AdMob app id (ca-app-pub-...~...)"
for key in MOBILE_ADMOB_BANNER_ID MOBILE_ADMOB_INTERSTITIAL_ID; do
  [[ "${!key}" == ca-app-pub-*/* ]] || fail "$key must be an ad unit id (ca-app-pub-.../...)"
done
for key in MOBILE_ADMOB_APP_ID MOBILE_ADMOB_BANNER_ID MOBILE_ADMOB_INTERSTITIAL_ID; do
  [[ "${!key}" != *"$TEST_PUBLISHER"* ]] || fail "$key is one of Google's test ids"
done

[[ -n "${MOBILE_GLITCHTIP_DSN:-}" ]] ||
  warn "MOBILE_GLITCHTIP_DSN is not set: bug reports and crashes from the app go nowhere"
if [[ -z "${MOBILE_REMOTE_URL+x}" ]]; then
  echo "MOBILE_REMOTE_URL not set: the build's default repository is used (rollup.config.js)."
elif [[ -z "$MOBILE_REMOTE_URL" ]]; then
  warn "MOBILE_REMOTE_URL is empty: the app starts without a repository (offline only)"
fi

if ! $SYNC_ONLY; then
  PROPS="${GRADLE_USER_HOME:-$HOME/.gradle}/gradle.properties"
  for key in EXPLORA_UPLOAD_STORE_FILE EXPLORA_UPLOAD_STORE_PASSWORD EXPLORA_UPLOAD_KEY_ALIAS EXPLORA_UPLOAD_KEY_PASSWORD; do
    grep -q "^[[:space:]]*$key[[:space:]]*=" "$PROPS" 2>/dev/null ||
      fail "$key is missing in $PROPS - the bundle would be unsigned and Play rejects it"
  done
fi

VERSION_CODE="$(sed -n 's/^[[:space:]]*versionCode[[:space:]]\{1,\}\([0-9]\{1,\}\).*/\1/p' "$ROOT/android/app/build.gradle" | head -n1)"
VERSION_NAME="$(sed -n 's/^[[:space:]]*versionName[[:space:]]\{1,\}"\([^"]*\)".*/\1/p' "$ROOT/android/app/build.gradle" | head -n1)"
echo "Building version $VERSION_NAME (versionCode $VERSION_CODE) - Play rejects a versionCode it has seen."

# ---- build and sync the web bundle ----------------------------------------
cd "$ROOT"
pnpm run cap:sync

# ---- check what went into the app ----------------------------------------
SETTINGS="$ROOT/dist/mobile/viewer-settings.json"
node - "$SETTINGS" "$TEST_PUBLISHER" <<'NODE'
const fs = require("fs");
const [file, testPublisher] = process.argv.slice(2);
const text = fs.readFileSync(file, "utf8");
const settings = JSON.parse(text);
const monetization = settings.mobile?.monetization || {};
const problems = [];
if (monetization.testing !== false) problems.push('"testing" is not false');
if (!monetization.revenuecat?.apiKey) problems.push("revenuecat.apiKey is empty");
if (text.includes(testPublisher)) problems.push(`a Google test id (${testPublisher}) is in the settings`);
if (problems.length) {
  console.error(`ERROR: ${file}:\n  - ${problems.join("\n  - ")}`);
  process.exit(1);
}
console.log(`Checked ${file}: release settings (repository: ${settings.mobile?.remoteUrl || "none"}, error tracking: ${settings.viewer?.errorTracking?.dsn ? "on" : "off"}).`);
NODE

if $SYNC_ONLY; then
  echo "Synced (--sync-only): no app bundle built."
  exit 0
fi

# ---- signed app bundle ----------------------------------------------------
cd "$ROOT/android"
./gradlew bundleRelease -PadmobAppId="$MOBILE_ADMOB_APP_ID"

BUNDLE="$ROOT/android/app/build/outputs/bundle/release/app-release.aab"
[[ -f "$BUNDLE" ]] || fail "gradle finished but $BUNDLE is missing"
echo
echo "Release bundle: $BUNDLE"
echo "Check the signing key with: (cd android && ./gradlew :app:signingReport)  - release should show Config: upload"
