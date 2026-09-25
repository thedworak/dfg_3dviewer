#!/usr/bin/env bash
# Helper for the standalone Docker setup (see "Standalone Docker setup" in
# README.md).
#
#   scripts/docker.sh build   [dev|test|sandbox]   build image(s)
#   scripts/docker.sh down    [dev|test|sandbox]   stop + remove container(s)
#   scripts/docker.sh rebuild [dev|test|sandbox]   down, then build
#   scripts/docker.sh base                         rebuild the worker base image from
#                                                  scratch (Blender etc., worker/Dockerfile.base)
#   scripts/docker.sh prune                        docker system prune (asks first)
#   scripts/docker.sh                              interactive menu
#
# Add --up to build/rebuild to start the result afterwards (docker compose up -d).
# Every step reports success, and build/rebuild end with the localhost URLs
# the services are (or will be) available on.
#
# The profile selects the viewer-<profile> service and is passed to
# docker-compose.yml as VIEWER_PROFILE (build arg, see docker/profiles/), so
# docker-compose.yml itself is never edited. Without a profile, build/down
# act on every service (including the shared worker).
set -euo pipefail

cd "$(dirname "$0")/.."

PROFILES=(dev test sandbox)

usage() {
    sed -n '2,/^set -euo/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//'
}

is_profile() {
    local p
    for p in "${PROFILES[@]}"; do [ "$1" = "$p" ] && return 0; done
    return 1
}

compose() { docker compose "$@"; }

ok()   { printf '\033[32m✔ %s\033[0m\n' "$*"; }
info() { printf '>> %s\n' "$*"; }

# service -> default published host port (see docker-compose.yml)
service_default() {
    case "$1" in
        viewer-test)    echo "3000" ;;
        viewer-dev)     echo "3001" ;;
        viewer-sandbox) echo "3002" ;;
        worker)         echo "8080" ;;
    esac
}

# Host port a service is published on: asks Compose when it is running (so
# docker-compose.override.yml port remaps are respected), otherwise falls back
# to the defaults from docker-compose.yml.
service_port() {
    local svc="$1" container_port=3000 published
    [ "$svc" = worker ] && container_port=8080
    published="$(compose port "$svc" "$container_port" 2>/dev/null | sed -n '1s/.*://p' || true)"
    echo "${published:-$(service_default "$svc")}"
}

# print_availability <running|built> [profile]
print_availability() {
    local state="$1" profile="${2:-}" svc
    local services=(viewer-test viewer-dev viewer-sandbox worker)
    [ -n "$profile" ] && services=("viewer-$profile")
    if [ "$state" = running ]; then
        info "Available on:"
    else
        info "Built, not started yet (re-run with --up, or 'docker compose up -d'). Once started, available on:"
    fi
    for svc in "${services[@]}"; do
        printf '   %-15s http://localhost:%s\n' "$svc" "$(service_port "$svc")"
    done
}

do_build() {
    local profile="${1:-}"
    if [ -n "$profile" ]; then
        info "building viewer-$profile (VIEWER_PROFILE=$profile)"
        VIEWER_PROFILE="$profile" compose build "viewer-$profile"
        ok "Image for viewer-$profile built (profile: $profile)"
    else
        info "building all services"
        compose build
        ok "All images built"
    fi
}

do_down() {
    local profile="${1:-}"
    if [ -n "$profile" ]; then
        info "removing viewer-$profile"
        compose stop "viewer-$profile"
        compose rm -f "viewer-$profile"
        ok "viewer-$profile stopped and container removed"
    else
        info "docker compose down"
        compose down
        ok "All containers and networks removed (volumes kept)"
    fi
}

do_up() {
    local profile="${1:-}"
    if [ -n "$profile" ]; then
        VIEWER_PROFILE="$profile" compose up -d "viewer-$profile"
        ok "viewer-$profile started"
    else
        compose up -d
        ok "All services started"
    fi
}

do_prune() {
    # Without -f docker prompts for confirmation itself.
    if docker system prune; then
        ok "docker system prune finished"
    else
        echo "docker system prune did not complete (cancelled or failed)" >&2
        return 1
    fi
}

run() {
    local action="$1" profile="${2:-}" up="${3:-}"
    case "$action" in
        build)   do_build "$profile" ;;
        down)    do_down "$profile" ;;
        rebuild) do_down "$profile"; do_build "$profile" ;;
        prune)   do_prune; return ;;
        base)    compose build --no-cache --pull worker-base; ok "Worker base image rebuilt"; return ;;
        *)       usage; exit 1 ;;
    esac
    if [ "$action" = down ]; then return; fi
    if [ "$up" = "up" ]; then
        do_up "$profile"
        print_availability running "$profile"
    else
        print_availability built "$profile"
    fi
}

menu() {
    echo "1) build"
    echo "2) build + up"
    echo "3) down"
    echo "4) down + build"
    echo "5) system prune"
    read -rp "Choice [1-5]: " choice
    local action up=""
    case "$choice" in
        1) action=build ;;
        2) action=build; up=up ;;
        3) action=down ;;
        4) action=rebuild ;;
        5) do_prune; exit $? ;;
        *) echo "Invalid choice" >&2; exit 1 ;;
    esac
    read -rp "Profile (${PROFILES[*]}, empty = all): " profile
    if [ -n "$profile" ] && ! is_profile "$profile"; then
        echo "Unknown profile: $profile" >&2; exit 1
    fi
    run "$action" "$profile" "$up"
}

if [ $# -eq 0 ]; then menu; exit 0; fi

action="" profile="" up=""
for arg in "$@"; do
    case "$arg" in
        -h|--help|help) usage; exit 0 ;;
        --up)           up=up ;;
        build|down|rebuild|prune|base) action="$arg" ;;
        *)
            if is_profile "$arg"; then profile="$arg"
            else echo "Unknown argument: $arg" >&2; usage; exit 1; fi ;;
    esac
done
[ -n "$action" ] || { usage; exit 1; }

run "$action" "$profile" "$up"
