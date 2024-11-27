#!/usr/bin/env bash

# == func log ===================================================================================================================
warning() {
    echo "Warning: $1"
}

error() {
    echo "Error: $1" && exit 1
}

BPATH="/var/www/data/backups/daily"
BDPATH="/var/www/data/backups/daily/db"
WEBSITE="www.dfg-repository.wisski.cloud"

# == init script ================================================================================================================
CURRENT_DATE=$(date +%d%m%y%H%M)
TGZ_FILE="${BPATH}/backup_${WEBSITE}_${CURRENT_DATE}.tgz"
SQL_FILE="${BDPATH}/${WEBSITE}_databases_${CURRENT_DATE}.sql"

mkdir -p "$BPATH"

# == main =======================================================================================================================
mkdir -p "${BDPATH}"

source read_settings.sh
mysqldump -h ${DATABASE_HOST} -u ${DATABASE_USER} -p${DATABASE_PASS} ${DATABASE} --hex-blob --skip-lock-tables --single-transaction > "$SQL_FILE"

tar --exclude="${BPATH:1}" --warning=none -czpf "$TGZ_FILE" -C / var/www/data

#scp "$TGZ_FILE" "${USER}@example.work:/mnt/home/${USER}"

find ${BPATH}/*.tgz -mtime +7 -exec rm {} \;
find ${BDPATH}/*.tgz -mtime +7 -exec rm {} \;