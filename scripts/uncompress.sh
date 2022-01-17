#!/bin/bash

while getopts ":t:o:i:f:n:" flag; do
    case "${flag}" in
		t) TYPE="${OPTARG}";;
        i) INPUT="${OPTARG}";;
        o) OUTPUT="${OPTARG}";;
        n) NAME="${OPTARG}";;
        f) FORCE="${OPTARG}";;
    esac
done

if [[ ! -d $OUTPUT ]]; then
	mkdir -p ${OUTPUT}/gltf
fi

case "${TYPE}" in
	rar) strOutput=`unrar e $INPUT $OUTPUT/`
		;;
	tar) strOutput=`tar xvzf $INPUT -C $OUTPUT/`
		;;
esac

echo "Uncompressed file $INPUT"

for filename in ${OUTPUT}*; do
	fname=${filename##*/}
	name="${fname%.*}"
	ext=${filename//*.}
	ext=`echo ${ext,,}`

	case $ext in
		abc|blend|dae|fbx|obj|ply|stl|wrl|x3d|ifc)
			bash /var/www/html/3drepository/modules/dfg_3dviewer/scripts/convert.sh -c 'true' -l '3' -b 'true' -i "${OUTPUT}${name}.${ext}" -o "${OUTPUT}" -f 'true'
		;;
	  #*)
		#echo "Flie extension $ext is not supported for conversion yet."
		#;;
	esac
done
