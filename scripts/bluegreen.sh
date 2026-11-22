#!/usr/bin/env bash
# Blue/green deployment of the Docker stack (docs/docker.md, "Blue/green
# deployment"). Run from anywhere; it works in the repository root.
#
#   scripts/bluegreen.sh status            which colour is live, what runs
#   scripts/bluegreen.sh deploy            build + start the idle colour, check
#                                          it, switch to it, stop the old one
#   scripts/bluegreen.sh switch [colour]   switch to the other (or the given)
#                                          colour without building; the old
#                                          one keeps running
#   scripts/bluegreen.sh rollback          same as switch: back to the other
#   scripts/bluegreen.sh stop <colour>     stop the idle colour
#   scripts/bluegreen.sh ports [colour]    the host ports of a colour
#
# The two colours are two compose projects, <project>-blue and
# <project>-green, on their own host ports, sharing the data volumes
# (docker/bluegreen.yml). Switching rewrites the host nginx's upstream file
# (BLUEGREEN_NGINX_CONF) and reloads nginx; without that file the switch is
# only recorded and the ports printed (a machine without a host nginx).
#
# Settings: the environment, else .env (only the lines below are read):
#   BLUEGREEN_PROJECT        compose project name; default: this directory's
#                            name, as compose derives it
#   BLUEGREEN_DATA_PREFIX    volume prefix; default BLUEGREEN_PROJECT (the
#                            volumes of a stack started before blue/green)
#   BLUEGREEN_BIND           address the ports are published on (127.0.0.1)
#   BLUEGREEN_BLUE_PORT      first port of blue (47300) and green (47310):
#   BLUEGREEN_GREEN_PORT     +0 viewer-test, +1 viewer-dev, +2 viewer-sandbox,
#                            +8 worker
#   BLUEGREEN_NGINX_CONF     the upstream file the host nginx includes
#   BLUEGREEN_NGINX_RELOAD   command that checks and reloads nginx
#                            (sudo -n nginx -t && sudo -n systemctl reload nginx)
#   BLUEGREEN_UPSTREAM_PREFIX upstream names' prefix; default the project
#                            name with - as _
#   BLUEGREEN_HEALTH_TIMEOUT seconds a new colour has to answer (180)
#   BLUEGREEN_DRAIN_SECONDS  seconds the old colour keeps running after a
#                            deploy's switch, for requests in flight (30)
#   COMPOSE_FILE             as for compose; default docker-compose.yml (and
#                            docker-compose.override.yml when there is one)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

STATE_FILE="$ROOT/.bluegreen-active"
COLOURS=(blue green)
SERVICES=(viewer-test viewer-dev viewer-sandbox)

say()  { printf '\033[1;34m>>\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m✔\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m✘\033[0m %s\n' "$*" >&2; exit 1; }

usage() { sed -n '2,/^$/{s/^# \{0,1\}//;p}' "${BASH_SOURCE[0]}"; }

# KEY from the environment, else its last KEY= line in .env (quotes removed),
# else the default. .env is never sourced: its values may hold anything.
setting() {
    local key="$1" default="${2-}" value
    if [ -n "${!key+x}" ]; then
        printf '%s' "${!key}"
        return
    fi
    if [ -f .env ]; then
        value="$(grep -E "^${key}=" .env | tail -n 1 | cut -d= -f2-)" || true
        if [ -n "$value" ]; then
            value="${value%\"}"; value="${value#\"}"
            value="${value%\'}"; value="${value#\'}"
            printf '%s' "$value"
            return
        fi
    fi
    printf '%s' "$default"
}

# Compose's own project name rule: lower case, only [a-z0-9_-].
default_project() {
    basename "$ROOT" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9_-'
}

