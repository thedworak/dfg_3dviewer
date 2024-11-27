#!/usr/bin/env bash

error() {
    echo -e "Error: $1\nExiting..." && exit 1
}

warning() {
	echo "Warning: $1 Skipping..."
}

MONTHLY_BACKUPS_PATH="/var/www/data/backups/monthly"
WEEKLY_BACKUPS_PATH="/var/www/data/backups/weekly"

clean_old_monthly_backups() {
	find ${MONTHLY_BACKUPS_PATH}/*.tgz -mtime +181 -exec rm {} \;
}

clean_old_monthly_db_backups() {
	find ${MONTHLY_BACKUPS_PATH}/db/*.tgz -mtime +181 -exec rm {} \;
}

sync_from_weekly() {
    # shellcheck disable=SC2010
    ffd="$(ls -pt | grep -v / | head -1)"
    if [[ -n "$ffd" ]]; then
        rsync -dtz --ignore-existing "${ffd}" "$1"
    else
        warning "No files found to sync!"
    fi
}

process_with_dbs() {
    if [[ -d "${MONTHLY_BACKUPS_PATH}/" ]]; then
        clean_old_monthly_backups

        if ! cd "${WEEKLY_BACKUPS_PATH}/"; then
            warning "Failed to cd into ${WEEKLY_BACKUPS_PATH}/"
        else
            # clean old weekly backups
            find ${WEEKLY_BACKUPS_PATH}/*.tgz -mtime +28 -exec rm {} \;

            sync_from_weekly "${MONTHLY_BACKUPS_PATH}/"
        fi

        if [[ -d "${MONTHLY_BACKUPS_PATH}/db/" ]]; then
            clean_old_monthly_db_backups

            if ! cd "${WEEKLY_BACKUPS_PATH}/db/"; then
                warning "Failed to cd into ${WEEKLY_BACKUPS_PATH}/db/"
            else
                # clean old weekly db backups
                find ${WEEKLY_BACKUPS_PATH}/db/*.tgz -mtime +28 -exec rm {} \;

                sync_from_weekly "${MONTHLY_BACKUPS_PATH}/db/"
            fi
        else
            warning "Cannot locate ${MONTHLY_BACKUPS_PATH}/db/"
        fi
    else
        warning "Cannot locate ${MONTHLY_BACKUPS_PATH}/"
    fi
}

