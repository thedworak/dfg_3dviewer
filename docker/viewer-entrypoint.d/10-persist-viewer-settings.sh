#!/bin/sh
# Runs on every container start via nginx:alpine's own /docker-entrypoint.d/
# convention (scripts there run before nginx starts). Named Docker volumes
# can only be mounted as directories (mounting one straight onto a file
# fails - "not a directory"), so instead the volume is mounted at
# /data/viewer-config and this script symlinks each settings file to a copy
# inside it, seeding that copy from the image's built-in default on first
# run only.
#
# Two files are persisted: viewer-settings.json (fallback/bootstrap config)
# and the Docker profile manifest (docker/profiles/*.manifest.json, baked in
# at build time as manifests/docker-profile.json), which carries the
# profile's actual settings.
set -eu

CONFIG_DIR=/data/viewer-config
HTML_DIR=/usr/share/nginx/html

mkdir -p "$CONFIG_DIR"

for rel in viewer-settings.json manifests/docker-profile.json; do
    target="$HTML_DIR/$rel"
    persisted="$CONFIG_DIR/$(basename "$rel")"

    [ -e "$target" ] || continue
    if [ ! -f "$persisted" ]; then
        cp "$target" "$persisted"
    fi
    ln -sf "$persisted" "$target"
done