PROJECT="$(setting BLUEGREEN_PROJECT "$(default_project)")"
DATA_PREFIX="$(setting BLUEGREEN_DATA_PREFIX "$PROJECT")"
BIND="$(setting BLUEGREEN_BIND 127.0.0.1)"
BLUE_PORT="$(setting BLUEGREEN_BLUE_PORT 47300)"
GREEN_PORT="$(setting BLUEGREEN_GREEN_PORT 47310)"
NGINX_CONF="$(setting BLUEGREEN_NGINX_CONF "")"
NGINX_RELOAD="$(setting BLUEGREEN_NGINX_RELOAD "sudo -n nginx -t && sudo -n systemctl reload nginx")"
UPSTREAM_PREFIX="$(setting BLUEGREEN_UPSTREAM_PREFIX "${PROJECT//-/_}")"
HEALTH_TIMEOUT="$(setting BLUEGREEN_HEALTH_TIMEOUT 180)"
DRAIN_SECONDS="$(setting BLUEGREEN_DRAIN_SECONDS 30)"

[ -n "$PROJECT" ] || die "BLUEGREEN_PROJECT is empty"
for n in "$BLUE_PORT" "$GREEN_PORT" "$HEALTH_TIMEOUT" "$DRAIN_SECONDS"; do
    [[ "$n" =~ ^[0-9]+$ ]] || die "not a number: $n (BLUEGREEN_* in .env)"
done
[ $((BLUE_PORT - GREEN_PORT)) -ge 10 ] || [ $((GREEN_PORT - BLUE_PORT)) -ge 10 ] \
    || die "BLUEGREEN_BLUE_PORT and BLUEGREEN_GREEN_PORT must be at least 10 apart"

# The compose files: COMPOSE_FILE as compose would read it, plus the overlay.
SEP="$(setting COMPOSE_PATH_SEPARATOR :)"
BASE_FILES="$(setting COMPOSE_FILE "")"
if [ -z "$BASE_FILES" ]; then
    BASE_FILES="docker-compose.yml"
    [ -f docker-compose.override.yml ] && BASE_FILES="$BASE_FILES${SEP}docker-compose.override.yml"
fi
COMPOSE_FILES="$BASE_FILES${SEP}docker/bluegreen.yml"

valid_colour() { [ "$1" = blue ] || [ "$1" = green ]; }
other() { [ "$1" = blue ] && echo green || echo blue; }
base_port() { [ "$1" = blue ] && echo "$BLUE_PORT" || echo "$GREEN_PORT"; }
port_of() {  # colour service
    local base; base="$(base_port "$1")"
    case "$2" in
        viewer-test) echo $((base + 0)) ;;
        viewer-dev) echo $((base + 1)) ;;
        viewer-sandbox) echo $((base + 2)) ;;
        worker) echo $((base + 8)) ;;
    esac
}
# Where this machine reaches a published port.
probe_host() { case "$BIND" in ""|0.0.0.0|"::") echo 127.0.0.1 ;; *) echo "$BIND" ;; esac; }
publish() { [ -n "$BIND" ] && echo "$BIND:$1" || echo "$1"; }

active() { [ -f "$STATE_FILE" ] && tr -d '[:space:]' < "$STATE_FILE" || true; }

# docker compose for one colour, its ports and shared volumes.
compose() {  # colour args...
    local colour="$1"; shift
    COMPOSE_FILE="$COMPOSE_FILES" \
    COMPOSE_PATH_SEPARATOR="$SEP" \
    COMPOSE_PROFILES="" \
    BLUEGREEN_DATA_PREFIX="$DATA_PREFIX" \
    VIEWER_TEST_PORT="$(publish "$(port_of "$colour" viewer-test)")" \
    VIEWER_DEV_PORT="$(publish "$(port_of "$colour" viewer-dev)")" \
    VIEWER_SANDBOX_PORT="$(publish "$(port_of "$colour" viewer-sandbox)")" \
    WORKER_PORT="$(publish "$(port_of "$colour" worker)")" \
        docker compose -p "$PROJECT-$colour" "$@"
}

# Containers of a compose project that are running.
running_ids() { docker ps -q --filter "label=com.docker.compose.project=$1"; }

