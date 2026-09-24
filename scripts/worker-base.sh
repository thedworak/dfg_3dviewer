#!/bin/sh
# Base image of the conversion worker (worker/Dockerfile.base: Ubuntu, Blender,
# gltfpack, Python libraries). worker/Dockerfile builds FROM it, so code
# changes rebuild in seconds.
#
#   scripts/worker-base.sh ensure   make the base image available locally:
#                                   keep a matching local image, else pull it,
#                                   else build it (default command)
#   scripts/worker-base.sh build    build it locally
#   scripts/worker-base.sh push     build it and push it to the registry
#   scripts/worker-base.sh image    print the image reference
#
# The image reference comes from WORKER_BASE_IMAGE, or the ARG default in
# worker/Dockerfile. Every build is labelled with a hash of
# worker/Dockerfile.base; an image whose label does not match the current file
# (Dockerfile.base edited without bumping the tag) is rebuilt instead of used.

set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
BASE_DOCKERFILE="$ROOT_DIR/worker/Dockerfile.base"
LABEL_KEY="org.dfg3dviewer.base-hash"

info() { printf '[worker-base] %s\n' "$*"; }

image_ref() {
    if [ -n "${WORKER_BASE_IMAGE:-}" ]; then
        printf '%s\n' "$WORKER_BASE_IMAGE"
        return
    fi
    sed -n 's/^ARG WORKER_BASE_IMAGE=//p' "$ROOT_DIR/worker/Dockerfile" | head -n 1
}

base_hash() {
    sha256sum "$BASE_DOCKERFILE" | cut -c1-16
}

# Hash label of a local image, empty when the image is missing.
image_hash() {
    docker image inspect --format "{{ index .Config.Labels \"$LABEL_KEY\" }}" "$1" 2>/dev/null || true
}

do_build() {
    image=$(image_ref)
    info "building $image (Dockerfile.base hash $(base_hash)) - this downloads Blender and takes a while"
    # The base build needs no repository files; worker/ keeps the context tiny.
    docker build -f "$BASE_DOCKERFILE" --label "$LABEL_KEY=$(base_hash)" -t "$image" "$ROOT_DIR/worker"
}

do_ensure() {
    image=$(image_ref)
    want=$(base_hash)
    if [ "$(image_hash "$image")" = "$want" ]; then
        info "using local $image"
        return
    fi
    if docker pull --quiet "$image" >/dev/null 2>&1; then
        if [ "$(image_hash "$image")" = "$want" ]; then
            info "pulled $image"
            return
        fi
        info "pulled $image does not match worker/Dockerfile.base (bump the tag in worker/Dockerfile?) - rebuilding"
    else
        info "cannot pull $image - building it locally"
    fi
    do_build
}

case "${1:-ensure}" in
    ensure) do_ensure ;;
    build) do_build ;;
    push)
        do_build
        docker push "$(image_ref)"
        ;;
    image) image_ref ;;
    *)
        sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'
        exit 1
        ;;
esac
