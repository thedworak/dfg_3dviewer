#!/bin/bash

# Ubuntu way
#apt install xvfb
#apt install libxkbcommon0
#apt install blender python3-pip
#apt install python3-lxml python3-shapely python3-matplotlib (for CityGML converter)
#apt install libxi6 libgconf-2-4
#OR
# Debian way
#wget https://ftp.halifax.rwth-aachen.de/blender/release/Blender4.4/blender-4.4.3-linux-x64.tar.xz
#tar -xvf blender-4.4.3-linux-x64.tar.xz
#change .env BLENDER_PATH or make symlink to it `ln -s PATH_TO_YOUR_UNCOMPRESSED_BLENDER/blender-4.4.3-linux64/blender /usr/local/bin/blender`
#pip install numpy or apt install python3-numpy
#pip install triangle
#usage: ./convert.sh -c COMPRESS -cl COMPRESSION_LEVEL -i 'INPUT' -o 'OUTPUT' -b BINARY -f FORCE_OVERRIDE


#apt install -y libxi6 libxrender1 libxrandr2 libxinerama1 libxcursor1 libxcomposite1 libxdamage1 libxtst6 libglib2.0-0 libsm6 libice6 libgl1 libxkbcommon0
#TESTING:
# sudo blender -b -P ./scripts/2gltf2/2gltf2.py -- --input "/opt/drupal/web/sites/default/files/{NAME}" --ext "$GLTF" --compression "true" --compression_level "3" --output "/opt/drupal/web/sites/default/files/2025-05/test-TEST.glb"
# xvfb-run --auto-servernum --server-args="-screen 0 512x512x16" sudo blender -b -P ./scripts/render.py -- --input "/var/www/html/sites/default/files/{NAME}.glb" --ext "glb" --org_ext "glb" --output "/var/www/html/sites/default/files/views/" --is_archive false --resolution 512x512x16 --samples 20 -E BLENDER_EEVEE -f 1

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BLENDER_PATH=''
#BLENDER_PATH='/var/lib/snapd/snap/blender/current/'
source "$SCRIPT_DIR/.env"
BLENDER_PATH="$SCRIPT_DIR/$BLENDER_PATH"

#Defaults:
COMPRESSION=false
COMPRESSION_LEVEL=3
GLTF="gltf"
FORCE=false
isOutput=false
IS_ARCHIVE=false
LIGHTWEIGHT=false
INPUT=""
OUTPUT=""
OUTPUTPATH=""

check_blender () {
	if [[ -x "$BLENDER_PATH/blender" ]]; then
	  BLENDER_BIN="$BLENDER_PATH/blender"
	elif command -v blender &> /dev/null; then
	  BLENDER_BIN="$(command -v blender)"
	else
		echo "Blender doesn't exist, install it by 'apt install blender python3-pip' then 'pip install numpy' or change BLENDER_PATH with your Blender instance"
		return 1
	fi
	
	if [[ ! -z $BLENDER_BIN ]]; then
		echo "Blender exists and be used for next steps..."
		return 0
	fi
}

check_xvfb_run () {
	if ! command -v xvfb-run &> /dev/null; then
		echo "xvfb-run doesn't exist, install it by 'apt install xvfb'"
		return 1
	else
		echo "xvfb-run exists and be used for next steps..."
		return 0
	fi
}

check_scripts () {
	if [ ! -d ${SPATH}/scripts ]; then
		echo "Can't find dependencies directory. Did you change your SPATH value in scripts/.env?"
		return 1
	else
		return 0
	fi
}

check_blender

if [[ "$LIGHTWEIGHT" != "true" ]]; then
	check_xvfb_run
fi

check_scripts

show_usage () {
	echo "-c=compress -l=compression level -i=input path -o=output path -b=binary -f=force override existing file"
	cat <<EOF
		Usage: convert.sh [options]

		Options:
		-c, --compression true|false
		-l, --compression-level 0-9
		-i, --input FILE
		-o, --output FILE
		-b, --binary true|false   (true = glb, false = gltf)
		-f, --force true|false
		-t, --lightweight true|false
		-a, --archive true|false
		-h, --help
EOF
	exit 0
}

