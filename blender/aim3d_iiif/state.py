# What the manifest says about each object the add-on manages, read back
# from Blender in the viewer's terms. The importer stores it on the object
# ("aim3d_state"); the exporter rewrites the manifest only where it changed,
# so values Blender cannot hold exactly stay as they were.

import json
import math

from mathutils import Vector

from . import convert

ROLE = "aim3d_role"
STATE = "aim3d_state"

LIGHT_TYPES = {"SUN": "DirectionalLight", "POINT": "PointLight", "SPOT": "SpotLight"}
BLENDER_LIGHT_TYPES = {value: key for key, value in LIGHT_TYPES.items()}


def track_target(obj):
    """The object a camera's Track To / Damped Track constraint aims at."""
    for constraint in obj.constraints:
        if constraint.type in ("TRACK_TO", "DAMPED_TRACK", "LOCKED_TRACK") and constraint.target and not constraint.mute:
            return constraint.target
    return None


def aim_point(obj):
    """The point a camera or light looks at, in Blender space."""
    target = track_target(obj)
    if target is not None:
        return target.matrix_world.translation.copy()
    distance = float(obj.get("aim3d_distance", 1.0)) or 1.0
    return obj.matrix_world.translation + convert.forward(obj.matrix_world) * distance


def camera_state(obj, scene):
    data = obj.data
    position = obj.matrix_world.translation
    return {
        "position": convert.to_three(position),
        "target": convert.to_three(aim_point(obj)),
        "fov": math.degrees(convert.vertical_fov(data, scene.render)),
        "orthographic": data.type == "ORTHO",
        "orthoScale": data.ortho_scale if data.type == "ORTHO" else None,
    }


def light_state(obj):
    data = obj.data
    if data.type == "SUN":
        intensity = data.energy / convert.SUN_STRENGTH_PER_INTENSITY
    else:
        intensity = data.energy / convert.POINT_WATTS_PER_INTENSITY
    state = {
        "type": LIGHT_TYPES.get(data.type, "PointLight"),
        "position": convert.to_three(obj.matrix_world.translation),
        "target": convert.to_three(aim_point(obj)),
        "color": convert.linear_to_hex(data.color),
        "intensity": intensity,
        "visible": not obj.hide_render,
        "castShadow": bool(data.use_shadow),
    }
    if data.type == "SPOT":
        state["angle"] = data.spot_size / 2
        state["penumbra"] = data.spot_blend
    return state


def comment_state(obj):
    return {
        "point": convert.to_three(obj.matrix_world.translation),
        "label": str(obj.get("aim3d_label", "")),
        "text": str(obj.get("aim3d_text", "")),
    }


def model_state(obj):
    matrix = convert.matrix_to_three(obj.matrix_world)
    return {"matrix": [value for row in matrix for value in row]}


def object_state(obj, scene):
    role = obj.get(ROLE)
    if role in ("view", "camera") and obj.type == "CAMERA":
        return camera_state(obj, scene)
    if role == "light" and obj.type == "LIGHT":
        return light_state(obj)
    if role == "comment":
        return comment_state(obj)
    if role == "model":
        return model_state(obj)
    return None


def remember(obj, scene):
    obj[STATE] = json.dumps(object_state(obj, scene))


def changed(obj, scene):
    """True when the object no longer matches what was imported (or was
    never imported)."""
    stored = obj.get(STATE)
    if not stored:
        return True
    return not close(json.loads(stored), object_state(obj, scene))


def close(first, second, tolerance=1e-6):
    if isinstance(first, dict) and isinstance(second, dict):
        return first.keys() == second.keys() and all(close(first[key], second[key], tolerance) for key in first)
    if isinstance(first, list) and isinstance(second, list):
        return len(first) == len(second) and all(close(a, b, tolerance) for a, b in zip(first, second))
    if isinstance(first, (int, float)) and isinstance(second, (int, float)) and not isinstance(first, bool):
        return math.isclose(first, second, rel_tol=tolerance, abs_tol=tolerance)
    return first == second


def distance_between(first, second):
    return (Vector(first) - Vector(second)).length
