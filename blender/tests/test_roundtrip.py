# Round-trip tests of the add-on, run inside Blender:
#
#   blender -b --factory-startup --python-exit-code 1 --python blender/tests/test_roundtrip.py
#
# Every example manifest exports unchanged when nothing is touched in
# Blender; edits come back where the viewer reads them; the manifests written
# pass scripts/inspect-manifest.mjs (when node is installed).

import json
import math
import os
import shutil
import subprocess
import sys
import tempfile
import traceback

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.dirname(HERE))

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import aim3d_iiif  # noqa: E402
from aim3d_iiif import exporter, importer  # noqa: E402

EXAMPLES = os.path.join(REPO, "viewer", "manifesto", "examples")
VIEWER = os.path.join(REPO, "viewer")
OUT = tempfile.mkdtemp(prefix="aim3d-blender-")
NODE = shutil.which("node")
failures = []


def reset():
    for collection in (bpy.data.objects, bpy.data.collections, bpy.data.texts, bpy.data.meshes,
                       bpy.data.cameras, bpy.data.lights, bpy.data.materials, bpy.data.images):
        for item in list(collection):
            collection.remove(item)
    scene = bpy.context.scene
    for key in list(scene.keys()):
        del scene[key]
    scene.camera = None


def load(path):
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def find(name):
    return next(obj for obj in bpy.context.scene.objects if obj.name == name)


def by(role, **props):
    return [
        obj for obj in bpy.context.scene.objects
        if obj.get("aim3d_role") == role and all(obj.get(key) == value for key, value in props.items())
    ]


def close(first, second, tolerance=1e-4):
    return all(math.isclose(a, b, abs_tol=tolerance) for a, b in zip(first, second)) and len(first) == len(second)


def inspect_errors(path):
    if not NODE:
        return None
    result = subprocess.run(
        [NODE, os.path.join(REPO, "scripts", "inspect-manifest.mjs"), path],
        capture_output=True, text=True, cwd=REPO,
    )
    return result.returncode


def roundtrip(path, import_models=False):
    reset()
    importer.import_manifest(bpy.context, path, import_models=import_models, model_base=VIEWER)
    out = os.path.join(OUT, os.path.basename(path))
    exporter.export_manifest(bpy.context, out)
    return out


def test_untouched_examples():
    """Nothing changed in Blender: the manifest comes back as it was."""
    for name in sorted(os.listdir(EXAMPLES)):
        path = os.path.join(EXAMPLES, name)
        if not name.endswith(".json") or "items" not in load(path):
            continue
        out = roundtrip(path)
        assert load(out) == load(path), f"{name} changed in a round trip without edits"


def test_model_import():
    reset()
    reports = importer.import_manifest(
        bpy.context, os.path.join(EXAMPLES, "box-iiif-p4.json"), import_models=True, model_base=VIEWER
    )
    assert not reports, reports
    root = by("model")[0]
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    assert meshes, "box.glb was not imported"
    assert all(mesh.parent and mesh.parent.parent == root for mesh in meshes if mesh.parent.get("aim3d_role") == "pivot")
    # ScaleTransform 1.5 of the IIIF body.
    assert close(root.matrix_world.to_scale(), (1.5, 1.5, 1.5))


