# A manifest as Blender objects: the models of its first Scene, the
# AIM3DViewer view camera and lights, the IIIF cameras and lights painted
# into the Scene, and its comments on points. The whole manifest is kept in
# a text block, so the exporter can write back what Blender does not show.

import json
import math
import os
import tempfile

import bpy
from mathutils import Matrix, Vector

from . import convert, state
from . import manifest as iiif

TEXT_NAME = "AIM3D manifest.json"
ROOT_COLLECTION = "AIM3D"
COLLECTIONS = {
    "model": "AIM3D Model",
    "camera": "AIM3D Cameras",
    "light": "AIM3D Lights",
    "comment": "AIM3D Comments",
}


def ensure_collection(scene, key):
    root = bpy.data.collections.get(ROOT_COLLECTION) or bpy.data.collections.new(ROOT_COLLECTION)
    if root.name not in scene.collection.children:
        scene.collection.children.link(root)
    collection = bpy.data.collections.get(COLLECTIONS[key]) or bpy.data.collections.new(COLLECTIONS[key])
    if collection.name not in root.children:
        root.children.link(collection)
    return collection


def find_layer_collection(layer_collection, collection):
    if layer_collection.collection == collection:
        return layer_collection
    for child in layer_collection.children:
        found = find_layer_collection(child, collection)
        if found:
            return found
    return None


def vector3(value, default):
    if isinstance(value, (list, tuple)) and len(value) >= 3:
        values = value[:3]
    elif isinstance(value, dict):
        values = [value.get(key) for key in ("x", "y", "z")]
    else:
        return list(default)
    try:
        values = [float(item) for item in values]
    except (TypeError, ValueError):
        return list(default)
    return values if all(math.isfinite(item) for item in values) else list(default)


def body_placement(wrapper, point, default_direction):
    """Position and direction of a camera or light: it starts at the origin
    facing its default direction, is transformed by the body's transform list,
    then placed at the target's point (viewer/IIIF/presentation4.js)."""
    matrix = convert.transform_matrix(wrapper.get("transform") if wrapper else None)
    direction = (matrix.to_3x3() @ Vector(default_direction)).normalized()
    position = Vector(point) + matrix.translation
    return list(position), list(direction)


def resolve_look_at(look_at, annotations_by_id):
    if not look_at:
        return None
    if isinstance(look_at, dict) and iiif.type_of(look_at) in ("PointSelector", "SpecificResource", "WktSelector"):
        return iiif.point_of(look_at) or [0.0, 0.0, 0.0]
    look_id = look_at if isinstance(look_at, str) else look_at.get("id") if isinstance(look_at, dict) else None
    annotation = annotations_by_id.get(look_id)
    if annotation is not None:
        return iiif.point_of(first_target(annotation)) or [0.0, 0.0, 0.0]
    return [0.0, 0.0, 0.0]


def first_target(annotation):
    targets = iiif.as_list(annotation.get("target"))
    return targets[0] if targets and isinstance(targets[0], dict) else None


def aim(obj, position, target=None, direction=None, up=(0.0, 1.0, 0.0)):
    """Places a camera or light at `position` (viewer space) looking at
    `target`, or along `direction`."""
    origin = convert.to_blender(position)
    if target is not None:
        point = convert.to_blender(target)
        if (point - origin).length < 1e-9:
            point = origin + convert.to_blender((0.0, -1.0, 0.0))
        obj["aim3d_distance"] = (point - origin).length
    else:
        point = origin + convert.to_blender(direction or (0.0, 0.0, -1.0))
        obj["aim3d_distance"] = 1.0
    obj.matrix_world = convert.look_at_matrix(origin, point, convert.to_blender(up).normalized())
    return obj


def new_camera(name, collection, fov=45.0, orthographic=False, view_height=None, distance=1.0):
    data = bpy.data.cameras.new(name)
    convert.set_vertical_fov(data, math.radians(fov))
    if orthographic:
        data.type = "ORTHO"
        data.ortho_scale = view_height or 2 * distance * math.tan(math.radians(fov) / 2)
    data.clip_end = max(data.clip_end, distance * 20)
    obj = bpy.data.objects.new(name, data)
    collection.objects.link(obj)
    obj[state.ROLE] = "camera"
    return obj


