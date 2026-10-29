# Blender objects back into the manifest they were imported from. Only what
# changed is rewritten; everything else - the AIM3DViewer settings Blender
# has no counterpart for, metadata, rights, the exact anchoring of comments -
# is written back as it was read. Without an imported manifest a new one is
# made from the scene.
#
# After the export the scene is in step with the file written: the stored
# manifest is the new one, and new objects carry their ids.

import copy
import datetime
import json
import math
import os
import re

import bpy
from mathutils import Vector

from . import convert, state
from . import manifest as iiif
from .importer import COLLECTIONS, TEXT_NAME, first_target

P4_CONTEXT = "http://iiif.io/api/presentation/4/context.json"
EMPTY_MANAGED = {"models": [], "view": False, "aimLights": [], "cameras": [], "lights": [], "comments": []}


def stored_manifest(scene):
    text = bpy.data.texts.get(scene.get("aim3d_manifest", "")) if scene.get("aim3d_manifest") else None
    if text is None:
        return None
    try:
        return json.loads(text.as_string())
    except ValueError:
        return None


def managed_of(scene):
    try:
        managed = json.loads(scene.get("aim3d_managed", "{}"))
    except ValueError:
        managed = {}
    return {key: managed.get(key, copy.deepcopy(default)) for key, default in EMPTY_MANAGED.items()}


def skeleton(filepath, scene):
    name = os.path.splitext(os.path.basename(filepath))[0]
    base = f"./{os.path.basename(filepath)}"
    return {
        "@context": P4_CONTEXT,
        "id": base,
        "type": "Manifest",
        "label": {"en": [scene.name or name]},
        "items": [
            {
                "id": f"{base}/scene",
                "type": "Scene",
                "label": {"en": [name]},
                "items": [{"id": f"{base}/scene/page/1", "type": "AnnotationPage", "items": []}],
            }
        ],
    }


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def slug(text):
    return re.sub(r"[^A-Za-z0-9_-]+", "-", text).strip("-").lower() or "item"


def unique_id(prefix, name, taken):
    candidate = f"{prefix}/{slug(name)}"
    number = 2
    while candidate in taken:
        candidate = f"{prefix}/{slug(name)}-{number}"
        number += 1
    taken.add(candidate)
    return candidate


def all_ids(data):
    ids = set()

    def walk(value):
        if isinstance(value, dict):
            if isinstance(value.get("id"), str):
                ids.add(value["id"])
            for item in value.values():
                walk(item)
        elif isinstance(value, list):
            for item in value:
                walk(item)

    walk(data)
    return ids


def under_model(obj):
    parent = obj.parent
    while parent is not None:
        if parent.get(state.ROLE) in ("model", "pivot"):
            return True
        parent = parent.parent
    return False


def new_objects(scene, object_type, key, everywhere):
    """Objects of `object_type` the manifest does not have yet: those in the
    add-on's collection for them, or - for a manifest made from scratch -
    any in the scene."""
    collection = bpy.data.collections.get(COLLECTIONS[key])
    found = []
    for obj in scene.objects:
        if obj.get(state.ROLE) or obj.type != object_type or under_model(obj):
            continue
        if everywhere or (collection is not None and collection in obj.users_collection):
            found.append(obj)
    return found


def by_role(scene, *roles):
    return [obj for obj in scene.objects if obj.get(state.ROLE) in roles]


def vector_clean(values):
    return convert.clean_list(values)


# Models ---------------------------------------------------------------------

def set_body_transform(annotation, matrix):
    """The model's placement as the body's transform list
    ([Scale, Rotate, Translate], degrees), the target's point kept."""
    point = Vector(iiif.point_of(first_target(annotation)) or (0.0, 0.0, 0.0))
    position, rotation, scale = convert.decompose_three(matrix)
    translation = Vector(position) - point
    wrapper, resource = iiif.unwrap(annotation.get("body"))
    if wrapper is None:
        wrapper = {"type": "SpecificResource", "source": resource}
        annotation["body"] = wrapper
    transforms = []
    if any(abs(value - 1) > 1e-9 for value in scale):
        transforms.append({"type": "ScaleTransform", **dict(zip("xyz", vector_clean(scale)))})
    if any(abs(value) > 1e-9 for value in rotation):
        degrees = [math.degrees(value) for value in rotation]
        transforms.append({"type": "RotateTransform", **dict(zip("xyz", vector_clean(degrees)))})
    if translation.length > 1e-9:
        transforms.append({"type": "TranslateTransform", **dict(zip("xyz", vector_clean(translation)))})
    if transforms:
        wrapper["transform"] = transforms
    else:
        wrapper.pop("transform", None)


