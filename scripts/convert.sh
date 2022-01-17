#!/bin/bash

#apt install blender python3-pip
#pip install numpy
#usage: ./convert.sh -c COMPRESS -cl COMPRESSION_LEVEL -i INPUT -o OUTPUT -b BINARY -f FORCE_OVERRIDE

BLENDER_PATH=''
#BLENDER_PATH='/var/lib/snapd/snap/blender/current/'

#Defaults:
COMPRESSION=false
COMPRESSION_LEVEL=3
GLTF="gltf"
FORCE="false"
isOutput=false

while getopts ":c:l:o:i:b:f:" flag; do
    case "${flag}" in
        c) COMPRESSION=${OPTARG};;
        l) COMPRESSION_LEVEL=${OPTARG};;
        i) INPUT="${OPTARG}";;
        o) OUTPUT="${OPTARG}";;
        f) FORCE="${OPTARG}";;
        b) if [[ "${OPTARG}" = "true" ]]; then GLTF="glb"; else GLTF="gltf"; fi;;
    esac
done

handle_file () {
	INPATH=$1
	FILENAME=$2
	NAME=$3
	EXT=$4
	OUTPUT=$5
	OUTPUTPATH=$6

	if [[ "$isOutput" = false ]]; then
		${BLENDER_PATH}blender -b -P /var/www/html/3drepository/modules/dfg_3dviewer/scripts/2gltf2/2gltf2.py -- "$INPATH/$FILENAME" "$GLTF" "$COMPRESSION" "$COMPRESSION_LEVEL" > /dev/null 2>&1
	else
		${BLENDER_PATH}blender -b -P /var/www/html/3drepository/modules/dfg_3dviewer/scripts/2gltf2/2gltf2.py -- "$INPATH/$FILENAME" "$GLTF" "$COMPRESSION" "$COMPRESSION_LEVEL" "$OUTPUT$OUTPUTPATH" #> /dev/null 2>&1
	fi
}

handle_ifc_file () {
	INPATH=$1
	FILENAME=$2
	NAME=$3
	EXT=$4
	OUTPUT=$5
	OUTPUTPATH=$6

	if [[ ! -d $INPATH/gltf/ ]]; then
		mkdir $INPATH/gltf/
	fi
	/var/www/html/3drepository/modules/dfg_3dviewer/scripts/IfcConvert "$INPATH/$FILENAME" "$INPATH/gltf/$NAME.glb" > /dev/null 2>&1
}

if [[ ! -z "$INPUT" && -f $INPUT ]]; then
	FILENAME=${INPUT##*/}
	NAME="${FILENAME%.*}"
	EXT=${FILENAME//*.}
	INPATH=${INPUT%/*}

	if [[ $FILENAME = $INPATH ]]; then
		INPATH="."
	fi
	if [[ -z "$OUTPUT" ]]; then
		OUTPUT=`echo $INPATH/\gltf`
	else
		echo $OUTPUT
		OUTFILENAME=${OUTPUT%/*}     # trim everything past the last /
		OUTFILENAME=${OUTFILENAME##*/}
		OUTFILENAME=${OUTFILENAME/"_ZIP"/""}
		OUTFILENAME=${OUTFILENAME/"_RAR"/""}
		OUTFILENAME=${OUTFILENAME/"_TAR"/""}
		OUTPUTPATH=`echo $OUTFILENAME.$GLTF`
		OUTPUT=`echo ${OUTPUT}gltf/`
		isOutput=true
	fi
	if [[ "$EXT" != "$filename" ]]; then
		EXT="${EXT,,}"
		if [[ ! -d $OUTPUT ]]; then
			mkdir $OUTPUT
		fi
		if [[ ! -f $OUTPUT/$NAME.$GLTF || $FORCE ]]; then
			start=`date +%s`
			case $EXT in
				abc|blend|dae|fbx|obj|ply|stl|wrl|x3d)
					handle_file "$INPATH" "$FILENAME" "$NAME" $EXT "$OUTPUT" "$OUTPUTPATH"
					end=`date +%s`
					echo "File $OUTPUT/$FILENAME compressed successfully. Runtime: $((end-start))s."
				;;
			  ifc)
					handle_ifc_file "$INPATH" "$FILENAME" "$NAME" $EXT "$OUTPUT" "$OUTPUTPATH"
					end=`date +%s`
					echo "File $OUTPUT/$FILENAME compressed successfully. Runtime: $((end-start))s."
				;;
			  glb)
				echo "Given file was already compressed."
				;;

			  *)
				echo "Flie extension $EXT is not supported for conversion yet."
				;;
			esac
		else
			echo "Compressed file $OUTPUT/$NAME.$GLTF already exists."
		fi
	else
		echo "No extension found on $FILENAME";
	fi
else
	echo "No file $INPUT or 0 arguments given."
	echo "Usage: ./convert.sh -c true/false -cl [0-6] -i INPUT -o OUTPUT -b true/false -f true/false"
	echo "-c=compress -cl=compression level -i=input path -o=output path -b=binary -f=force override existing file"
fi