def new_light(name, collection, kind, color, intensity, visible=True, cast_shadow=None, angle=None, penumbra=None):
    blender_type = state.BLENDER_LIGHT_TYPES[kind]
    data = bpy.data.lights.new(name, blender_type)
    data.color = convert.hex_to_linear(color)
    factor = convert.SUN_STRENGTH_PER_INTENSITY if blender_type == "SUN" else convert.POINT_WATTS_PER_INTENSITY
    data.energy = intensity * factor
    if cast_shadow is not None:
        data.use_shadow = bool(cast_shadow)
    if blender_type == "SPOT":
        if angle is not None:
            data.spot_size = min(max(2 * angle, math.radians(1)), math.pi)
        if penumbra is not None:
            data.spot_blend = min(max(penumbra, 0.0), 1.0)
    obj = bpy.data.objects.new(name, data)
    collection.objects.link(obj)
    obj.hide_render = not visible
    obj.hide_viewport = not visible
    obj[state.ROLE] = "light"
    return obj


def import_model_file(context, path, extension):
    """The new objects of the imported file. Formats other than glTF and FBX
    are read as Y-up, as the viewer reads them (the manifest's upAxis turns
    them upright)."""
    before = set(bpy.data.objects)
    axes = {"forward_axis": "NEGATIVE_Z", "up_axis": "Y"}
    legacy_axes = {"axis_forward": "-Z", "axis_up": "Y"}
    if extension in (".glb", ".gltf"):
        bpy.ops.import_scene.gltf(filepath=path)
    elif extension == ".fbx":
        bpy.ops.import_scene.fbx(filepath=path)
    elif extension == ".obj":
        bpy.ops.wm.obj_import(filepath=path, **axes)
    elif extension in (".stl", ".ply"):
        current, legacy = {".stl": ("stl_import", "stl"), ".ply": ("ply_import", "ply")}[extension]
        try:
            getattr(bpy.ops.wm, current)(filepath=path, **axes)
        except AttributeError:
            getattr(bpy.ops.import_mesh, legacy)(filepath=path, **legacy_axes)
    else:
        return None
    return [obj for obj in bpy.data.objects if obj not in before]


def import_model_annotations(context, iiif_scene, aim3d, source, options, managed, reports):
    collection = ensure_collection(context.scene, "model")
    model_transform = aim3d.get("modelTransform") if isinstance(aim3d.get("modelTransform"), dict) else None
    index = 0
    for _page, annotation in iiif.painting_annotations(iiif_scene):
        wrapper, resource = iiif.unwrap(annotation.get("body"))
        if not iiif.is_model(resource):
            continue
        url = str(resource.get("id", ""))
        point = iiif.point_of(first_target(annotation)) or [0.0, 0.0, 0.0]
        placement = Matrix.Translation(point) @ convert.transform_matrix(wrapper.get("transform") if wrapper else None)
        up_axis = None
        if index == 0 and model_transform:
            # AIM3DViewer.modelTransform, the first model's exact transform,
            # wins over its placement in the Scene.
            position, rotation, scale = convert.decompose_three(placement)
            order = "XYZ"
            position = vector3(model_transform.get("position"), position)
            rotation_value = model_transform.get("rotation")
            if isinstance(rotation_value, dict):
                order = str(rotation_value.get("order") or "XYZ")
            rotation = vector3(rotation_value, rotation)
            scale = vector3(model_transform.get("scale"), scale)
            placement = convert.compose_three(position, rotation, scale, order)
            up_axis = convert.normalize_up_axis(model_transform.get("upAxis"))

        label = iiif.first_text(annotation.get("label")) or iiif.first_text(resource.get("label"))
        name = label or os.path.basename(url) or f"Model {index + 1}"
        root = bpy.data.objects.new(name, None)
        root.empty_display_type = "PLAIN_AXES"
        collection.objects.link(root)
        root.matrix_world = convert.matrix_to_blender(placement)
        root[state.ROLE] = "model"
        root["aim3d_id"] = str(annotation.get("id", ""))
        root["aim3d_model_index"] = index
        root["aim3d_url"] = url
        if up_axis:
            root["aim3d_up_axis"] = up_axis

        # The up-axis fix sits under the root, as in the viewer: the root's
        # transform stays the upright model's.
        pivot = bpy.data.objects.new(f"{name} (up axis)", None)
        pivot.empty_display_size = 0.01
        collection.objects.link(pivot)
        pivot.parent = root
        pivot.matrix_basis = convert.matrix_to_blender(convert.up_axis_matrix(up_axis))
        pivot[state.ROLE] = "pivot"

        if options.get("import_models", True):
            load_model(context, url, resource, source, options, collection, pivot, reports)
        managed["models"].append(root["aim3d_id"])
        index += 1


