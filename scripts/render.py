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
import numpy as np
import math
from mathutils import Matrix, Vector
import itertools
from math import radians
import argparse
import time

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
    args = parser.parse_known_args(argv)[0]

def rotation_matrix(axis, theta):
    """
    Return the rotation matrix associated with counterclockwise rotation about
    the given axis by theta radians.
    """
    axis = np.asarray(axis)
    axis = axis / math.sqrt(np.dot(axis, axis))
    a = math.cos(theta / 2.0)
    b, c, d = -axis * math.sin(theta / 2.0)
    aa, bb, cc, dd = a * a, b * b, c * c, d * d
    bc, ad, ac, ab, bd, cd = b * c, a * d, a * c, a * b, b * d, c * d
    return np.array([[aa + bb - cc - dd, 2 * (bc + ad), 2 * (bd - ac)],
                     [2 * (bc - ad), aa + cc - bb - dd, 2 * (cd + ab)],
                     [2 * (bd + ac), 2 * (cd - ab), aa + dd - bb - cc]])
					 
def rotate(point, angle_degrees, axis=(0,1,0)):
    theta_degrees = angle_degrees
    theta_radians = math.radians(theta_degrees)
    
    rotated_point = np.dot(rotation_matrix(axis, theta_radians), point)
    return rotated_point

""" get_min
- (bound_box)	bound_box
				utilized bound_box
>>> (Vector) (x,y,z)
get_min estimates the minimal x, y, z values
"""
def get_min(bound_box):
	min_x = min([bound_box[i][0] for i in range(0, 8)])
	min_y = min([bound_box[i][1] for i in range(0, 8)])
	min_z = min([bound_box[i][2] for i in range(0, 8)])
	return Vector((min_x, min_y, min_z))

	
""" get_max
- (bound_box)	bound_box
				utilized bound_box
>>> (Vector) (x,y,z)
get_max estimates the maximal x, y, z values
"""
def get_max(bound_box):
	max_x = max([bound_box[i][0] for i in range(0, 8)])
	max_y = max([bound_box[i][1] for i in range(0, 8)])
	max_z = max([bound_box[i][2] for i in range(0, 8)])
	return Vector((max_x, max_y, max_z))


def get_origin(v1, v2):
	 return v1 + 0.5 * (v2 - v1)

max_model_dim = 10

def scale_scene():
    pmin = Vector((float("inf"), float("inf"), float("inf")))
    pmax = Vector((float("-inf"), float("-inf"), float("-inf")))
    for o in bpy.data.objects:
        if o.type == 'MESH':
            mat = o.matrix_world
            for v in o.bound_box:
                v = mat @ Vector(v)
                if v[0] < pmin[0]: pmin[0] = v[0]
                if v[1] < pmin[1]: pmin[1] = v[1]
                if v[2] < pmin[2]: pmin[2] = v[2]
                if v[0] > pmax[0]: pmax[0] = v[0]
                if v[1] > pmax[1]: pmax[1] = v[1]
                if v[2] > pmax[2]: pmax[2] = v[2]

    root = bpy.data.objects.new("scaled_root", None)
    for obj in bpy.context.scene.objects:
        if not obj.parent:
            obj.parent = root
    bpy.context.scene.collection.objects.link(root)

    center = (pmin + pmax) / 2
    scale = max_model_dim / (pmax-pmin).length
    root.matrix_world = Matrix.Diagonal((scale,) * 3).to_4x4() @ Matrix.Translation(-center)

    pmin = root.matrix_world @ pmin
    pmax = root.matrix_world @ pmax
    bounds = [
        pmin[0], pmin[1], pmin[2], # left front bottom
        pmin[0], pmin[1], pmax[2], # left front top
        pmin[0], pmax[1], pmax[2], # left back top
        pmin[0], pmax[1], pmin[2], # left back bottom
        pmax[0], pmin[1], pmin[2], # right front bottom
        pmax[0], pmin[1], pmax[2], # right front top
        pmax[0], pmax[1], pmax[2], # right back top
        pmax[0], pmax[1], pmin[2]  # right back bottom
    ]
    return bounds


#
# Globals
#
bpy.context.scene.render.resolution_percentage = 70
bpy.context.scene.render.resolution_x = 1024
bpy.context.scene.render.resolution_y = 1024
bpy.context.scene.cycles.samples = 20

if args.resolution:
    resolution = args.resolution.split('x', 2)
    bpy.context.scene.render.resolution_x = int(resolution[0])
    bpy.context.scene.render.resolution_y = int(resolution[1])