def set_model_transform(aim3d, root):
    matrix = convert.matrix_to_three(root.matrix_world)
    position, rotation, scale = convert.decompose_three(matrix)
    block = aim3d.setdefault("modelTransform", {})
    block["position"] = vector_clean(position)
    block["rotation"] = {**dict(zip("xyz", vector_clean(rotation))), "order": "XYZ"}
    block["scale"] = vector_clean(scale)
    up_axis = root.get("aim3d_up_axis")
    if up_axis and up_axis != "Y+":
        block["upAxis"] = up_axis


def export_models(scene, iiif_scene, aim3d, managed):
    changed = False
    roots = {obj.get("aim3d_id"): obj for obj in by_role(scene, "model")}
    for page in iiif.as_list(iiif_scene.get("items")):
        if not isinstance(page, dict) or not isinstance(page.get("items"), list):
            continue
        kept = []
        for annotation in page["items"]:
            annotation_id = annotation.get("id") if isinstance(annotation, dict) else None
            if annotation_id in managed["models"]:
                root = roots.get(annotation_id)
                if root is None:
                    changed = True
                    continue
                if state.changed(root, scene):
                    matrix = convert.matrix_to_three(root.matrix_world)
                    if root.get("aim3d_model_index") == 0 and aim3d is not None:
                        set_model_transform(aim3d, root)
                    else:
                        set_body_transform(annotation, matrix)
                    changed = True
            kept.append(annotation)
        page["items"] = kept
    return changed


def export_glb(filepath, iiif_scene, reports):
    """The scene's meshes as a GLB next to the manifest, painted into the
    Scene."""
    path = os.path.splitext(filepath)[0] + ".glb"
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_visible=True, export_cameras=False, export_lights=False
    )
    scene_id = iiif_scene.get("id", "")
    pages = iiif_scene.setdefault("items", [])
    if not pages:
        pages.append({"id": f"{scene_id}/page/1", "type": "AnnotationPage", "items": []})
    pages[0].setdefault("items", []).insert(0, {
        "id": f"{scene_id}/annotation/model",
        "type": "Annotation",
        "motivation": ["painting"],
        "body": {"id": f"./{os.path.basename(path)}", "type": "Model", "format": "model/gltf-binary"},
        "target": {"id": scene_id, "type": "Scene"},
    })
    reports.append(("INFO", f"Model written to {path}"))


# The view camera --------------------------------------------------------------

def export_view(scene, aim3d, view):
    if view is None or aim3d is None or not state.changed(view, scene):
        return False
    camera_state = state.camera_state(view, scene)
    block = aim3d.setdefault("camera", {})
    block["position"] = vector_clean(camera_state["position"])
    block["target"] = vector_clean(camera_state["target"])
    block["up"] = vector_clean(list(view.get("aim3d_up", [0, 1, 0])))
    block["fov"] = convert.clean_number(camera_state["fov"])
    block.setdefault("zoom", 1)
    block["distance"] = convert.clean_number(
        state.distance_between(camera_state["position"], camera_state["target"])
    )
    block["perspectiveMode"] = "orthographic" if camera_state["orthographic"] else "perspective"
    return True


# Lights of the AIM3DViewer block -----------------------------------------------

