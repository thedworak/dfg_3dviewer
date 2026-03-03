#!/bin/bash

LOG="/opt/drupal/dfg3dworker.log"
DRUPAL_SITE_URI="${DRUPAL_SITE_URI:-https://repository.covher.eu}"

if [ -f "$LOG" ] && [ $(stat -c%s "$LOG") -gt 50000000 ]; then
  mv $LOG ${LOG}.old
fi

echo "Worker started at $(date)" >> $LOG

while true; do
  echo "Run at $(date)" >> $LOG
  /opt/drupal/vendor/bin/drush --uri="$DRUPAL_SITE_URI" queue:run dfg_3dviewer_convert --time-limit=3600 >> $LOG 2>&1
  sleep 5
done
