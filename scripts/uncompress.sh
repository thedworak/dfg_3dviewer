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
	mkdir $OUTPUT
fi

case "${TYPE}" in
	rar) strOutput=`unrar e $INPUT $OUTPUT/`
		;;
	tar) strOutput=`tar xvzf $INPUT -C $OUTPUT/`
		;;
esac

echo "Uncompressed file $INPUT"