######################################
# Helpers
######################################
die() {
  echo "Error: $*" >&2
  exit 1
}

bool() {
  [[ "$1" == "true" || "$1" == "false" ]] || die "Value must be true/false (is: $1)"
}

file_exists() {
  [[ -f "$1" ]] || die "File not found: $1"
}

######################################
# Parsing
######################################
while [[ $# -gt 0 ]]; do
  case "$1" in
    -c|--compression)
      bool "$2"
      COMPRESSION="$2"
      shift 2
      ;;
    -l|--compression-level)
      [[ "$2" =~ ^[0-9]$ ]] || die "compression-level must be 0–9"
      COMPRESSION_LEVEL="$2"
      shift 2
      ;;
    -i|--input)
      INPUT="$2"
      shift 2
      ;;
    -o|--output)
      OUTPUT="$2"
      shift 2
      ;;
    -b|--binary)
      bool "$2"
      [[ "$2" == "true" ]] && GLTF="glb" || GLTF="gltf"
      shift 2
      ;;
    -f|--force)
      bool "$2"
      FORCE="$2"
      shift 2
      ;;
    -t|--lightweight)
      bool "$2"
      LIGHTWEIGHT="$2"
      shift 2
      ;;
    -a|--archive)
      bool "$2"
      IS_ARCHIVE="$2"
      shift 2
      ;;
    -h|--help)
		show_usage
    	exit 0
      ;;
    --)
      shift
      break
      ;;
    *)
      die "Error parsing arguments"
      ;;
  esac
done

check_status () {
	if [ ! -f "$1.off" ]; then
		touch "$1.off"
	else
		rm -rf "$1.off"
	fi;
}

cleanup_main_lock() {
	flock -u 200 2>/dev/null || true
	exec 200>&- 2>/dev/null || true
	if [[ -n "${MAIN_LOCKFILE:-}" ]]; then
		rm -f "$MAIN_LOCKFILE"
	fi
}

render_preview () {
	SNAME=$NAME
	mkdir -p "$INPATH/views"
	RENDER_LOCKFILE="$INPATH/views/${SNAME}.lock"

	exec 201>"$RENDER_LOCKFILE" || exit 1

	flock -n 201 || {
		echo "Render already running for $SNAME"
		exec 201>&- 2>/dev/null || true
		return 0
	}
	trap 'flock -u 201 2>/dev/null || true; exec 201>&- 2>/dev/null || true; rm -f "$RENDER_LOCKFILE"' RETURN

	INPUT_GLTF_PATH="$INPATH/$SNAME.glb"
	echo "Rendering thumbnails..."

	if [[ "$EXT" != "glb" ]]; then
		SNAME="gltf/${NAME}"
		INPUT_GLTF_PATH="$INPATH/$SNAME.glb"
	fi;

	if [[ -n "${2:-}" ]]; then
		INPUT_GLTF_PATH="$2"
	fi

	if [[ ! -f "$INPUT_GLTF_PATH" ]]; then
		echo "Warning: Render input not found: $INPUT_GLTF_PATH"
		return 1
	fi

	RESOLUTION="32x32x16"
	SAMPLES="20"
	xvfb-run --auto-servernum \
		--server-args="-screen 0 ${RESOLUTION}" \
		"$BLENDER_BIN" -b -P "$SPATH/scripts/render.py" -- \
		--input "$INPUT_GLTF_PATH" \
		--ext glb \
		--org_ext "$1" \
		--output "$INPATH/views/" \
		--is_archive "$IS_ARCHIVE" \
		--resolution "$RESOLUTION" \
		--samples "$SAMPLES" \
		-E BLENDER_EEVEE -f 1
	echo "Blender exit code: $?"
}

create_dirs () {
	mkdir -p "$INPATH"/gltf/
	mkdir -p "$INPATH"/metadata/
}

create_flock () {
	INPATH=$1
	FILENAME=$2
	MAIN_LOCKFILE="$INPATH/${FILENAME}.lock"
	exec 200>"$MAIN_LOCKFILE" || exit 1
	flock -n 200 || {
		echo "Process already running for $FILENAME"
		exit 0
	}
	trap cleanup_main_lock EXIT
}

