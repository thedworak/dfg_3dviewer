#!/bin/bash
#TODO PATH for Blender
if [ "$#" -ge 1 ]
then
	/var/lib/snapd/snap/blender/current/blender -b -P 2gltf2.py -- "$1" "$2" "$3"
else
	echo Supported file formats: .abc .blend .dae .fbx. .obj .ply .stl .wrl .x3d
	echo 2gltf2.sh [filename]
fi
