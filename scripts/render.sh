#!/bin/bash

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BLENDER_PATH=''
source "$SCRIPT_DIR/.env"
BLENDER_PATH="$SCRIPT_DIR/$BLENDER_PATH"

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

check_blender() {
  if [[ -x "$BLENDER_PATH/blender" ]]; then
    BLENDER_BIN="$BLENDER_PATH/blender"
  elif command -v blender &> /dev/null; then
    BLENDER_BIN="$(command -v blender)"
  else
    echo "Blender doesn't exist, install it by 'apt install blender python3-pip' then 'pip install numpy' or change BLENDER_PATH with your Blender instance"
    return 1
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
[[ -w "$INPATH/views" ]] || die "Views directory is not writable: $INPATH/views"

LOCK_DIR="${TMPDIR:-/tmp}/dfg_3dviewer_locks"
mkdir -p "$LOCK_DIR"
LOCK_KEY="$(printf '%s' "$INPATH/$NAME" | cksum | awk '{print $1}')"
RENDER_LOCKFILE="$LOCK_DIR/${LOCK_KEY}.lock"

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

RESOLUTION="32x32x16"
SAMPLES="20"
echo "Rendering thumbnails..."
xvfb-run --auto-servernum \
  --server-args="-screen 0 ${RESOLUTION}" \
  "$BLENDER_BIN" -b -P "$SPATH/scripts/render.py" -- \
  --input "$INPUT_GLTF_PATH" \
  --ext glb \
  --org_ext "$ORG_EXT" \
  --output "$INPATH/views/" \
  --is_archive "$IS_ARCHIVE" \
  --resolution "$RESOLUTION" \
  --samples "$SAMPLES" \
  -E BLENDER_EEVEE -f 1
echo "Blender exit code: $?"
