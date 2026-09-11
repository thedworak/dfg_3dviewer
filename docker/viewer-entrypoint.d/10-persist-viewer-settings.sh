#!/bin/sh
# Runs on every container start via nginx:alpine's own /docker-entrypoint.d/
# convention (scripts there run before nginx starts). Named Docker volumes
# can only be mounted as directories (mounting one straight onto the
# viewer-settings.json file fails - "not a directory"), so instead the
# volume is mounted at /data/viewer-config and this script symlinks
# viewer-settings.json to a copy inside it, seeding that copy from the
# image's built-in default on first run only.
set -eu

CONFIG_DIR=/data/viewer-config
TARGET=/usr/share/nginx/html/viewer-settings.json
PERSISTED="$CONFIG_DIR/viewer-settings.json"

mkdir -p "$CONFIG_DIR"

if [ ! -f "$PERSISTED" ]; then
    cp "$TARGET" "$PERSISTED"
fi

ln -sf "$PERSISTED" "$TARGET"
