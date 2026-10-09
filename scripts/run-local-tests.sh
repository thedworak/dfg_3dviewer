#!/bin/sh

set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

cd "$ROOT_DIR"

echo "[local-tests] building test bundle"
npm run build:test

echo "[local-tests] running Playwright viewer tests"
CI=1 npx playwright test tests/viewer.spec.ts --project chromium-webgl --workers=1 "$@"