def test_aim3d_edits():
    path = os.path.join(EXAMPLES, "box-aim3d-local.json")
    original = load(path)
    reset()
    importer.import_manifest(bpy.context, path, import_models=True, model_base=VIEWER)

    view = by("view")[0]
    target = by("view-target")[0]
    # Blender (1, -6, 2) is the viewer's (1, 2, 6).
    view.location = (1, -6, 2)
    target.location = (0, 0, 0.5)
    changed = by("light")[0]
    changed.data.color = (1, 0, 0)

    collection = importer.ensure_collection(bpy.context.scene, "light")
    data = bpy.data.lights.new("Rim", "POINT")
    data.energy = 250
    rim = bpy.data.objects.new("Rim", data)
    collection.objects.link(rim)
    rim.location = (2, 3, 4)

    bpy.context.scene.cursor.location = (0.1, 0.2, 0.3)
    bpy.ops.aim3d.add_comment()
    comment = bpy.context.active_object
    comment["aim3d_label"] = "Corner"
    comment["aim3d_text"] = "Added in Blender"

    root = by("model")[0]
    root.location = (0, 0, 1)

    out = os.path.join(OUT, "box-aim3d-edited.json")
    exporter.export_manifest(bpy.context, out)
    result = load(out)
    block = result["AIM3DViewer"]

    assert close(block["camera"]["position"], [1, 2, 6]), block["camera"]
    assert close(block["camera"]["target"], [0, 0.5, 0]), block["camera"]
    assert math.isclose(block["camera"]["distance"], (Vector((1, 2, 6)) - Vector((0, 0.5, 0))).length, abs_tol=1e-4)
    assert block["camera"]["up"] == original["AIM3DViewer"]["camera"]["up"]

    original_lights = original["AIM3DViewer"]["lights"]
    assert len(block["lights"]) == len(original_lights) + 1
    assert block["lights"][0] == original_lights[0], "the ambient light, not in Blender, is kept"
    edited = block["lights"][changed["aim3d_light_index"]]
    assert edited["color"] == "#ff0000", edited
    rim_entry = block["lights"][-1]
    assert rim_entry["type"] == "PointLight" and rim_entry["name"] == "Rim"
    assert close(rim_entry["position"], [2, 4, -3]) and math.isclose(rim_entry["intensity"], 2.5)

    assert close(block["modelTransform"]["position"], [0, 1, 0]), block["modelTransform"]
    for key in ("wireframe", "shadingMode"):
        if key in original["AIM3DViewer"]["modelTransform"]:
            assert block["modelTransform"][key] == original["AIM3DViewer"]["modelTransform"][key]
    for key in original["AIM3DViewer"]:
        assert key in block, f"AIM3DViewer.{key} lost"
    assert block["viewer"] == original["AIM3DViewer"]["viewer"]
    assert block["generatedAt"] != original["AIM3DViewer"]["generatedAt"]

    comments = [item for page in result["items"][0]["annotations"] for item in page["items"]]
    added = [item for item in comments if item["label"] == {"en": ["Corner"]}]
    assert added and added[0]["body"]["value"] == "Added in Blender"
    assert close(
        [added[0]["target"]["selector"][0][key] for key in "xyz"], [0.1, 0.3, -0.2]
    ), added[0]["target"]

    # The scene is in step with the file: a second export changes nothing.
    again = os.path.join(OUT, "box-aim3d-edited-again.json")
    exporter.export_manifest(bpy.context, again)
    assert load(again) == result, "a second export without edits differs"
    for written in (out,):
        assert inspect_errors(written) in (None, 0), f"inspect-manifest reports errors in {written}"


def test_light_removed():
    path = os.path.join(EXAMPLES, "wolpa-synagogue-aim3d-local-night-spotlights.json")
    original = load(path)["AIM3DViewer"]["lights"]
    reset()
    importer.import_manifest(bpy.context, path, import_models=False)
    spot = by("light", aim3d_light_index=3)[0]
    bpy.data.objects.remove(spot)
    out = os.path.join(OUT, "wolpa-removed.json")
    exporter.export_manifest(bpy.context, out)
    lights = load(out)["AIM3DViewer"]["lights"]
    assert lights == original[:3] + original[4:], lights
    # The indices follow: the point light, now fifth, exports in place.
    point = by("light", aim3d_light_index=4)[0]
    assert point.data.type == "POINT"
    point.data.energy *= 2
    exporter.export_manifest(bpy.context, out)
    lights = load(out)["AIM3DViewer"]["lights"]
    assert math.isclose(lights[4]["intensity"], original[5]["intensity"] * 2), lights[4]
    assert lights[:4] == original[:3] + original[4:5]