if args.samples:
    bpy.context.scene.cycles.samples = int(args.samples)
#
# Functions
#
current_directory = os.getcwd()

extension = "glb"
original_extension = "glb"

if args.ext:
    extension = args.ext
if extension == "gltf":
    format = "GLTF_EMBEDDED"
else:
   format = "GLB"

if args.org_ext:
	original_extension = args.org_ext

is_archive = args.is_archive

print("Converting: '" + original_extension + "'")

root, current_extension = os.path.splitext(args.input)
current_basename = os.path.basename(root)

if current_extension == ".abc" or current_extension == ".blend" or current_extension == ".dae" or current_extension == ".fbx" or current_extension == ".gltf" or current_extension == ".glb" or current_extension == ".obj" or current_extension == ".ply" or current_extension == ".stl" or current_extension == ".wrl" or current_extension == ".x3d":

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
		object=bpy.ops.import_scene.obj(filepath=args.input)    

	if current_extension == ".ply":
		bpy.ops.import_mesh.ply(filepath=args.input)    

	if current_extension == ".stl":
		bpy.ops.import_mesh.stl(filepath=args.input)

	if current_extension == ".wrl" or current_extension == ".x3d":
		bpy.ops.import_scene.x3d(filepath=args.input)

	if current_extension == ".gltf" or current_extension == ".glb":
		bpy.ops.import_scene.gltf(filepath=args.input)

	scene = bpy.context.scene
	context = bpy.context
	render = scene.render

	# --------------------------------------------------
	# UTILS
	# --------------------------------------------------

	def np_matmul_coords(coords, matrix):
		M = matrix.transposed()
		ones = np.ones((coords.shape[0], 1))
		coords4d = np.hstack((coords, ones))
		return np.dot(coords4d, M)[:, :-1]


	def get_scene_bounds():
		coords = np.vstack(
			tuple(
				np_matmul_coords(np.array(o.bound_box), o.matrix_world.copy())
				for o in scene.objects if o.type == 'MESH'
			)
		)
		bfl = coords.min(axis=0)
		tbr = coords.max(axis=0)
		size = Vector(tbr - bfl)
		center = Vector((bfl + tbr) * 0.5)
		return center, size


	def fit_camera_to_bounds(cam, center, size, margin=1.2):
		# aspect ratio of render
		render = bpy.context.scene.render
		aspect = render.resolution_x / render.resolution_y

		ratio = size.x / size.z
		print(f"Camera fit ratio: {ratio:.2f}")

		if ratio > 6.0:
			cam.data.type = 'ORTHO'

			# ORTHO: scale
			ortho_height = size.z * 1.2
			ortho_width = size.x * 1.2 / aspect

			cam.data.ortho_scale = max(ortho_height, ortho_width)

			# clipping – MUST HAVE
			cam.data.clip_start = 0.01
			cam.data.clip_end = max(size) * 10

		else:
			cam.data.type = 'PERSP'
			cam.data.clip_start = 0.01
			cam.data.clip_end = max(size) * 10

		# FOV vertical and horizontal
		fov_x = cam_data.angle
		fov_y = 2 * math.atan(math.tan(fov_x / 2) / aspect)

		# required distance to fit bounds in view
		dist_x = (size.x * 0.5) / math.tan(fov_x * 0.5)
		dist_z = (size.z * 0.5) / math.tan(fov_y * 0.5)

		distance = max(dist_x, dist_z) * margin

		cam.location = center + Vector((0, -distance, 0))

	if args.output:
		export_file = args.output
	else:
		root = root[::-1].replace(current_basename[::-1], "", 1)[::-1]
		export_file = root + "_" + extension

	if is_archive:
		mainfilepath=export_file+current_basename
	else:
		mainfilepath=export_file+current_basename+"."+original_extension

	# --------------------------------------------------
	# RENDER / CYCLES
	# --------------------------------------------------

	render.engine = 'CYCLES'
	render.film_transparent = True
	render.resolution_x = int(resolution[0])
	render.resolution_y = int(resolution[1])
	render.resolution_percentage = 100

	render.image_settings.file_format = 'PNG'
	render.image_settings.color_mode = 'RGBA'
	render.image_settings.color_depth = '16'
	render.image_settings.color_management = 'FOLLOW_SCENE'

	scene.render.use_compositing = True

	scene.cycles.device = 'CPU'
	scene.cycles.samples = 256
	scene.cycles.use_adaptive_sampling = True
	scene.cycles.adaptive_threshold = 0.03
	scene.cycles.adaptive_min_samples = 16

	scene.cycles.use_denoising = True
	scene.cycles.denoiser = 'OPENIMAGEDENOISE'
	scene.cycles.denoising_input_passes = 'RGB_ALBEDO_NORMAL'
	scene.cycles.denoising_prefilter = 'ACCURATE'

	scene.cycles.max_bounces = 6
	scene.cycles.diffuse_bounces = 3
	scene.cycles.glossy_bounces = 3
	scene.cycles.transparent_max_bounces = 4
	scene.cycles.transmission_bounces = 4

	scene.cycles.sample_clamp_indirect = 20
	scene.cycles.light_sampling_threshold = 0.03

	# CUDA OFF (no warnings)
	prefs = bpy.context.preferences
	prefs.addons['cycles'].preferences.compute_device_type = 'NONE'

	# --------------------------------------------------
	# VIEW LAYER PASSES (CLI SAFE)
	# --------------------------------------------------

	view_layer = scene.view_layers["ViewLayer"]
	view_layer.use_pass_normal = True
	view_layer.use_pass_diffuse_color = True
	view_layer.use_pass_object_index = True

	# --------------------------------------------------
	# CAMERA
	# --------------------------------------------------

	center, size = get_scene_bounds()
	cam_data = bpy.data.cameras.new("Camera")
	cam_data.lens = 50	# product look
	cam_data.sensor_width = 36

	cam = bpy.data.objects.new("Camera", cam_data)
	scene.collection.objects.link(cam)
	scene.camera = cam

	cam_empty = bpy.data.objects.new("CamTarget", None)
	cam_empty.location = center 
	scene.collection.objects.link(cam_empty)

	cam.parent = cam_empty

	constraint = cam.constraints.new(type='TRACK_TO')
	constraint.target = cam_empty
	constraint.track_axis = 'TRACK_NEGATIVE_Z'
	constraint.up_axis = 'UP_Y'
	constraint.owner_space = 'WORLD'
	constraint.target_space = 'WORLD'

	# --------------------------------------------------
	# BASE CAMERA FIT
	# --------------------------------------------------

	fit_camera_to_bounds(cam, center, size, margin=1.45)


	# --------------------------------------------------
	# MATERIAL FIXUP
	# --------------------------------------------------

	# FIX 4: brightness boost for very dark, unlinked Base Color materials
	# (roughness/specular tweaks are kept as before; on top of that we lift
	# base colors that are close to black so they don't stay near-invisible
	# even under a well-lit scene)
	DARK_THRESHOLD = 0.15
	BRIGHTEN_FACTOR = 1.6

	for mat in bpy.data.materials:
		if not mat.use_nodes:
			continue

		for node in mat.node_tree.nodes:
			if node.type == 'BSDF_PRINCIPLED':

				# Bardziej naturalne materiały
				if "Roughness" in node.inputs:
					node.inputs["Roughness"].default_value = max(
						node.inputs["Roughness"].default_value,
						0.45
					)

				if "Specular IOR Level" in node.inputs:
					node.inputs["Specular IOR Level"].default_value = 0.5

				if "Metallic" in node.inputs:
					if node.inputs["Metallic"].default_value < 0.01:
						node.inputs["Metallic"].default_value = 0.0

				# FIX 4: rozjaśnienie bardzo ciemnych, niepodłączonych Base Color
				base_color_input = node.inputs.get("Base Color")
				if base_color_input is not None and not base_color_input.is_linked:
					col = base_color_input.default_value
					if max(col[0], col[1], col[2]) < DARK_THRESHOLD:
						base_color_input.default_value = (
							min(col[0] * BRIGHTEN_FACTOR, 1.0),
							min(col[1] * BRIGHTEN_FACTOR, 1.0),
							min(col[2] * BRIGHTEN_FACTOR, 1.0),
							col[3],
						)

	# --------------------------------------------------
	# WORLD
	# --------------------------------------------------

	world = bpy.data.worlds.new("ThumbnailWorld")
	scene.world = world
	world.use_nodes = True

	bg = world.node_tree.nodes["Background"]
	bg.inputs[0].default_value = (1.0, 1.0, 1.0, 1.0)
	# FIX 1: World strength podniesiony z 0.35 -> 1.2, żeby dać więcej
	# światła wypełniającego / odbić na obiekcie (tło i tak jest przezroczyste
	# dzięki film_transparent = True)
	bg.inputs[1].default_value = 1.2

	# FIX 2: Standard zamiast AgX (AgX mocno przyciemnia i "gasi" kontrast),
	# oraz podniesiona ekspozycja
	scene.view_settings.view_transform = "Standard"
	scene.view_settings.look = "None"
	scene.view_settings.exposure = 1.6
	scene.view_settings.gamma = 1.0

	# --------------------------------------------------
	# LIGHTS
	# --------------------------------------------------

	max_size = max(size)

	light_rig = bpy.data.objects.new("LightRig", None)
	light_rig.location = center
	scene.collection.objects.link(light_rig)

	#
	# KEY
	#

	key_data = bpy.data.lights.new("Key", "AREA")
	# FIX 3: podniesiona energia świateł (area lights skalują się z rozmiarem
	# sceny, więc przy dużych modelach światło "rozjeżdża się" na dużej
	# powierzchni i realnie doświetla mniej)
	key_data.energy = 10000
	key_data.shape = 'RECTANGLE'
	key_data.size = max_size * 2.5

	key = bpy.data.objects.new("Key", key_data)
	scene.collection.objects.link(key)

	key.parent = light_rig
	key.location = Vector((5, -5, 4))
	key.rotation_euler = (
		math.radians(55),
		0,
		math.radians(45)
	)

	#
	# FILL
	#

	fill_data = bpy.data.lights.new("Fill", "AREA")
	fill_data.energy = 5500
	fill_data.shape = 'RECTANGLE'
	fill_data.size = max_size * 3.0

	fill = bpy.data.objects.new("Fill", fill_data)
	scene.collection.objects.link(fill)

	fill.parent = light_rig
	fill.location = Vector((-5, -4, 3))
	fill.rotation_euler = (
		math.radians(65),
		0,
		math.radians(-40)
	)

	#
	# RIM
	#

	rim_data = bpy.data.lights.new("Rim", "AREA")
	rim_data.energy = 3000
	rim_data.shape = 'RECTANGLE'
	rim_data.size = max_size * 2.0

	rim = bpy.data.objects.new("Rim", rim_data)
	scene.collection.objects.link(rim)

	rim.parent = light_rig
	rim.location = Vector((0, 6, 5))
	rim.rotation_euler = (
		math.radians(120),
		0,
		math.radians(180)
	)

	key_data.spread = math.radians(120)
	fill_data.spread = math.radians(140)
	rim_data.spread = math.radians(160)

	# --------------------------------------------------
	# COMPOSITING (FIX 5): dodatkowy delikatny boost ekspozycji
	# w compositorze, tani sposób na odratowanie cieni bez przepalania świateł
	# --------------------------------------------------

	scene.use_nodes = True
	comp_tree = scene.node_tree
	comp_tree.nodes.clear()

	rl_node = comp_tree.nodes.new('CompositorNodeRLayers')
	exposure_node = comp_tree.nodes.new('CompositorNodeExposure')
	exposure_node.inputs[1].default_value = 0.5
	composite_node = comp_tree.nodes.new('CompositorNodeComposite')

	comp_tree.links.new(rl_node.outputs['Image'], exposure_node.inputs['Image'])
	comp_tree.links.new(exposure_node.outputs['Image'], composite_node.inputs['Image'])

	# --------------------------------------------------
	# RENDERS
	# --------------------------------------------------
	t0 = time.perf_counter()
	
	print("Starting rendering...")
	def render_angle(angle_deg, suffix):
		print(f"Rendering angle {angle_deg}")
		cam_empty.rotation_euler = (0, 0, math.radians(angle_deg))
		light_rig.rotation_euler = (0, 0, math.radians(angle_deg))
		scene.render.filepath = f"{mainfilepath}_{suffix}.png"
		bpy.ops.render.render(write_still=True)

	# sides
	for a in [0, 90, 180, 270]:
		render_angle(a, f"side{a}")

	# hero angles
	for a in [45, 135, 225, 315]:
		render_angle(a, f"side{a}")

	# top
	cam.location = center + Vector((0, 0, max(size.x, size.y) * 1.3))
	cam.rotation_euler = (0, 0, 0)
	scene.render.filepath = f"{mainfilepath}_top.png"
	bpy.ops.render.render(write_still=True)

	t1 = time.perf_counter()

	print(f"Rendering done (took: {t1 - t0:.3f} s)")
	# --------------------------------------------------