handle_file () {
	INPATH=$1
	FILENAME=$2
	NAME=$3
	EXT=$4
	OUTPUT=$5
	OUTPUTPATH=$6

	create_flock "$INPATH" "$FILENAME"

	if [[ "$isOutput" = false ]]; then
		"$BLENDER_BIN" -b -P ${SPATH}/scripts/2gltf2/2gltf2.py -- --input "$INPATH/$FILENAME" --ext "$GLTF" --compression "$COMPRESSION" --compression_level "$COMPRESSION_LEVEL" #> /dev/null 2>&1
	else
		"$BLENDER_BIN" -b -P ${SPATH}/scripts/2gltf2/2gltf2.py -- --input "$INPATH/$FILENAME" --ext "$GLTF" --compression "$COMPRESSION" --compression_level "$COMPRESSION_LEVEL" --output "$OUTPUT$OUTPUTPATH" #> /dev/null 2>&1
	fi

	# Prefer the standard target first, then explicit-output target.
	GENERATED_GLB="$INPATH/gltf/$NAME.glb"
	if [[ ! -f "$GENERATED_GLB" && "$isOutput" = true ]]; then
		GENERATED_GLB="$OUTPUT$OUTPUTPATH"
	fi

	if [[ -f "$GENERATED_GLB" ]]; then
		render_preview "$EXT" "$GENERATED_GLB"
	else
		render_preview "$INPATH/$NAME.$EXT"
	fi;
}

handle_unsupported_file () {
	INPATH=$1
	FILENAME=$2
	NAME=$3
	EXT=$4
	OUTPUT=$5
	OUTPUTPATH=$6

	#touch "${INPATH}/gltf/${NAME}.glb.off"
}

handle_ifc_file () {
	INPATH=$1
	FILENAME=$2
	NAME=$3
	EXT=$4
	OUTPUT=$5
	OUTPUTPATH=$6

	create_flock "$INPATH" "$FILENAME"

	create_dirs

	${SPATH}/scripts/IfcConvert "$INPATH/$FILENAME" "$INPATH/gltf/$NAME.glb" > /dev/null 2>&1
	render_preview $EXT
}

handle_blend_file () {
	INPATH=$1
	FILENAME=$2
	NAME=$3
	EXT=$4

	create_flock "$INPATH" "$FILENAME"

	create_dirs

	sudo ${BLENDER_PATH}blender -b -P ${SPATH}/scripts/convert-blender-to-gltf.py "$INPATH/$FILENAME" "$INPATH/gltf/$NAME.glb" > /dev/null 2>&1
	render_preview $EXT
}

handle_gml_file () {
	INPATH=$1
	FILENAME=$2
	NAME=$3
	EXT=$4
	OUTPUT=$5
	OUTPUTPATH=$6

	create_flock "$INPATH" "$FILENAME"

	GLB_PATH="${INPATH}/${NAME}_GLB"
	
	mkdir -p $GLB_PATH
	cp -rf $INPATH/$FILENAME $GLB_PATH/
	python3 ${SPATH}/scripts/CityGML2OBJv2/CityGML2OBJs.py -i "$GLB_PATH" -o "$GLB_PATH" > /dev/null 2>&1
	create_dirs
	sudo ${BLENDER_PATH}blender -b -P ${SPATH}/scripts/2gltf2/2gltf2.py -- "$GLB_PATH/${NAME}.obj" "$GLTF" "$COMPRESSION" "$COMPRESSION_LEVEL" "$INPATH/gltf/$NAME.glb" > /dev/null 2>&1
	if [[ "$LIGHTWEIGHT" != "true" ]]; then
		render_preview $EXT
	fi
	rm -rf $GLB_PATH

}

printf "\n"
echo "======== Parameters ========"
echo "  INPUT: $INPUT"
echo "  OUTPUT: $OUTPUT"
echo "  COMPRESSION: $COMPRESSION"
echo "  LEVEL: $COMPRESSION_LEVEL"
echo "  FORMAT: $GLTF"
echo "  FORCE: $FORCE"
echo "  LIGHTWEIGHT: $LIGHTWEIGHT"
echo "  ARCHIVE: $IS_ARCHIVE"
echo "==========================="
printf "\n"

