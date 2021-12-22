#!/bin/bash

while getopts ":o:i:f:" flag; do
    case "${flag}" in
        i) INPUT="${OPTARG}";;
        o) OUTPUT="${OPTARG}";;
        f) FORCE="${OPTARG}";;
    esac
done

echo "$INPUT $OUTPUT"
if [[ ! -d $OUTPUT ]]; then
	mkdir $OUTPUT
fi
tar xvzf $INPUT -C $OUTPUT