ensure_volumes() {
    local v
    for v in worker-jobs viewer-test-settings viewer-dev-settings viewer-sandbox-settings; do
        if ! docker volume inspect "${DATA_PREFIX}_$v" >/dev/null 2>&1; then
            docker volume create "${DATA_PREFIX}_$v" >/dev/null
            ok "volume ${DATA_PREFIX}_$v created"
        fi
    done
}

check_ports_free() {  # colour - the ports must be free, or this colour's own
    local colour="$1" svc port owner
    command -v ss >/dev/null || return 0
    for svc in "${SERVICES[@]}" worker; do
        port="$(port_of "$colour" "$svc")"
        if ss -Hltn "sport = :$port" | grep -q .; then
            owner="$(docker ps --filter "publish=$port" --format '{{.Label "com.docker.compose.project"}}' | head -n 1)"
            [ "$owner" = "$PROJECT-$colour" ] && continue
            die "port $port ($colour $svc) is taken${owner:+ by compose project $owner} - change BLUEGREEN_${colour^^}_PORT in .env"
        fi
    done
}

health() {  # colour
    local colour="$1" host deadline url svc
    host="$(probe_host)"
    deadline=$((SECONDS + HEALTH_TIMEOUT))
    for svc in worker "${SERVICES[@]}"; do
        if [ "$svc" = worker ]; then
            url="http://$host:$(port_of "$colour" worker)/healthz"
        else
            url="http://$host:$(port_of "$colour" "$svc")/"
        fi
        until curl -fsS -o /dev/null --max-time 5 "$url"; do
            [ $SECONDS -lt $deadline ] || die "$colour $svc does not answer at $url (${HEALTH_TIMEOUT}s) - still live: $(active || echo none)"
            sleep 2
        done
        ok "$colour $svc answers ($url)"
    done
}

upstreams() {  # colour
    local colour="$1" host svc
    host="$(probe_host)"
    echo "# Written by scripts/bluegreen.sh ($PROJECT) - do not edit."
    echo "# Live: $colour, $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    for svc in "${SERVICES[@]}" worker; do
        printf 'upstream %s_%s { server %s:%s; }\n' \
            "$UPSTREAM_PREFIX" "${svc//-/_}" "$host" "$(port_of "$colour" "$svc")"
    done
}

write_file() {  # path content - directly, or through sudo when not writable
    if { [ -e "$1" ] && [ -w "$1" ]; } || { [ ! -e "$1" ] && [ -w "$(dirname "$1")" ]; }; then
        printf '%s\n' "$2" > "$1"
    else
        printf '%s\n' "$2" | sudo -n tee "$1" >/dev/null
    fi
}

point_nginx_at() {  # colour
    local colour="$1" previous=""
    if [ -z "$NGINX_CONF" ]; then
        warn "BLUEGREEN_NGINX_CONF not set: no nginx switched - point your proxy at the ports below"
        print_ports "$colour"
        return
    fi
    [ -f "$NGINX_CONF" ] && previous="$(cat "$NGINX_CONF")"
    write_file "$NGINX_CONF" "$(upstreams "$colour")"
    if ! bash -c "$NGINX_RELOAD"; then
        if [ -n "$previous" ]; then
            write_file "$NGINX_CONF" "$previous"
            bash -c "$NGINX_RELOAD" || true
        fi
        die "nginx reload failed ($NGINX_RELOAD) - $NGINX_CONF restored, still live: $(active || echo none)"
    fi
    ok "nginx now sends traffic to $colour ($NGINX_CONF)"
}

print_ports() {  # colour
    local colour="$1" svc
    for svc in "${SERVICES[@]}" worker; do
        printf '   %-15s http://%s:%s\n' "$svc" "$(probe_host)" "$(port_of "$colour" "$svc")"
    done
}

go_live() {  # colour
    point_nginx_at "$1"
    echo "$1" > "$STATE_FILE"
    ok "$1 is live"
}

