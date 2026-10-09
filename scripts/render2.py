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

bpy.context.scene.render.resolution_percentage = 50
bpy.context.scene.render.resolution_x = 1280
bpy.context.scene.render.resolution_y = 960
bpy.context.scene.cycles.samples = 20

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

#
# Functions
#
current_directory = os.getcwd()

if sys.argv[6:]:
    extension = sys.argv[6]
if extension == "gltf":
    format = "GLTF_EMBEDDED"
else:
   format = "GLB"

force_continue = True
for current_argument in sys.argv:

	if force_continue:
		if current_argument == '--':
			force_continue = False
		continue

	#

	root, current_extension = os.path.splitext(current_argument)
	current_basename = os.path.basename(root)

	if current_extension != ".abc" and current_extension != ".blend" and current_extension != ".dae" and current_extension != ".fbx" and current_extension != ".gltf" and current_extension != ".glb" and current_extension != ".obj" and current_extension != ".ply" and current_extension != ".stl" and current_extension != ".wrl" and current_extension != ".x3d":
		continue

	bpy.ops.wm.read_factory_settings(use_empty=True)
	#print("Converting: '" + current_argument + "'")

	#

	if current_extension == ".abc":
		bpy.ops.wm.alembic_import(filepath=current_argument)    

	if current_extension == ".blend":
		bpy.ops.wm.open_mainfile(filepath=current_argument)

	if current_extension == ".dae":
		bpy.ops.wm.collada_import(filepath=current_argument)    

	if current_extension == ".fbx":
		bpy.ops.import_scene.fbx(filepath=current_argument)    

	if current_extension == ".obj":
		object=bpy.ops.import_scene.obj(filepath=current_argument)    

	if current_extension == ".ply":
		bpy.ops.import_mesh.ply(filepath=current_argument)    

	if current_extension == ".stl":
		bpy.ops.import_mesh.stl(filepath=current_argument)

	if current_extension == ".wrl" or current_extension == ".x3d":
		bpy.ops.import_scene.x3d(filepath=current_argument)

	if current_extension == ".gltf" or current_extension == ".glb":
		bpy.ops.import_scene.gltf(filepath=current_argument)

	scene = bpy.context.scene
	context = bpy.context
	render = bpy.context.scene.render
	bounds = scale_scene()

	item='MESH'
	bpy.ops.object.select_all(action='DESELECT')
	bpy.ops.object.select_by_type(type=item)

	# multiply 3d coord list by matrix
	def np_matmul_coords(coords, matrix, space=None):
		M = (space @ matrix @ space.inverted()
			 if space else matrix).transposed()
		ones = np.ones((coords.shape[0], 1))
		coords4d = np.hstack((coords, ones))
		
		return np.dot(coords4d, M)[:,:-1]
		return coords4d[:,:-1]

	# get the global coordinates of all object bounding box corners    
	coords = np.vstack(
		tuple(np_matmul_coords(np.array(o.bound_box), o.matrix_world.copy())
			 for o in  
				bpy.context.scene.objects
				if o.type == 'MESH'
				)
			)
	print("#" * 72)
	# bottom front left (all the mins)
	bfl = coords.min(axis=0)
	# top back right
	tbr = coords.max(axis=0)
	G  = np.array((bfl, tbr)).T
	# bound box coords ie the 8 combinations of bfl tbr.
	bbc = [i for i in itertools.product(*G)]
	print(np.array(bbc))
	bb_sides = get_min(bbc) - get_max(bbc)
	bb_sides = (abs(bb_sides[0]), abs(bb_sides[1]), abs(bb_sides[2]))
	print("#" * 72)
	print('BBOX')
	print(bb_sides)
	
	group = bpy.data.collections.new("MainGroup")
	bpy.context.scene.collection.children.link(group)
	#for ob in context.selected_objects: # or whichever list of objects desired
	#	group.objects.link(ob)
	#print("Moving objects into origin (0, 0, 0)")
	#group.location = (0, 0, 0)
	#for obj in context.selected_objects:
	#	obj.location = (0, 0, 0)
	render.engine = "CYCLES"
	render.film_transparent = True
	scene.cycles.device = "CPU"
	scene.cycles.samples = 128 # default 128
	scene.cycles.use_adaptive_sampling = True
	scene.cycles.adaptive_threshold = 0.1
	scene.cycles.adaptive_min_samples = 1
	scene.cycles.use_denoising = True
	scene.cycles.seed = 0 # default
	scene.cycles.use_animated_seed = True
	scene.cycles.min_light_bounces = 0 # default
	scene.cycles.min_transparent_bounces = 0 # default
	scene.cycles.light_sampling_threshold = 0.01 # default
	scene.cycles.max_bounces = 5
	scene.cycles.sample_clamp_direct = 0 # default
	scene.cycles.sample_clamp_indirect = 10 # default
	scene.cycles.blur_glossy = 1 # default
	scene.cycles.caustics_reflective = False
	scene.cycles.caustics_refractive = False
	
	#render.engine = 'BLENDER_EEVEE'
	#render.engine = 'CYCLES'
	#render.engine = 'BLENDER_WORKBENCH'
	render.image_settings.color_mode = 'RGBA'
	render.image_settings.color_depth = '16' 
	render.image_settings.file_format = 'PNG'
	render.resolution_x = 512
	render.resolution_y = 512
	render.resolution_percentage = 100
	render.film_transparent = True
	#scene.render.engine = 'CYCLES'
	scene.render.use_freestyle = False
	scene.use_nodes = True
	scene.view_layers["View Layer"].use_pass_normal = True
	scene.view_layers["View Layer"].use_pass_diffuse_color = True
	scene.view_layers["View Layer"].use_pass_object_index = True

	#
	#print("ROOT" + root)
	if sys.argv[7:]:
		export_file = str(sys.argv[7])
	else:
		root = root[::-1].replace(current_basename[::-1], "", 1)[::-1]
		export_file = root + "_" + extension
		
	multiplier=10

	levels=3
	density=5
	r_offset=0.2
	z_offset=0.2

	#target_obj = bpy.context.selected_objects[0]
	#target_origin = target_obj.location
	# get bounding box side lengths
	#bb_sides = get_min(target_obj.bound_box) - get_max(target_obj.bound_box)
	(dist_x, dist_y, dist_z) = tuple([abs(c) for c in bb_sides])
	originated_dist_y = .5 * dist_y
	radius = 0.5 * max(dist_x, dist_z)
	max_size = max(dist_x, dist_y, dist_z)	

	light_data = bpy.data.lights.new('light', type='AREA')
	sun = bpy.data.objects.new('light', light_data)
	sun.data.energy=max_size*5000.0
	sun.data.size = max_size*2
	#sun.location = (3, 4, -5)
	#sun.location = (dist_x*1.4, dist_y*1.4, dist_z*1.4)
	sun.location = (0,0,0)
	bpy.context.collection.objects.link(sun)
	sun_bottom = bpy.data.objects.new('light_bottom', light_data)
	sun_bottom.data.energy=max_size*5000.0
	sun_bottom.data.size = max_size*2
	sun_bottom.location = (-dist_x*1.4, dist_y*1.4, dist_z*1.4)
	#sun_bottom.location = (0, 0, dist_z/8)
	sun_bottom.rotation_euler = (2, 0.3, 0.3)
	bpy.context.collection.objects.link(sun_bottom)
	
	scene.render.image_settings.file_format='PNG'
	scene.render.filepath=export_file+current_basename+'.png'
	print("Rendering: " + scene.render.filepath)
	cam_data = bpy.data.cameras.new('camera')
	cam = bpy.data.objects.new('camera', cam_data)
	cam.data.lens = 35
	cam.data.sensor_width = 32
	cam_constraint = cam.constraints.new(type='TRACK_TO')
	cam_constraint.track_axis = 'TRACK_NEGATIVE_Z'
	cam_constraint.up_axis = 'UP_Y'
	cam_empty = bpy.data.objects.new("Empty", None)
	#cam_empty.location = (0, 0, 0)
	cam_empty.location = (0, 0, 0)
	cam.parent = cam_empty

	scene.collection.objects.link(cam_empty)
	context.view_layer.objects.active = cam_empty
	cam_constraint.target = cam_empty
	
	print(dist_x, dist_y, dist_z)
	#cam.location=Vector((dist_x, dist_y, dist_z))
	bpy.context.collection.objects.link(cam)

	"""
	# get the current object
	for _obj in scene.objects:
		if (_obj.type == 'MESH'):
			current_obj = _obj
			# set geometry to origin
			bpy.ops.object.origin_set(type="GEOMETRY_ORIGIN")
			zverts = []
			# get all z coordinates of the vertices
			for face in current_obj.data.polygons:
				verts_in_face = face.vertices[:]
				for vert in verts_in_face:
					local_point = current_obj.data.vertices[vert].co
					world_point = current_obj.matrix_world @ local_point
					zverts.append(world_point[2])

			scene.cursor.location = (0, 0, min(zverts))
			bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
			# set the object to (0,0,0)
			current_obj.location = (0,0,0)
			# reset the cursor
			scene.cursor.location = (0,0,0)
	"""
	#bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY')
	
	#bpy.ops.export_scene.fbx(filepath=export_file+current_basename+'.fbx')
	
	scene.camera=cam
	cam.location = (0, dist_y*2.5, dist_z*0.9)
	sun.location = cam.location
	sun_bottom.location = cam.location
	#cam.location=Vector((dist_x/multiplier, dist_y/multiplier, dist_z/multiplier))

	#scene.render.filepath=export_file+current_basename+'_org.png'
	#bpy.ops.render.render(write_still=True)

	#cam.location = rotate(cam.location, 45, axis=(0, 0, 1))

	for angle in range(0, 360, 90):
		sun.location = rotate(sun.location, 80, axis=(0, 0, 1))
		sun_bottom.location = rotate(sun_bottom.location, 80, axis=(0, 0, 1))
		scene.render.filepath=export_file+current_basename+'_side'+str(angle)+'.png'
		bpy.ops.render.render(write_still=True)
		cam.location = rotate(cam.location, 90, axis=(0, 0, 1))

	cam.location = (0, dist_y*2.9, dist_z*1.7)
	cam.location = rotate(cam.location, 45, axis=(0, 0, 1))
	for angle in range(45, 360, 90):
		sun.location = rotate(sun.location, 80, axis=(0, 0, 1))
		sun_bottom.location = rotate(sun_bottom.location, 80, axis=(0, 0, 1))
		scene.render.filepath=export_file+current_basename+'_side'+str(angle)+'.png'
		bpy.ops.render.render(write_still=True)
		cam.location = rotate(cam.location, 90, axis=(0, 0, 1))
		
	
	#top
	cam.location=Vector((0, 0, dist_z*5))
	sun.location = cam.location
	scene.render.filepath=export_file+current_basename+'_top.png'
	bpy.ops.render.render(write_still=True)
	
	#bottom
	#cam.location=Vector((0, 0, -dist_z*5))
	#sun.location = cam.location
	#scene.render.filepath=export_file+current_basename+'_bottom.png'
	#bpy.ops.render.render(write_still=True)
	print("Rendering done")