def load_model(context, url, resource, source, options, collection, pivot, reports):
    extension = iiif.model_extension(url, resource)
    if extension not in iiif.MODEL_EXTENSIONS:
        reports.append(("WARNING", f"{url}: format not supported in Blender, placeholder only"))
        return
    cache = os.path.join(tempfile.gettempdir(), "aim3d_models")
    path = iiif.fetch_model(url, source, options.get("model_base", ""), cache)
    if not path:
        reports.append(("WARNING", f"{url}: model not found, placeholder only"))
        return
    layer_collection = find_layer_collection(context.view_layer.layer_collection, collection)
    previous = context.view_layer.active_layer_collection
    if layer_collection:
        context.view_layer.active_layer_collection = layer_collection
    try:
        new_objects = import_model_file(context, path, extension) or []
    except RuntimeError as error:
        reports.append(("WARNING", f"{url}: {error}"))
        new_objects = []
    finally:
        context.view_layer.active_layer_collection = previous
    for obj in new_objects:
        if obj.parent is None:
            obj.parent = pivot


def import_view_camera(context, aim3d, managed):
    camera = aim3d.get("camera")
    if not isinstance(camera, dict):
        return None
    collection = ensure_collection(context.scene, "camera")
    position = vector3(camera.get("position"), (0.0, 0.0, 5.0))
    target = vector3(camera.get("target"), (0.0, 0.0, 0.0))
    up = vector3(camera.get("up"), (0.0, 1.0, 0.0))
    distance = state.distance_between(position, target)
    orthographic = camera.get("perspectiveMode") == "orthographic"
    obj = new_camera("AIM3D View", collection, float(camera.get("fov") or 45), orthographic, None, distance)
    obj[state.ROLE] = "view"
    obj["aim3d_up"] = up
    aim(obj, position, target, up=up)
    if Vector(up).normalized().dot(Vector((0, 1, 0))) > 0.999999:
        # The orbit target as an object the camera keeps looking at.
        empty = bpy.data.objects.new("AIM3D View Target", None)
        empty.empty_display_type = "SPHERE"
        empty.empty_display_size = max(distance * 0.01, 1e-3)
        collection.objects.link(empty)
        empty.location = convert.to_blender(target)
        empty[state.ROLE] = "view-target"
        constraint = obj.constraints.new("TRACK_TO")
        constraint.target = empty
        constraint.track_axis = "TRACK_NEGATIVE_Z"
        constraint.up_axis = "UP_Y"
    context.scene.camera = obj
    managed["view"] = True
    return distance


def import_aim3d_lights(context, aim3d, managed):
    collection = ensure_collection(context.scene, "light")
    for index, entry in enumerate(iiif.as_list(aim3d.get("lights"))):
        if not isinstance(entry, dict) or entry.get("type") not in state.BLENDER_LIGHT_TYPES:
            continue
        obj = new_light(
            str(entry.get("name") or entry["type"]),
            collection,
            entry["type"],
            entry.get("color"),
            float(entry.get("intensity", 1) or 0),
            entry.get("visible", True) is not False,
            entry.get("castShadow"),
            entry.get("angle"),
            entry.get("penumbra"),
        )
        obj["aim3d_light_index"] = index
        position = vector3(entry.get("position"), (0.0, 0.0, 0.0))
        target = vector3(entry.get("target"), (0.0, 0.0, 0.0))
        aim(obj, position, target)
        managed["aimLights"].append(index)


