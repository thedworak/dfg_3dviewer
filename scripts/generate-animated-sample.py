#!/usr/bin/env python3
"""Generate viewer/examples/animated.glb, a small test model with several
animation clips of different lengths.

The file is written by hand (glTF JSON + one binary buffer), so no Blender or
extra Python packages are needed. Scene layout:

    Base    - flat grey platform (static)
    Pivot   - empty at the top of the platform
      Arm   - long thin box, child of Pivot
      Cube  - orange cube at the end of the arm, child of Pivot

Clips:
    Spin    (2.0 s) - Pivot turns 360 degrees around Y
    Swing   (3.0 s) - Pivot tilts +-30 degrees around Z
    Bounce  (1.0 s) - Cube moves up and down
    Pulse   (1.5 s) - Cube grows and shrinks

Usage: python3 scripts/generate-animated-sample.py [output.glb]
"""

import json
import math
import struct
import sys
from pathlib import Path

DEFAULT_OUTPUT = Path(__file__).resolve().parent.parent / "viewer" / "examples" / "animated.glb"

FLOAT = 5126
USHORT = 5123
ARRAY_BUFFER = 34962
ELEMENT_ARRAY_BUFFER = 34963


def box_geometry():
    """Unit cube centred on the origin, 4 vertices per face so normals stay flat."""
    faces = [
        ((1, 0, 0), [(1, -1, -1), (1, 1, -1), (1, 1, 1), (1, -1, 1)]),
        ((-1, 0, 0), [(-1, -1, 1), (-1, 1, 1), (-1, 1, -1), (-1, -1, -1)]),
        ((0, 1, 0), [(-1, 1, -1), (-1, 1, 1), (1, 1, 1), (1, 1, -1)]),
        ((0, -1, 0), [(-1, -1, 1), (-1, -1, -1), (1, -1, -1), (1, -1, 1)]),
        ((0, 0, 1), [(-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)]),
        ((0, 0, -1), [(1, -1, -1), (-1, -1, -1), (-1, 1, -1), (1, 1, -1)]),
    ]
    positions, normals, indices = [], [], []
    for normal, corners in faces:
        base = len(positions)
        for corner in corners:
            positions.append(tuple(c * 0.5 for c in corner))
            normals.append(normal)
        indices += [base, base + 1, base + 2, base, base + 2, base + 3]
    return positions, normals, indices


def quat_axis_angle(axis, angle):
    s = math.sin(angle / 2)
    return (axis[0] * s, axis[1] * s, axis[2] * s, math.cos(angle / 2))


class GlbBuilder:
    def __init__(self):
        self.binary = bytearray()
        self.buffer_views = []
        self.accessors = []

    def _add_view(self, data, target=None):
        while len(self.binary) % 4:
            self.binary.append(0)
        view = {"buffer": 0, "byteOffset": len(self.binary), "byteLength": len(data)}
        if target:
            view["target"] = target
        self.binary += data
        self.buffer_views.append(view)
        return len(self.buffer_views) - 1

    def add_floats(self, rows, accessor_type, target=None, with_bounds=False):
        width = {"SCALAR": 1, "VEC3": 3, "VEC4": 4}[accessor_type]
        flat = [v for row in rows for v in (row if width > 1 else (row,))]
        view = self._add_view(struct.pack(f"<{len(flat)}f", *flat), target)
        accessor = {"bufferView": view, "componentType": FLOAT, "count": len(rows), "type": accessor_type}
        if with_bounds:
            columns = list(zip(*(row if width > 1 else (row,) for row in rows)))
            accessor["min"] = [min(col) for col in columns]
            accessor["max"] = [max(col) for col in columns]
        self.accessors.append(accessor)
        return len(self.accessors) - 1

    def add_indices(self, indices):
        view = self._add_view(struct.pack(f"<{len(indices)}H", *indices), ELEMENT_ARRAY_BUFFER)
        self.accessors.append({"bufferView": view, "componentType": USHORT, "count": len(indices), "type": "SCALAR"})
        return len(self.accessors) - 1


