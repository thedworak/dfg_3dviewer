#!/bin/bash

# Ubuntu way
#apt install unrar-free

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TYPE=""
INPUT=""
OUTPUT=""
NAME=""
FORCE=""

while getopts ":t:o:i:f:n:" flag; do
  case "${flag}" in
    t) TYPE="${OPTARG}" ;;
    i) INPUT="${OPTARG}" ;;
    o) OUTPUT="${OPTARG}" ;;
    n) NAME="${OPTARG}" ;;
    f) FORCE="${OPTARG}" ;;
  esac
done

source "$SCRIPT_DIR/.env"

die() {
  echo "Error: $*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

[[ -n "$TYPE" ]] || die "Missing archive type (-t)"
[[ -n "$INPUT" ]] || die "Missing input archive (-i)"
[[ -n "$OUTPUT" ]] || die "Missing output directory (-o)"
[[ -f "$INPUT" ]] || die "Archive file not found: $INPUT"

TYPE="${TYPE,,}"

mkdir -p "$OUTPUT"

case "$TYPE" in
  rar)
    if command -v unrar >/dev/null 2>&1; then
      unrar x -o+ "$INPUT" "$OUTPUT/"
    elif command -v 7z >/dev/null 2>&1; then
      7z x -y "-o$OUTPUT" "$INPUT"
    else
      die "RAR extraction requires 'unrar' or '7z'"
    fi
    ;;
  xz)
    require_cmd tar
    tar -xJf "$INPUT" -C "$OUTPUT/"
    ;;
  tar)
    require_cmd tar
    tar -xf "$INPUT" -C "$OUTPUT/"
    ;;
  gz)
    require_cmd tar
    tar -xzf "$INPUT" -C "$OUTPUT/"
    ;;
  *)
    die "Unsupported archive type: $TYPE"
    ;;
esac

# Keep legacy behavior for archive layouts where the model is placed directly
# in the extraction root and convert.sh is expected to be called from here.
for filename in "$OUTPUT"*; do
  [[ -e "$filename" ]] || continue

  fname=${filename##*/}
  name="${fname%.*}"
  ext=${filename##*.}
  ext="${ext,,}"

  case "$ext" in
    abc|blend|dae|fbx|obj|ply|stl|wrl|x3d|ifc)
      "${SPATH}/scripts/convert.sh" -c 'true' -l '3' -b 'true' -i "${OUTPUT}${name}.${ext}" -o "${OUTPUT}" -f 'true' -a 'true'
      ;;
  esac
done
