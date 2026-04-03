#!/bin/bash
set -euo pipefail

LOG="/opt/drupal/dfg3dworker.log"
PID_FILE="/opt/drupal/dfg3dworker.pid"
DRUPAL_SITE_URI="${DRUPAL_SITE_URI:-https://repository.covher.eu}"
DRUSH_BIN="${DRUSH_BIN:-/opt/drupal/vendor/bin/drush}"

is_pid_running() {
  local pid="$1"
  if [[ -z "$pid" || ! "$pid" =~ ^[0-9]+$ ]]; then
    return 1
  fi
  if kill -0 "$pid" 2>/dev/null; then
    return 0
  fi
  return 1
}

cleanup() {
  rm -f "$PID_FILE"
}

trap cleanup EXIT

if [ -f "$LOG" ] && [ $(stat -c%s "$LOG") -gt 50000000 ]; then
  mv "$LOG" "${LOG}.old"
fi

if [ -f "$PID_FILE" ]; then
  EXISTING_PID="$(tr -d '[:space:]' < "$PID_FILE" || true)"
  if is_pid_running "$EXISTING_PID"; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') Worker already running with PID $EXISTING_PID, exiting" >> "$LOG"
    exit 0
  fi
  rm -f "$PID_FILE"
  echo "$(date '+%Y-%m-%d %H:%M:%S') Removed stale PID file" >> "$LOG"
fi

echo "$$" > "$PID_FILE"
echo "$(date '+%Y-%m-%d %H:%M:%S') Worker started" >> "$LOG"

while true; do
  echo "$(date '+%Y-%m-%d %H:%M:%S') Run started" >> "$LOG"
  "$DRUSH_BIN" --uri="$DRUPAL_SITE_URI" queue:run dfg_3dviewer_convert --time-limit=3600 2>&1 | awk '{ print strftime("%Y-%m-%d %H:%M:%S"), $0; fflush(); }' >> "$LOG"
  sleep 5
done