def light_entry(entry, obj):
    entry = copy.deepcopy(entry)
    is_new = not entry
    light = state.light_state(obj)
    entry["type"] = light["type"]
    if is_new or "name" in entry:
        entry["name"] = obj.name
    entry["position"] = vector_clean(light["position"])
    entry["target"] = vector_clean(light["target"])
    entry["color"] = light["color"]
    entry["intensity"] = convert.clean_number(light["intensity"])
    if not light["visible"] or "visible" in entry:
        entry["visible"] = light["visible"]
    if is_new or "castShadow" in entry:
        entry["castShadow"] = light["castShadow"]
    if light["type"] == "SpotLight":
        entry["angle"] = convert.clean_number(light["angle"])
        entry["penumbra"] = convert.clean_number(light["penumbra"])
    else:
        entry.pop("angle", None)
        entry.pop("penumbra", None)
    return entry


def export_aim3d_lights(scene, aim3d, managed, additions):
    """The light list rebuilt: lights deleted in Blender left out, changed
    ones updated, new ones appended. Returns (changed, {object: index})."""
    if aim3d is None:
        return False, {}
    original = iiif.as_list(aim3d.get("lights"))
    objects = {obj.get("aim3d_light_index"): obj for obj in by_role(scene, "light") if "aim3d_light_index" in obj}
    lights, indices, changed = [], {}, False
    for index, entry in enumerate(original):
        if index in managed["aimLights"]:
            obj = objects.get(index)
            if obj is None:
                changed = True
                continue
            if state.changed(obj, scene):
                entry = light_entry(entry, obj)
                changed = True
            indices[obj] = len(lights)
        lights.append(entry)
    for obj in additions:
        indices[obj] = len(lights)
        lights.append(light_entry({}, obj))
        changed = True
    if changed:
        aim3d["lights"] = lights
    return changed, indices


# IIIF cameras and lights painted into the Scene ----------------------------------

def update_scene_resource(annotation, obj, scene, scene_id):
    wrapper, resource = iiif.unwrap(annotation.get("body"))
    if wrapper is not None:
        # The orientation is now the lookAt point.
        wrapper.pop("transform", None)
    if obj.type == "CAMERA":
        camera = state.camera_state(obj, scene)
        position, target = camera["position"], camera["target"]
        if camera["orthographic"]:
            resource["type"] = "OrthographicCamera"
            resource["viewHeight"] = convert.clean_number(camera["orthoScale"])
            resource.pop("fieldOfView", None)
        else:
            resource["type"] = "PerspectiveCamera"
            resource["fieldOfView"] = convert.clean_number(camera["fov"])
            resource.pop("viewHeight", None)
    else:
        light = state.light_state(obj)
        position, target = light["position"], light["target"]
        resource["type"] = light["type"]
        resource["color"] = light["color"]
        iiif.set_intensity(resource, convert.clean_number(light["intensity"]))
        if light["type"] == "SpotLight":
            resource["angle"] = convert.clean_number(math.degrees(light["angle"]))
        else:
            resource.pop("angle", None)
    resource["lookAt"] = iiif.point_selector(vector_clean(target))
    annotation["target"] = iiif.scene_target(scene_id, vector_clean(position))


def new_scene_resource(obj, scene, scene_id, taken):
    kind = "cameras" if obj.type == "CAMERA" else "lights"
    annotation = {
        "id": unique_id(f"{scene_id}/{kind}", obj.name, taken),
        "type": "Annotation",
        "motivation": ["painting"],
        "body": {"type": "PerspectiveCamera" if obj.type == "CAMERA" else "PointLight", "label": {"en": [obj.name]}},
        "target": {"id": scene_id, "type": "Scene"},
    }
    update_scene_resource(annotation, obj, scene, scene_id)
    return annotation


def export_scene_resources(scene, iiif_scene, managed, additions, taken):
    scene_id = iiif_scene.get("id", "")
    objects = {obj.get("aim3d_id"): obj for obj in by_role(scene, "camera", "light") if obj.get("aim3d_id")}
    listed = set(managed["cameras"]) | set(managed["lights"])
    changed = False
    pages = [page for page in iiif.as_list(iiif_scene.get("items")) if isinstance(page, dict)]
    for page in pages:
        if not isinstance(page.get("items"), list):
            continue
        kept = []
        for annotation in page["items"]:
            annotation_id = annotation.get("id") if isinstance(annotation, dict) else None
            if annotation_id in listed:
                obj = objects.get(annotation_id)
                if obj is None:
                    changed = True
                    continue
                if state.changed(obj, scene):
                    update_scene_resource(annotation, obj, scene, scene_id)
                    changed = True
            kept.append(annotation)
        page["items"] = kept
    if additions:
        if not pages:
            pages.append({"id": f"{scene_id}/page/1", "type": "AnnotationPage", "items": []})
            iiif_scene["items"] = pages
        for obj in additions:
            annotation = new_scene_resource(obj, scene, scene_id, taken)
            pages[0].setdefault("items", []).append(annotation)
            obj["aim3d_id"] = annotation["id"]
        changed = True
    return changed