def test_iiif_edits():
    path = os.path.join(EXAMPLES, "box-iiif-p4.json")
    reset()
    importer.import_manifest(bpy.context, path, import_models=False)
    scene_id = "./manifests/box-iiif-p4.json/scene"

    spot = by("light", aim3d_id="./manifests/box-iiif-p4.json/anno/spot")[0]
    spot.location = (-3, -2, 5)
    spot.data.spot_size = math.radians(60)
    sun = by("light", aim3d_id="./manifests/box-iiif-p4.json/anno/sun")[0]
    bpy.data.objects.remove(sun)
    camera = by("camera", aim3d_id="./manifests/box-iiif-p4.json/anno/camera")[0]
    camera.data.lens = 70
    corner = by("comment", aim3d_id="./manifests/box-iiif-p4.json/comments/corner")[0]
    corner.location = (1, -1, 1)
    corner["aim3d_text"] = "Moved in Blender"

    out = os.path.join(OUT, "box-iiif-p4-edited.json")
    exporter.export_manifest(bpy.context, out)
    result = load(out)
    assert "AIM3DViewer" not in result, "a plain IIIF manifest stays plain"
    painting = {item["id"]: item for page in result["items"][0]["items"] for item in page["items"]}
    assert "./manifests/box-iiif-p4.json/anno/sun" not in painting
    assert "./manifests/box-iiif-p4.json/anno/ambient" in painting, "lights Blender does not show are kept"
    spot_body = painting["./manifests/box-iiif-p4.json/anno/spot"]["body"]
    assert math.isclose(spot_body["angle"], 30, abs_tol=1e-3), spot_body
    assert spot_body["intensity"]["unit"] == "relative"
    selector = painting["./manifests/box-iiif-p4.json/anno/spot"]["target"]["selector"][0]
    assert close([selector[key] for key in "xyz"], [-3, 5, 2]), selector
    camera_body = painting["./manifests/box-iiif-p4.json/anno/camera"]["body"]
    assert camera_body["fieldOfView"] < 40 and camera_body["label"] == {"en": ["Front, slightly above"]}
    original = load(path)
    original_painting = {item["id"]: item for page in original["items"][0]["items"] for item in page["items"]}
    assert painting["./manifests/box-iiif-p4.json/cameras/top"] == original_painting["./manifests/box-iiif-p4.json/cameras/top"]

    comments = {item["id"]: item for page in result["items"][0]["annotations"] for item in page["items"]}
    corner_out = comments["./manifests/box-iiif-p4.json/comments/corner"]
    assert corner_out["body"]["value"] == "Moved in Blender"
    assert corner_out["target"]["source"]["id"] == scene_id
    assert close([corner_out["target"]["selector"][0][key] for key in "xyz"], [1, 1, 1])
    assert inspect_errors(out) in (None, 0), "inspect-manifest reports errors"


def test_new_manifest():
    reset()
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.5))
    camera = bpy.data.objects.new("Camera", bpy.data.cameras.new("Camera"))
    bpy.context.scene.collection.objects.link(camera)
    camera.location = (0, -5, 1)
    camera.rotation_euler = (math.radians(90), 0, 0)
    bpy.context.scene.camera = camera
    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    bpy.context.scene.collection.objects.link(sun)
    sun.location = (0, 0, 10)

    out = os.path.join(OUT, "new", "scene.json")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    exporter.export_manifest(bpy.context, out)
    result = load(out)
    assert os.path.isfile(os.path.join(OUT, "new", "scene.glb"))
    painting = result["items"][0]["items"][0]["items"]
    assert painting[0]["body"] == {"id": "./scene.glb", "type": "Model", "format": "model/gltf-binary"}
    block = result["AIM3DViewer"]
    assert close(block["camera"]["position"], [0, 1, 5]), block["camera"]
    assert close(block["camera"]["target"], [0, 1, 0]), block["camera"]
    assert block["lights"][0]["type"] == "DirectionalLight"
    assert close(block["lights"][0]["position"], [0, 10, 0])
    assert close(block["lights"][0]["target"], [0, 9, 0])
    assert inspect_errors(out) in (None, 0), "inspect-manifest reports errors"

    # Imported again, it exports unchanged.
    again = roundtrip(out)
    assert load(again) == result


TESTS = [test_untouched_examples, test_model_import, test_aim3d_edits, test_light_removed, test_iiif_edits, test_new_manifest]


def main():
    aim3d_iiif.register()
    try:
        for test in TESTS:
            try:
                test()
                print(f"ok    {test.__name__}")
            except Exception:  # noqa: BLE001 - every failure reported
                failures.append(test.__name__)
                print(f"FAIL  {test.__name__}")
                traceback.print_exc()
    finally:
        aim3d_iiif.unregister()
    print(f"\n{len(TESTS) - len(failures)} passed, {len(failures)} failed (output in {OUT})")
    if NODE is None:
        print("node not found: manifests not inspected")
    if failures:
        sys.exit(1)


main()
