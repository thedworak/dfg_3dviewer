# Conversions between the viewer's space and Blender's.
#
# The viewer (three.js, glTF, IIIF 3D) is Y-up, Blender Z-up. A point
# (x, y, z) of the viewer is (x, -z, y) in Blender - the conversion the glTF
# importer makes, so a glTF model and the manifest's coordinates line up.

import math

from mathutils import Euler, Matrix, Vector

AXIS = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))
AXIS_INV = AXIS.inverted()

# Light intensities: the viewer's are relative (decay 0, no physical units),
# Blender's are W/m² (sun) and W (point, spot). Linear factors, so that a
# changed light exports back exactly.
SUN_STRENGTH_PER_INTENSITY = 1.0
POINT_WATTS_PER_INTENSITY = 100.0

# The rotation turning a model's up axis to +Y (viewer/up-axis.js).
UP_AXIS_EULERS = {
    "Y+": (0, 0, 0),
    "Y-": (math.pi, 0, 0),
    "Z+": (-math.pi / 2, 0, 0),
    "Z-": (math.pi / 2, 0, 0),
    "X+": (0, 0, math.pi / 2),
    "X-": (0, 0, -math.pi / 2),
}


def to_blender(values):
    x, y, z = (float(value) for value in values[:3])
    return Vector((x, -z, y))


def to_three(vector):
    return [vector.x, vector.z, -vector.y]


def matrix_to_blender(matrix):
    """An object's matrix whose own geometry is converted too (models)."""
    return AXIS @ matrix @ AXIS_INV


def matrix_to_three(matrix):
    return AXIS_INV @ matrix @ AXIS


def three_euler_matrix(x, y, z, order="XYZ"):
    """three.js Euler angles (radians) as a matrix. three's "XYZ" is
    Rx @ Ry @ Rz, mathutils' "ZYX"."""
    return Euler((x, y, z), order[::-1]).to_matrix().to_4x4()


def matrix_three_euler(matrix, order="XYZ"):
    euler = matrix.to_euler(order[::-1])
    return euler.x, euler.y, euler.z


def compose_three(position, rotation, scale, order="XYZ"):
    """position / rotation (radians) / scale of a three.js object as its
    matrix."""
    return (
        Matrix.Translation(Vector(position))
        @ three_euler_matrix(*rotation, order=order)
        @ Matrix.Diagonal(Vector(scale)).to_4x4()
    )


def decompose_three(matrix, order="XYZ"):
    position, quaternion, scale = matrix.decompose()
    rotation = matrix_three_euler(quaternion.to_matrix().to_4x4(), order)
    return list(position), list(rotation), list(scale)


def up_axis_matrix(up_axis):
    return three_euler_matrix(*UP_AXIS_EULERS.get(up_axis or "Y+", (0, 0, 0)))


def normalize_up_axis(value):
    """"Z", "z+", "+Z", "z-up" -> "Z+"; "-z" -> "Z-" (viewer/up-axis.js)."""
    if not isinstance(value, str):
        return None
    text = value.strip().upper()
    for suffix in ("-UP", "_UP", " UP", "UP"):
        if text.endswith(suffix):
            text = text[: -len(suffix)]
            break
    sign = "+"
    if text[:1] in "+-" and len(text) == 2:
        sign, text = text[0], text[1]
    elif text[-1:] in "+-" and len(text) == 2:
        sign, text = text[1], text[0]
    if text not in ("X", "Y", "Z"):
        return None
    return text + sign


def transform_matrix(transforms):
    """A IIIF transform list (Scale / Rotate / TranslateTransform) as one
    matrix in the viewer's space, applied in the order listed; RotateTransform
    angles are degrees, three.js "XYZ" (viewer/IIIF/presentation4.js)."""
    matrix = Matrix.Identity(4)
    for transform in transforms if isinstance(transforms, list) else [transforms] if transforms else []:
        if not isinstance(transform, dict):
            continue
        kind = transform.get("type")

        def number(key, default):
            try:
                value = float(transform.get(key))
            except (TypeError, ValueError):
                return default
            return value if math.isfinite(value) else default

        if kind == "ScaleTransform":
            step = Matrix.Diagonal((number("x", 1), number("y", 1), number("z", 1), 1))
        elif kind == "RotateTransform":
            step = three_euler_matrix(
                math.radians(number("x", 0)), math.radians(number("y", 0)), math.radians(number("z", 0))
            )
        elif kind == "TranslateTransform":
            step = Matrix.Translation((number("x", 0), number("y", 0), number("z", 0)))
        else:
            continue
        matrix = step @ matrix
    return matrix


def look_rotation(direction, up=Vector((0, 0, 1))):
    """Rotation of a Blender camera or light (both look along local -Z, with
    +Y up) facing `direction`."""
    if direction.length < 1e-12:
        return Matrix.Identity(3)
    z_axis = -direction.normalized()
    x_axis = up.cross(z_axis)
    if x_axis.length < 1e-9:
        x_axis = Vector((0, 1, 0)).cross(z_axis)
        if x_axis.length < 1e-9:
            x_axis = Vector((1, 0, 0)).cross(z_axis)
    x_axis.normalize()
    y_axis = z_axis.cross(x_axis)
    rotation = Matrix.Identity(3)
    rotation.col[0], rotation.col[1], rotation.col[2] = x_axis, y_axis, z_axis
    return rotation


def look_at_matrix(position, target, up=Vector((0, 0, 1))):
    matrix = look_rotation(target - position, up).to_4x4()
    matrix.translation = position
    return matrix


def forward(matrix_world):
    return -matrix_world.col[2].xyz.normalized()


def srgb_to_linear(value):
    return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4


def linear_to_srgb(value):
    value = min(max(value, 0.0), 1.0)
    return value * 12.92 if value <= 0.0031308 else 1.055 * value ** (1 / 2.4) - 0.055


def hex_to_linear(value, fallback="#ffffff"):
    text = value.strip().lstrip("#") if isinstance(value, str) else ""
    if len(text) == 3:
        text = "".join(char * 2 for char in text)
    try:
        channels = [int(text[index:index + 2], 16) / 255 for index in (0, 2, 4)] if len(text) == 6 else None
    except ValueError:
        channels = None
    if channels is None:
        return hex_to_linear(fallback) if fallback else (1.0, 1.0, 1.0)
    return tuple(srgb_to_linear(channel) for channel in channels)


def linear_to_hex(color):
    return "#" + "".join(f"{round(linear_to_srgb(channel) * 255):02x}" for channel in color[:3])


def vertical_fov(camera_data, render):
    """The vertical field of view (radians), as three.js' `fov` is."""
    aspect = (render.resolution_x * render.pixel_aspect_x) / max(render.resolution_y * render.pixel_aspect_y, 1e-9)
    fit = camera_data.sensor_fit
    if fit == "AUTO":
        fit = "HORIZONTAL" if aspect >= 1 else "VERTICAL"
    if fit == "VERTICAL":
        return 2 * math.atan(camera_data.sensor_height / (2 * camera_data.lens))
    return 2 * math.atan(camera_data.sensor_width / (2 * camera_data.lens) / aspect)


def set_vertical_fov(camera_data, fov):
    camera_data.sensor_fit = "VERTICAL"
    camera_data.lens = camera_data.sensor_height / (2 * math.tan(fov / 2))


def clean_number(value, digits=6):
    """Rounded for the manifest, integers without a fraction, no -0."""
    value = round(float(value), digits)
    if value == int(value) and abs(value) < 1e15:
        return int(value)
    return value


def clean_list(values, digits=6):
    return [clean_number(value, digits) for value in values]
