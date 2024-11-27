#!/usr/bin/env bash

# == func log ===================================================================================================================
warning() {
    echo "Warning: $1"
}

error() {
    echo "Error: $1" && exit 1
}

BDPATH="/var/www/data/backups/daily/db"
WEBSITE="www.dfg-repository.wisski.cloud"

DAILY_BACKUPS_PATH="/var/www/data/backups/daily"
WEEKLY_BACKUPS_PATH="/var/www/data/backups/weekly"

sync_from_daily() {
    ffd="$(ls -pt | grep -v / | head -1)"
    if [[ -n "$ffd" ]]; then
        rsync -dtz --ignore-existing "${ffd}" "$1"
    else
        warning "No files found to sync!"
    fi
}

process_with_dbs() {
    path="${DAILY_BACKUPS_PATH}"

    if [[ -d "${WEEKLY_BACKUPS_PATH}/" ]]; then
        # clean old weekly backups
        find ${WEEKLY_BACKUPS_PATH}/*.tgz -mtime +28 -exec rm {} \;

        if ! cd "${path}"; then
            warning "Failed to cd into ${path}"
        else
            # clean old daily backups
            find "${path}"/*.tgz -mtime +6 -exec rm {} \;

            sync_from_daily "${WEEKLY_BACKUPS_PATH}/"
        fi

        path+="/db"
        if [[ -d "${WEEKLY_BACKUPS_PATH}/db/" ]]; then
            # clean old weekly db backups
            find ${WEEKLY_BACKUPS_PATH}/db/*.tgz -mtime +28 -exec rm {} \;

            if ! cd "${path}"; then
                warning "Failed to cd into ${path}"
            else
                # clean old daily db backups
                find "${path}"/*.tgz -mtime +6 -exec rm {} \;

                sync_from_daily "${WEEKLY_BACKUPS_PATH}/db/"
            fi
        else
            warning "Cannot locate ${WEEKLY_BACKUPS_PATH}/db/"
        fi
    else
        warning "Cannot locate ${WEEKLY_BACKUPS_PATH}/"
    fi
}

process_with_dbs