# Comments ---------------------------------------------------------------------

def model_space_point(scene, point):
    """A scene point in the first model root's space (the viewer's exact
    anchoring of a comment)."""
    root = next((obj for obj in by_role(scene, "model") if obj.get("aim3d_model_index") == 0), None)
    if root is None:
        return point
    matrix = convert.matrix_to_three(root.matrix_world).inverted_safe()
    return list(matrix @ Vector(point))


def update_comment(annotation, obj, scene, scene_id):
    previous = json.loads(obj.get(state.STATE) or "{}")
    comment = state.comment_state(obj)
    if not state.close(previous.get("point"), comment["point"]):
        source = first_target(annotation) or {}
        source_id = (source.get("source") or {}).get("id") if isinstance(source.get("source"), dict) else None
        annotation["target"] = iiif.scene_target(source_id or scene_id, vector_clean(comment["point"]))
        anchoring = annotation.get("AIM3DViewer")
        if isinstance(anchoring, dict):
            for key in ("faceIndex", "faceNumbers", "polygon"):
                anchoring.pop(key, None)
            anchoring["point"] = vector_clean(model_space_point(scene, comment["point"]))
    if previous.get("label") != comment["label"]:
        annotation["label"] = iiif.set_first_text(annotation.get("label"), comment["label"])
    if previous.get("text") != comment["text"]:
        annotation["body"] = iiif.set_body_text(annotation.get("body"), comment["text"])


def new_comment(obj, scene, scene_id, taken):
    comment = state.comment_state(obj)
    label = comment["label"] or obj.name
    obj["aim3d_label"] = label
    obj["aim3d_text"] = comment["text"]
    return {
        "id": unique_id(f"{scene_id}/comments", label, taken),
        "type": "Annotation",
        "motivation": ["commenting"],
        "label": {"en": [label]},
        "body": {"type": "TextualBody", "value": comment["text"], "format": "text/plain"},
        "target": iiif.scene_target(scene_id, vector_clean(comment["point"])),
    }


def export_comments(scene, iiif_scene, managed, additions, taken):
    scene_id = iiif_scene.get("id", "")
    objects = {obj.get("aim3d_id"): obj for obj in by_role(scene, "comment") if obj.get("aim3d_id")}
    changed = False
    pages = [page for page in iiif.as_list(iiif_scene.get("annotations")) if isinstance(page, dict)]
    for page in pages:
        if not isinstance(page.get("items"), list):
            continue
        kept = []
        for annotation in page["items"]:
            annotation_id = annotation.get("id") if isinstance(annotation, dict) else None
            if annotation_id in managed["comments"]:
                obj = objects.get(annotation_id)
                if obj is None:
                    changed = True
                    continue
                if state.changed(obj, scene):
                    update_comment(annotation, obj, scene, scene_id)
                    changed = True
            kept.append(annotation)
        page["items"] = kept
    if additions:
        if not pages:
            pages.append({"id": f"{scene_id}/page/comments", "type": "AnnotationPage", "items": []})
            iiif_scene["annotations"] = pages
        for obj in additions:
            annotation = new_comment(obj, scene, scene_id, taken)
            pages[0].setdefault("items", []).append(annotation)
            obj["aim3d_id"] = annotation["id"]
        changed = True
    return changed


# -----------------------------------------------------------------------------

