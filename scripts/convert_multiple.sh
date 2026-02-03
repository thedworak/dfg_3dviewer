#!/usr/bin/env bash
set -uo pipefail

######################################
# Config
######################################
LOG_FILE="convert_$(date +%Y-%m-%d_%H-%M-%S).log"

[[ -f convert_files.txt ]] || { echo "Missing file: convert_files.txt"; exit 1; }

while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
  FILES+=("$line")
done < convert_files.txt

[[ ${#FILES[@]} -eq 0 ]] && {
  echo "No files to process."
  exit 1
}

######################################
# Logging helper
######################################
log() {
  echo "[$(date '+%F %T')] $*"
}

######################################
# Start
######################################
echo "Conversion started: $(date)" | tee -a "$LOG_FILE"
echo "Log: $LOG_FILE" | tee -a "$LOG_FILE"
echo | tee -a "$LOG_FILE"

FAILED=()
SUCCESS=()

for file in "${FILES[@]}"; do
  START=$(date +%s)
  log "Start: $file" | tee -a "$LOG_FILE"

  if convert.sh \
    --input "$file" \
    --compression true \
    --compression-level 3 \
    --binary true \
    --force false \
    2>&1 | tee -a "$LOG_FILE"
  then
    log "OK: $file" | tee -a "$LOG_FILE"
    SUCCESS+=("$file")
  else
    log "FAIL: $file" | tee -a "$LOG_FILE"
    FAILED+=("$file")
  fi
  END=$(date +%s)
  log "$((END-START))s"

  echo | tee -a "$LOG_FILE"
done

######################################
# Summary
######################################
echo "================ SUMMARY ================" | tee -a "$LOG_FILE"
log "Success: ${#SUCCESS[@]}" | tee -a "$LOG_FILE"
log "Errors: ${#FAILED[@]}" | tee -a "$LOG_FILE"

if (( ${#FAILED[@]} )); then
  echo "Failed files:" | tee -a "$LOG_FILE"
  printf ' - %s\n' "${FAILED[@]}" | tee -a "$LOG_FILE"
fi

echo "End: $(date)" | tee -a "$LOG_FILE"
