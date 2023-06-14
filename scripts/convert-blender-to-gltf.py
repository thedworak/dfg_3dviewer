import bpy
import os
import sys

print("Converting: '" + sys.argv[6] + "'")
print("Saving to : '" + sys.argv[7] + "'")

bpy.ops.wm.open_mainfile(filepath=sys.argv[6])
bpy.ops.export_scene.gltf(filepath=sys.argv[7], export_format="GLB")