def export_manifest(context, filepath, write_aim3d=True, export_model=True):
    scene = context.scene
    context.view_layer.update()
    reports = []
    stored = stored_manifest(scene)
    fresh = stored is None
    data = skeleton(filepath, scene) if fresh else copy.deepcopy(stored)
    managed = EMPTY_MANAGED if fresh else managed_of(scene)
    managed = copy.deepcopy(managed)
    iiif_scene = iiif.first_scene(data)
    if iiif_scene is None:
        raise ValueError("The stored manifest has no Scene")
    taken = all_ids(data)

    # A manifest made here gets the block; an imported one keeps its form
    # (a plain IIIF manifest gets IIIF cameras and lights).
    if fresh and write_aim3d:
        data["AIM3DViewer"] = {"version": "1.0", "generatedAt": now()}
    aim3d = data.get("AIM3DViewer") if isinstance(data.get("AIM3DViewer"), dict) else None

    views = by_role(scene, "view")
    view = views[0] if views else None
    new_cameras = new_objects(scene, "CAMERA", "camera", fresh)
    if view is None and scene.camera is not None and not scene.camera.get(state.ROLE) and aim3d is not None:
        # The scene's camera becomes the viewer's.
        view = scene.camera
        new_cameras = [obj for obj in new_cameras if obj != view]
        view[state.ROLE] = "view"
        if "aim3d_distance" not in view:
            # Orbiting round the point in front of it nearest the origin.
            ahead = convert.forward(view.matrix_world).dot(-view.matrix_world.translation)
            view["aim3d_distance"] = max(ahead, 1.0)
    elif view is not None and aim3d is None:
        new_cameras.append(view)
        del view[state.ROLE]
        view = None
    new_lights = new_objects(scene, "LIGHT", "light", fresh)
    new_comments = new_objects(scene, "EMPTY", "comment", False)

    changed = False
    if not by_role(scene, "model") and export_model and fresh:
        export_glb(filepath, iiif_scene, reports)
        changed = True
    changed |= export_models(scene, iiif_scene, aim3d, managed)
    changed |= export_view(scene, aim3d, view)
    if aim3d is not None:
        lights_changed, light_indices = export_aim3d_lights(scene, aim3d, managed, new_lights)
        resource_lights = []
    else:
        lights_changed, light_indices = False, {}
        resource_lights = new_lights
    changed |= lights_changed
    changed |= export_scene_resources(scene, iiif_scene, managed, new_cameras + resource_lights, taken)
    changed |= export_comments(scene, iiif_scene, managed, new_comments, taken)
    if changed and aim3d is not None:
        aim3d["generatedAt"] = now()

    iiif.dump(data, filepath)
    sync(context, data, filepath, view, light_indices, new_cameras + resource_lights, new_comments)
    return reports


def sync(context, data, filepath, view, light_indices, new_resources, new_comments):
    """The scene in step with the manifest just written."""
    scene = context.scene
    text = bpy.data.texts.get(scene.get("aim3d_manifest", "")) or bpy.data.texts.new(TEXT_NAME)
    text.clear()
    text.write(json.dumps(data, indent=2, ensure_ascii=False))
    scene["aim3d_manifest"] = text.name
    scene["aim3d_source"] = filepath

    for obj in new_resources:
        obj[state.ROLE] = "camera" if obj.type == "CAMERA" else "light"
    for obj in new_comments:
        obj[state.ROLE] = "comment"
    for obj, index in light_indices.items():
        obj[state.ROLE] = "light"
        obj["aim3d_light_index"] = index

    managed = {
        "models": [obj["aim3d_id"] for obj in by_role(scene, "model") if obj.get("aim3d_id")],
        "view": view is not None,
        "aimLights": sorted(light_indices.values()),
        "cameras": [obj["aim3d_id"] for obj in by_role(scene, "camera") if obj.get("aim3d_id")],
        "lights": [obj["aim3d_id"] for obj in by_role(scene, "light") if obj.get("aim3d_id")],
        "comments": [obj["aim3d_id"] for obj in by_role(scene, "comment") if obj.get("aim3d_id")],
    }
    scene["aim3d_managed"] = json.dumps(managed)
    for obj in scene.objects:
        if obj.get(state.ROLE) in ("model", "view", "camera", "light", "comment"):
            state.remember(obj, scene)