def import_scene_resources(context, iiif_scene, managed):
    """IIIF cameras and lights painted into the Scene."""
    annotations = list(iiif.painting_annotations(iiif_scene)) + list(iiif.comment_annotations(iiif_scene))
    by_id = {annotation.get("id"): annotation for _page, annotation in annotations if annotation.get("id")}
    for _page, annotation in iiif.painting_annotations(iiif_scene):
        wrapper, resource = iiif.unwrap(annotation.get("body"))
        kind = iiif.type_of(resource)
        if kind not in iiif.CAMERA_TYPES and kind not in (iiif.LIGHT_TYPES - {"AmbientLight"}):
            continue
        annotation_id = annotation.get("id")
        if not annotation_id:
            continue
        point = iiif.point_of(first_target(annotation)) or [0.0, 0.0, 0.0]
        is_camera = kind in iiif.CAMERA_TYPES
        position, direction = body_placement(wrapper, point, (0, 0, -1) if is_camera else (0, -1, 0))
        look_at = resolve_look_at(resource.get("lookAt"), by_id)
        label = iiif.first_text(resource.get("label")) or iiif.first_text(annotation.get("label")) or kind
        if is_camera:
            distance = state.distance_between(position, look_at) if look_at else 1.0
            obj = new_camera(
                label,
                ensure_collection(context.scene, "camera"),
                float(resource.get("fieldOfView") or 45),
                kind == "OrthographicCamera",
                resource.get("viewHeight"),
                distance,
            )
        else:
            angle = resource.get("angle")
            obj = new_light(
                label,
                ensure_collection(context.scene, "light"),
                kind,
                resource.get("color"),
                iiif.intensity_of(resource),
                angle=math.radians(float(angle)) if isinstance(angle, (int, float)) else None,
            )
        obj["aim3d_id"] = annotation_id
        aim(obj, position, look_at, None if look_at else direction)
        managed["cameras" if is_camera else "lights"].append(annotation_id)


def import_comments(context, iiif_scene, managed, marker_size):
    collection = ensure_collection(context.scene, "comment")
    for _page, annotation in iiif.comment_annotations(iiif_scene):
        point = iiif.point_of(first_target(annotation))
        annotation_id = annotation.get("id")
        if point is None or not annotation_id:
            continue
        label = iiif.first_text(annotation.get("label"))
        obj = bpy.data.objects.new(f"Comment: {label}" if label else "Comment", None)
        obj.empty_display_type = "SPHERE"
        obj.empty_display_size = marker_size
        obj.show_name = True
        collection.objects.link(obj)
        obj.location = convert.to_blender(point)
        obj[state.ROLE] = "comment"
        obj["aim3d_id"] = annotation_id
        obj["aim3d_label"] = label
        obj["aim3d_text"] = iiif.body_text(annotation.get("body"))
        managed["comments"].append(annotation_id)


def import_manifest(context, source, import_models=True, model_base=""):
    data = iiif.load(source)
    reports = []
    iiif_scene = iiif.first_scene(data)
    if iiif_scene is None:
        raise ValueError("The manifest has no Scene (IIIF Presentation 4)")
    if iiif.scene_count(data) > 1:
        reports.append(("WARNING", "Only the first Scene is imported"))
    aim3d = data.get("AIM3DViewer") if isinstance(data.get("AIM3DViewer"), dict) else {}
    scene = context.scene

    text = bpy.data.texts.get(TEXT_NAME) or bpy.data.texts.new(TEXT_NAME)
    text.clear()
    text.write(json.dumps(data, indent=2, ensure_ascii=False))
    scene["aim3d_manifest"] = text.name
    scene["aim3d_source"] = source

    managed = {"models": [], "view": False, "aimLights": [], "cameras": [], "lights": [], "comments": []}
    options = {"import_models": import_models, "model_base": model_base}
    import_model_annotations(context, iiif_scene, aim3d, source, options, managed, reports)
    distance = import_view_camera(context, aim3d, managed)
    import_aim3d_lights(context, aim3d, managed)
    import_scene_resources(context, iiif_scene, managed)
    import_comments(context, iiif_scene, managed, max((distance or 5.0) * 0.015, 1e-3))
    scene["aim3d_managed"] = json.dumps(managed)

    context.view_layer.update()
    for obj in scene.objects:
        if obj.get(state.ROLE) in ("model", "view", "camera", "light", "comment"):
            state.remember(obj, scene)
    return reports