def build():
    b = GlbBuilder()
    positions, normals, indices = box_geometry()
    pos_acc = b.add_floats(positions, "VEC3", ARRAY_BUFFER, with_bounds=True)
    nrm_acc = b.add_floats(normals, "VEC3", ARRAY_BUFFER)
    idx_acc = b.add_indices(indices)

    materials = [
        {"name": "Platform", "pbrMetallicRoughness": {"baseColorFactor": [0.55, 0.57, 0.6, 1], "metallicFactor": 0.0, "roughnessFactor": 0.8}},
        {"name": "Arm", "pbrMetallicRoughness": {"baseColorFactor": [0.2, 0.45, 0.85, 1], "metallicFactor": 0.1, "roughnessFactor": 0.5}},
        {"name": "Cube", "pbrMetallicRoughness": {"baseColorFactor": [0.95, 0.5, 0.15, 1], "metallicFactor": 0.0, "roughnessFactor": 0.4}},
    ]
    meshes = [
        {"name": name, "primitives": [{"attributes": {"POSITION": pos_acc, "NORMAL": nrm_acc}, "indices": idx_acc, "material": i}]}
        for i, name in enumerate(["Platform", "Arm", "Cube"])
    ]

    # Node indices: 0 Base, 1 Pivot, 2 Arm, 3 Cube
    nodes = [
        {"name": "Base", "mesh": 0, "translation": [0, 0.1, 0], "scale": [3.6, 0.2, 3.6]},
        {"name": "Pivot", "translation": [0, 0.8, 0], "children": [2, 3]},
        {"name": "Arm", "mesh": 1, "translation": [0.75, 0, 0], "scale": [1.5, 0.12, 0.12]},
        {"name": "Cube", "mesh": 2, "translation": [1.5, 0, 0], "scale": [0.45, 0.45, 0.45]},
    ]

    def sampled(duration, count, fn):
        times = [duration * i / (count - 1) for i in range(count)]
        return times, [fn(t / duration) for t in times]

    animations = []

    def add_clip(name, node, path, times, values, value_type):
        time_acc = b.add_floats(times, "SCALAR", with_bounds=True)
        value_acc = b.add_floats(values, value_type)
        animations.append({
            "name": name,
            "samplers": [{"input": time_acc, "output": value_acc, "interpolation": "LINEAR"}],
            "channels": [{"sampler": 0, "target": {"node": node, "path": path}}],
        })

    times, values = sampled(2.0, 9, lambda u: quat_axis_angle((0, 1, 0), u * 2 * math.pi))
    add_clip("Spin", 1, "rotation", times, values, "VEC4")

    times, values = sampled(3.0, 31, lambda u: quat_axis_angle((0, 0, 1), math.radians(30) * math.sin(u * 2 * math.pi)))
    add_clip("Swing", 1, "rotation", times, values, "VEC4")

    times, values = sampled(1.0, 21, lambda u: (1.5, 0.6 * abs(math.sin(u * math.pi)), 0))
    add_clip("Bounce", 3, "translation", times, values, "VEC3")

    times, values = sampled(1.5, 21, lambda u: tuple([0.45 * (1 + 0.35 * math.sin(u * 2 * math.pi))] * 3))
    add_clip("Pulse", 3, "scale", times, values, "VEC3")

    while len(b.binary) % 4:
        b.binary.append(0)

    gltf = {
        "asset": {"version": "2.0", "generator": "dfg_3dviewer generate-animated-sample.py"},
        "scene": 0,
        "scenes": [{"name": "AnimatedSample", "nodes": [0, 1]}],
        "nodes": nodes,
        "meshes": meshes,
        "materials": materials,
        "animations": animations,
        "accessors": b.accessors,
        "bufferViews": b.buffer_views,
        "buffers": [{"byteLength": len(b.binary)}],
    }

    json_chunk = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    json_chunk += b" " * (-len(json_chunk) % 4)
    bin_chunk = bytes(b.binary)
    total = 12 + 8 + len(json_chunk) + 8 + len(bin_chunk)
    return b"".join([
        struct.pack("<4sII", b"glTF", 2, total),
        struct.pack("<I4s", len(json_chunk), b"JSON"), json_chunk,
        struct.pack("<I4s", len(bin_chunk), b"BIN\x00"), bin_chunk,
    ])


if __name__ == "__main__":
    output = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_OUTPUT
    output.write_bytes(build())
    print(f"Wrote {output}")
