#!/bin/bash

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BLENDER_BIN=${BLENDER_BIN:-blender}
BLENDER_BIN=$(command -v "$BLENDER_BIN")
source "${SCRIPT_DIR}/.env"

IS_ARCHIVE=false
INPUT=""
GLB_INPUT=""

die() {
  echo "Error: $*" >&2
  exit 1
}

bool() {
  [[ "$1" == "true" || "$1" == "false" ]] || die "Value must be true/false (is: $1)"
}

if [[ "$BLENDER_BIN" != /* ]]; then
  if [[ -x "$SCRIPT_DIR/$BLENDER_BIN" ]]; then
    BLENDER_BIN="$SCRIPT_DIR/$BLENDER_BIN"
  else
    BLENDER_BIN="$(command -v "$BLENDER_BIN")"
  fi
fi

check_blender() {
  if [[ "$BLENDER_BIN" != /* ]]; then
    if [[ -x "$SCRIPT_DIR/$BLENDER_BIN" ]]; then
      BLENDER_BIN="$SCRIPT_DIR/$BLENDER_BIN"
    elif command -v "$BLENDER_BIN" &> /dev/null; then
      BLENDER_BIN="$(command -v "$BLENDER_BIN")"
    else
      echo "Blender doesn't exist, install it by 'apt install blender python3-pip' then 'pip install numpy' or change BLENDER_PATH with your Blender instance"
      return 1
    fi
  fi

  if [[ -n "${BLENDER_BIN:-}" ]]; then
    echo "Blender exists and be used for next steps..."
    return 0
  fi
}

check_xvfb_run() {
  if ! command -v xvfb-run &> /dev/null; then
    echo "xvfb-run doesn't exist, install it by 'apt install xvfb'"
    return 1
  else
    echo "xvfb-run exists and be used for next steps..."
    return 0
  fi
}

check_scripts() {
  if [ ! -d "${SPATH}/scripts" ]; then
    echo "Can't find dependencies directory. Did you change your SPATH value in scripts/.env?"
    return 1
  else
    return 0
  fi
}

show_usage() {
  cat <<EOF
Usage: render.sh [options]

Options:
  -i, --input FILE         Original input model path.
  -g, --glb-input FILE     Optional explicit GLB path.
  -a, --archive true|false
  -h, --help
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -i|--input)
      INPUT="$2"
      shift 2
      ;;
    -g|--glb-input)
      GLB_INPUT="$2"
      shift 2
      ;;
    -a|--archive)
      bool "$2"
      IS_ARCHIVE="$2"
      shift 2
      ;;
    -h|--help)
      show_usage
      ;;
    *)
      die "Error parsing arguments"
      ;;
  esac
done

[[ -n "$INPUT" ]] || die "No --input argument provided"
[[ -f "$INPUT" ]] || die "Input file not found: $INPUT"

FILENAME=${INPUT##*/}
NAME="${FILENAME%.*}"
EXT=${FILENAME//*.}
EXT="${EXT,,}"
INPATH=${INPUT%/*}
if [[ $FILENAME = $INPATH ]]; then
  INPATH="."
fi

INPUT_GLTF_PATH="$INPATH/$NAME.glb"
ORG_EXT="$EXT"

if [[ "$EXT" != "glb" ]]; then
  INPUT_GLTF_PATH="$INPATH/gltf/$NAME.glb"
fi

if [[ -n "$GLB_INPUT" ]]; then
  INPUT_GLTF_PATH="$GLB_INPUT"
fi

if [[ ! -f "$INPUT_GLTF_PATH" ]]; then
  echo "Warning: Render input not found: $INPUT_GLTF_PATH"
  exit 1
fi

mkdir -p "$INPATH/views"
RENDER_LOCKFILE="$INPATH/views/${NAME}.lock"

exec 201>"$RENDER_LOCKFILE" || exit 1
flock -n 201 || {
  echo "Render already running for $NAME"
  exec 201>&- 2>/dev/null || true
  exit 0
}
trap 'flock -u 201 2>/dev/null || true; exec 201>&- 2>/dev/null || true; rm -f "$RENDER_LOCKFILE"' EXIT

check_blender
check_xvfb_run
check_scripts

if [[ -z "$RENDER_RESOLUTION" ]]; then
  RENDER_RESOLUTION='1024x1024x16'
fi
if [[ -z "$RENDER_SAMPLES" ]]; then
  RENDER_SAMPLES='20'
fi

echo "Rendering thumbnails..."
xvfb-run --auto-servernum \
  --server-args="-screen 0 ${RENDER_RESOLUTION}" \
  "$BLENDER_BIN" -b -P "$SPATH/scripts/render.py" -- \
  --input "$INPUT_GLTF_PATH" \
  --ext glb \
  --org_ext "$ORG_EXT" \
  --output "$INPATH/views/" \
  --is_archive "$IS_ARCHIVE" \
  --resolution "$RENDER_RESOLUTION" \
  --samples "$RENDER_SAMPLES" \
  -E BLENDER_EEVEE -f 1
echo "Blender exit code: $?"
