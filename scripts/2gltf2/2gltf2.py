# 
# The MIT License (MIT)
#
# Copyright (c) since 2017 UX3D GmbH
# 
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
# 
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
# 
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.
# 

#
# Imports
#

import bpy
import os
import sys
import argparse

if '--' in sys.argv:
    argv = sys.argv[sys.argv.index('--') + 1:]
    parser=argparse.ArgumentParser()
    parser.add_argument("--input", help="Input file path")
    parser.add_argument("--ext", help="Extenstion of imported file")
    parser.add_argument("--org_ext", help="Original extenstion of imported file")
    parser.add_argument("--output", help="Output file path")
    parser.add_argument("--is_archive", help="Importing archive flag")
    parser.add_argument("--resolution", help="Resolution preview images")
    parser.add_argument("--samples", help="Samples rendering quality")
    parser.add_argument("--compression", help="Compress object")
    parser.add_argument("--compression_level", help="Compress object level")
    args = parser.parse_known_args(argv)[0]

    print('input: ', args.input)
    print('ext: ', args.ext)
    print('org_ext: ', args.org_ext)
    print('output: ', args.output)
    print('is_archive: ', args.is_archive)
    print('resolution: ', args.resolution)
    print('samples: ', args.samples)
    print('compression: ', args.compression)
    print('compression_level: ', args.compression_level)

#
# Globals
#

#
# Functions
#
current_directory = os.getcwd()
compression = "false"
compression_level = 3

if args.ext:
    extension = args.ext
if extension == "gltf":
    format = "GLTF_EMBEDDED"
else:
   format = "GLB"

if args.org_ext:
	original_extension = args.ext

if args.compression:
    compression = args.compression

if args.compression_level:
    compression_level = int(args.compression_level)

root, current_extension = os.path.splitext(args.input)
current_basename = os.path.basename(root)

if current_extension == ".abc" or current_extension == ".blend" or current_extension == ".dae" or current_extension == ".fbx" or current_extension == ".obj" or current_extension == ".ply" or current_extension == ".stl" or current_extension == ".wrl" or current_extension == ".x3d":

	bpy.ops.wm.read_factory_settings(use_empty=True)

	if current_extension == ".abc":
		bpy.ops.wm.alembic_import(filepath=args.input)    

	if current_extension == ".blend":
		bpy.ops.wm.open_mainfile(filepath=args.input)

	if current_extension == ".dae":
		bpy.ops.wm.collada_import(filepath=args.input)    

	if current_extension == ".fbx":
		bpy.ops.import_scene.fbx(filepath=args.input)    

	if current_extension == ".obj":
		bpy.ops.wm.obj_import(filepath=args.input)    

	if current_extension == ".ply":
		bpy.ops.wm.ply_import(filepath=args.input)    

	if current_extension == ".stl":
		bpy.ops.import_mesh.stl(filepath=args.input)

	if current_extension == ".wrl" or current_extension == ".x3d":
		bpy.ops.import_scene.x3d(filepath=args.input)

	#
	if args.output:
		export_file = str(args.output)
		#export_file = root + current_basename + "." + extension
	else:
		root = root[::-1].replace(current_basename[::-1], "", 1)[::-1]
		export_file = root + "gltf/" + current_basename + "." + extension
	print("Writing: '" + export_file + "'")
	if compression == 'true':
		bpy.ops.export_scene.gltf(filepath=export_file,export_format=format,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=compression_level)
	else:
		bpy.ops.export_scene.gltf(filepath=export_file,export_format=format)