# A stack started before blue/green (project <project> itself): stopped
# once a colour is live. Its containers and volumes stay.
stop_legacy() {
    local ids
    ids="$(running_ids "$PROJECT")"
    if [ -n "$ids" ]; then
        say "stopping the stack started without blue/green ($PROJECT)"
        # shellcheck disable=SC2086
        docker stop $ids >/dev/null
        ok "$PROJECT stopped (docker compose -p $PROJECT down removes it)"
    fi
}

stop_colour() {  # colour
    local ids
    ids="$(running_ids "$PROJECT-$1")"
    if [ -z "$ids" ]; then
        ok "$1 is not running"
        return
    fi
    # shellcheck disable=SC2086
    docker stop $ids >/dev/null
    ok "$1 stopped (kept for a rollback: scripts/bluegreen.sh rollback)"
}

lock() {
    command -v flock >/dev/null || return 0
    exec 9>"$ROOT/.bluegreen.lock"
    flock -w 900 9 || die "another scripts/bluegreen.sh is still running"
}

cmd_status() {
    local live colour state
    live="$(active)"
    say "project $PROJECT, data volumes ${DATA_PREFIX}_*, live: ${live:-none}"
    for colour in "${COLOURS[@]}"; do
        if [ -n "$(running_ids "$PROJECT-$colour")" ]; then state=running; else state=stopped; fi
        printf '   %-6s %-8s %s\n' "$colour" "$state" "$([ "$colour" = "$live" ] && echo '<- live')"
        print_ports "$colour"
    done
    [ -n "$(running_ids "$PROJECT")" ] && warn "the stack without blue/green ($PROJECT) is running too"
    [ -n "$NGINX_CONF" ] && say "nginx upstreams: $NGINX_CONF" || true
}

cmd_deploy() {
    local live target
    live="$(active)"
    if valid_colour "$live"; then target="$(other "$live")"; else target=blue; fi
    say "deploying to $target (live: ${live:-none})"
    compose "$target" config --quiet
    ensure_volumes
    check_ports_free "$target"
    compose "$target" build
    compose "$target" up -d --remove-orphans
    health "$target"
    go_live "$target"
    stop_legacy
    if valid_colour "$live" && [ -n "$(running_ids "$PROJECT-$live")" ]; then
        say "$live keeps running ${DRAIN_SECONDS}s for requests in flight"
        sleep "$DRAIN_SECONDS"
        stop_colour "$live"
    fi
}

cmd_switch() {
    local live target="${1-}"
    live="$(active)"
    if [ -z "$target" ]; then
        valid_colour "$live" || die "nothing is live yet - run: scripts/bluegreen.sh deploy"
        target="$(other "$live")"
    fi
    valid_colour "$target" || die "colour: blue or green, not '$target'"
    [ "$target" = "$live" ] && { ok "$target is live already"; return; }
    say "switching to $target (live: ${live:-none})"
    ensure_volumes
    check_ports_free "$target"
    # The images from that colour's last deploy; nothing is built here.
    compose "$target" up -d --no-build \
        || die "$target cannot start without a build - run: scripts/bluegreen.sh deploy"
    health "$target"
    go_live "$target"
    stop_legacy
    if valid_colour "$live"; then
        say "$live keeps running - stop it with: scripts/bluegreen.sh stop $live"
    fi
}

case "${1-}" in
    status|"") cmd_status ;;
    deploy) lock; cmd_deploy ;;
    switch|rollback) lock; cmd_switch "${2-}" ;;
    stop)
        valid_colour "${2-}" || die "usage: scripts/bluegreen.sh stop <blue|green>"
        [ "$2" = "$(active)" ] && die "$2 is live - switch first"
        lock; stop_colour "$2" ;;
    ports)
        colour="${2:-$(active)}"
        valid_colour "$colour" || die "usage: scripts/bluegreen.sh ports <blue|green>"
        print_ports "$colour" ;;
    upstreams)  # the nginx file a colour would get, for checking
        valid_colour "${2-}" || die "usage: scripts/bluegreen.sh upstreams <blue|green>"
        upstreams "$2" ;;
    -h|--help|help) usage ;;
    *) usage; exit 1 ;;
esac
