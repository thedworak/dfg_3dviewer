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
#   scripts/docker.sh env                          (re)configure .env interactively
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
#
# build/rebuild/base first check .env: when it is missing it is created from
# .env.example and the "must set before publishing" values are asked for
# (Enter keeps the shown default); when it exists, empty required values are
# reported and can be filled in. Without a terminal it only copies and warns.
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
warn() { printf '\033[33m! %s\033[0m\n' "$*" >&2; }

ENV_FILE=.env
ENV_EXAMPLE=.env.example

interactive() { [ -t 0 ] && [ -r /dev/tty ]; }

ask_yes() {  # ask_yes <question> <y|n default>
    local answer
    read -rp "$1 " answer < /dev/tty
    answer="${answer:-$2}"
    [[ "$answer" =~ ^[YyTt] ]]
}

get_env_value() { sed -n "s/^$1=//p" "$ENV_FILE" | tail -n 1; }

# Sets KEY=value in .env (replacing the existing line, or appending).
set_env_value() {
    local tmp
    tmp="$(mktemp)"
    KEY="$1" VALUE="$2" awk '
        BEGIN { k = ENVIRON["KEY"]; v = ENVIRON["VALUE"] }
        index($0, k "=") == 1 { if (!done) print k "=" v; done = 1; next }
        { print }
        END { if (!done) print k "=" v }
    ' "$ENV_FILE" > "$tmp"
    cat "$tmp" > "$ENV_FILE"
    rm -f "$tmp"
}

# Keys of a .env.example section: required ("Server - must set before
# publishing") or optional ("Server - optional"). MOBILE_* is not Docker's.
env_section_keys() {
    awk -v want="$1" '
        /^# Server - must set/ { s = "required"; next }
        /^# Server - optional/ { s = "optional"; next }
        /^# Android/           { s = ""; next }
        s == want && /^[A-Z_][A-Z0-9_]*=/ { sub(/=.*/, ""); print }
    ' "$ENV_EXAMPLE"
}

# Comment lines directly above KEY in .env.example, shown as the prompt help.
env_key_help() {
    awk -v key="$1" '
        /^#/ && !/^# ====/ { buf = buf "   " substr($0, 3) "\n"; next }
        index($0, key "=") == 1 { printf "%s", buf; exit }
        { buf = "" }
    ' "$ENV_EXAMPLE"
}

# prompt_env <required|optional> [empty-only]
prompt_env() {
    local section="$1" only_empty="${2:-}" key current value shown
    for key in $(env_section_keys "$section"); do
        current="$(get_env_value "$key")"
        [ -n "$only_empty" ] && [ -n "$current" ] && continue
        echo
        env_key_help "$key"
        if [[ "$key" =~ PASSWORD|SECRET ]]; then
            shown="empty"; [ -n "$current" ] && shown="set, Enter keeps it"
            read -rsp "  $key [$shown]: " value < /dev/tty; echo
        else
            read -rp "  $key [$current]: " value < /dev/tty
        fi
        set_env_value "$key" "${value:-$current}"
    done
}

configure_env() {
    info "Required settings (Enter keeps the value in brackets)"
    prompt_env required
    if ask_yes "Configure optional server settings too? [y/N]" n; then
        prompt_env optional
    fi
    ok "$ENV_FILE saved"
}

check_env() {
    local key missing=()
    if [ ! -f "$ENV_FILE" ]; then
        [ -f "$ENV_EXAMPLE" ] || { warn "$ENV_EXAMPLE not found, skipping .env check"; return; }
        cp "$ENV_EXAMPLE" "$ENV_FILE"
        info "$ENV_FILE not found, created from $ENV_EXAMPLE"
        if interactive; then
            configure_env
        else
            warn "No terminal - edit $ENV_FILE and set the required values before publishing"
        fi
        return
    fi
    for key in $(env_section_keys required); do
        [ -n "$(get_env_value "$key")" ] || missing+=("$key")
    done
    [ ${#missing[@]} -eq 0 ] && { ok "$ENV_FILE found, required values set"; return; }
    warn "$ENV_FILE: required values empty: ${missing[*]}"
    if interactive && ask_yes "Fill them in now? [y/N]" n; then
        prompt_env required empty-only
        ok "$ENV_FILE saved"
    fi
}

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
        build|rebuild|base) check_env ;;
    esac
    case "$action" in
        env)     if interactive; then [ -f "$ENV_FILE" ] || cp "$ENV_EXAMPLE" "$ENV_FILE"; configure_env
                 else warn "env needs a terminal"; exit 1; fi
                 return ;;
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
    echo "6) configure .env"
    read -rp "Choice [1-6]: " choice
    local action up=""
    case "$choice" in
        1) action=build ;;
        2) action=build; up=up ;;
        3) action=down ;;
        4) action=rebuild ;;
        5) do_prune; exit $? ;;
        6) run env; exit 0 ;;
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
        build|down|rebuild|prune|base|env) action="$arg" ;;
        *)
            if is_profile "$arg"; then profile="$arg"
            else echo "Unknown argument: $arg" >&2; usage; exit 1; fi ;;
    esac
done
[ -n "$action" ] || { usage; exit 1; }

run "$action" "$profile" "$up"