if [[ ! -z "$INPUT" && -f $INPUT ]]; then
	FILENAME=${INPUT##*/}
	NAME="${FILENAME%.*}"
	EXT=${FILENAME//*.}
	INPATH=${INPUT%/*}

	if [[ $FILENAME = $INPATH ]]; then
		INPATH="."
	fi
	if [[ -z "$OUTPUT" ]]; then
		OUTPUT=`echo ${INPATH}/gltf`
	else
		#echo $OUTPUT
		OUTFILENAME=${OUTPUT%/*}     # trim everything past the last /
		OUTFILENAME=${OUTFILENAME##*/}
		OUTFILENAME=${OUTFILENAME/"_ZIP"/""}
		OUTFILENAME=${OUTFILENAME/"_RAR"/""}
		OUTFILENAME=${OUTFILENAME/"_TAR"/""}
		OUTFILENAME=${OUTFILENAME/"_XZ"/""}
		OUTFILENAME=${OUTFILENAME/"_GZ"/""}
		OUTPUTPATH=`echo $OUTFILENAME.$GLTF`
		OUTPUT=`echo ${OUTPUT}gltf/`
		isOutput=true
	fi
	if [[ "$EXT" != "$FILENAME" ]]; then
		EXT="${EXT,,}"
		if [[ ! -d "$OUTPUT" ]]; then
			mkdir "$OUTPUT"
		fi
		if [[ ! -f $OUTPUT/$NAME.$GLTF || $FORCE ]]; then
			start=`date +%s`
			case $EXT in
				abc|dae|fbx|obj|ply|stl|wrl|x3d)
					echo "Converting $EXT file..."
					handle_file "$INPATH" "$FILENAME" "$NAME" $EXT "$OUTPUT" "$OUTPUTPATH"
					end=`date +%s`
					echo "File $FILENAME compressed successfully. Runtime: $((end-start))s."
					exit 0;
				;;
			  ifc)
					echo "Converting $EXT file..."
					handle_ifc_file "$INPATH" "$FILENAME" "$NAME" $EXT "$OUTPUT" "$OUTPUTPATH"
					end=`date +%s`
					echo "File $FILENAME compressed successfully. Runtime: $((end-start))s."
					exit 0;
				;;
			  blend)
					echo "Converting $EXT file..."
					handle_blend_file "$INPATH" "$FILENAME" "$NAME" $EXT
					end=`date +%s`
					echo "File $FILENAME compressed successfully. Runtime: $((end-start))s."
					exit 0;
				;;
			  gml)
					echo "Converting $EXT file..."
					handle_gml_file "$INPATH" "$FILENAME" "$NAME" $EXT "$OUTPUT" "$OUTPUTPATH"
					end=`date +%s`
					echo "File $FILENAME compressed successfully. Runtime: $((end-start))s."
					exit 0;
				;;
			  glb)
			  		if [[ "$LIGHTWEIGHT" != "true" ]]; then
						render_preview $EXT
					fi
					end=`date +%s`
					echo "Given file was already compressed."
					exit 0;
				;;

			  *)
					handle_unsupported_file "$INPATH" "$FILENAME" "$NAME" $EXT "$OUTPUT" "$OUTPUTPATH"
					#echo "File extension $EXT is not supported for conversion yet."
					exit 0;
				;;
			esac
		else
			echo "Compressed file $OUTPUT/$NAME.$GLTF already exists."
			exit 1;
		fi
	else
		echo "No extension found on $FILENAME";
		exit 2;
	fi
elif [[ -z "$INPUT" ]] && die "No --input argument provided"; then
	file_exists "$INPUT"
elif [[ -n "$OUTPUT" && -f "$OUTPUT" && "$FORCE" != "true" ]]; then
	die "Output file already exists (use --force true)"
else
	echo "Given file '$INPUT' not found"
	show_usage
fi
