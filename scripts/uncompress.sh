#!/bin/bash

# Ubuntu way
#apt install unrar-free

while getopts ":t:o:i:f:n:" flag; do
    case "${flag}" in
		t) TYPE="${OPTARG}";;
        i) INPUT="${OPTARG}";;
        o) OUTPUT="${OPTARG}";;
        n) NAME="${OPTARG}";;
        f) FORCE="${OPTARG}";;
    esac
done

source $(dirname $0)/.env

if [[ ! -d $OUTPUT ]]; then
	mkdir -p ${OUTPUT}/gltf
fi

case $TYPE in
	rar) strOutput=$(unrar x "$INPUT" "$OUTPUT/")
		;;
	xz) strOutput=$(tar x -g "$INPUT" -C "$OUTPUT/")
		;;
	tar|gz) strOutput=$(tar xvz -g "$INPUT" -C "$OUTPUT/" 2>&1)
		;;
esac

#echo "Uncompressed file $INPUT"

for filename in ${OUTPUT}*; do
	fname=${filename##*/}
	name="${fname%.*}"
	ext=${filename//*.}
	ext=`echo ${ext,,}`

	case $ext in
		abc|blend|dae|fbx|obj|ply|stl|wrl|x3d|ifc)
			strOutput=$("${SPATH}/scripts/convert.sh" -c 'true' -l '3' -b 'true' -i "${OUTPUT}${name}.${ext}" -o "${OUTPUT}" -f 'true' -a 'true')
		;;
	  #*)
		#echo "Flie extension $ext is not supported for conversion yet."
		#;;
	esac
done
