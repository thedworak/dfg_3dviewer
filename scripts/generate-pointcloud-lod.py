"""Samples a mesh (GLB/glTF/OBJ...) into coloured point clouds at several
levels of detail, for testing how the viewer loads large point clouds.

The densest level is sampled once (area-weighted, colour from the base colour
texture or factor) and shuffled; each smaller level is a prefix of it, so the
levels are nested (1M is a subset of 2M, 2M of 5M...). Output, in out_dir:

  <name>-<level>.laz          one LAS 1.2 / LAZ file per level
  tiles/<name>/tileset.json   3D Tiles (pnts octree, py3dtiles) of the densest
                              level - streamed level by level by the viewer

Coordinates keep the mesh units and are turned from glTF's Y-up to LAS's Z-up
(the viewer turns LAS back to Y-up).

Needs: trimesh, pillow, scipy, laspy[lazrs], py3dtiles.

  python3 scripts/generate-pointcloud-lod.py viewer/examples/WolpaSynagogue.glb \\
      test-data/pointcloud-lod --levels 1M,2M,5M,10M
"""

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np


def parse_count(text: str) -> int:
    text = text.strip().upper()
    factor = {"K": 1_000, "M": 1_000_000}.get(text[-1:], 1)
    return int(float(text.rstrip("KM")) * factor)


def mesh_colors(mesh, points, face_index):
    """RGB (uint8, N x 3) of sampled points: texture when there is one,
    otherwise the material's base colour."""
    import trimesh

    visual = mesh.visual
    material = getattr(visual, "material", None)
    texture = None
    if material is not None:
        texture = getattr(material, "baseColorTexture", None) or getattr(material, "image", None)
    uv = getattr(visual, "uv", None)
    if texture is not None and uv is not None and len(uv) == len(mesh.vertices):
        triangles = mesh.triangles[face_index]
        barycentric = trimesh.triangles.points_to_barycentric(triangles, points)
        uv_points = (uv[mesh.faces[face_index]] * barycentric[:, :, None]).sum(axis=1)
        image = np.asarray(texture.convert("RGB"))
        height, width = image.shape[:2]
        # glTF UVs wrap (REPEAT) and have their origin at the top left.
        u = np.mod(uv_points[:, 0], 1.0)
        v = np.mod(uv_points[:, 1], 1.0)
        x = np.clip((u * (width - 1)).round().astype(np.int64), 0, width - 1)
        y = np.clip(((1.0 - v) * (height - 1)).round().astype(np.int64), 0, height - 1)
        rgb = image[y, x].astype(np.float32)
        factor = getattr(material, "baseColorFactor", None)
        if factor is not None:
            rgb *= np.asarray(factor[:3], dtype=np.float32) / (255.0 if np.max(factor) > 1 else 1.0)
        return np.clip(rgb, 0, 255).astype(np.uint8)
    factor = None
    if material is not None:
        factor = getattr(material, "baseColorFactor", None)
        if factor is None and hasattr(material, "main_color"):
            factor = material.main_color
    if factor is None:
        factor = [200, 200, 200]
    factor = np.asarray(factor[:3], dtype=np.float32)
    if factor.max() <= 1.0:
        factor *= 255.0
    return np.tile(factor.astype(np.uint8), (len(points), 1))


def sample_scene(path: Path, count: int, seed: int):
    import trimesh

    scene = trimesh.load(path, force="scene")
    meshes = [m for m in scene.dump() if isinstance(m, trimesh.Trimesh) and len(m.faces)]
    areas = np.array([m.area for m in meshes])
    rng = np.random.default_rng(seed)
    # Split the points by surface area, rounding so they add up to count.
    shares = areas / areas.sum() * count
    per_mesh = np.floor(shares).astype(np.int64)
    remainder = count - per_mesh.sum()
    per_mesh[np.argsort(shares - per_mesh)[::-1][:remainder]] += 1

    xyz_parts, rgb_parts = [], []
    for mesh, n in zip(meshes, per_mesh):
        if n == 0:
            continue
        points, face_index = trimesh.sample.sample_surface(mesh, int(n), seed=int(rng.integers(2**31)))
        xyz_parts.append(points)
        rgb_parts.append(mesh_colors(mesh, points, face_index))
        print(f"  {mesh.metadata.get('name', '?')}: {n} points", file=sys.stderr)
    xyz = np.concatenate(xyz_parts)
    rgb = np.concatenate(rgb_parts)
    order = rng.permutation(len(xyz))
    xyz, rgb = xyz[order], rgb[order]
    # glTF Y-up -> LAS Z-up: (x, y, z) -> (x, -z, y).
    xyz = np.column_stack([xyz[:, 0], -xyz[:, 2], xyz[:, 1]])
    return xyz, rgb


def write_las(target: Path, xyz, rgb) -> None:
    import laspy

    header = laspy.LasHeader(point_format=2, version="1.2")
    header.scales = [0.001, 0.001, 0.001]
    header.offsets = xyz.min(axis=0)
    las = laspy.LasData(header)
    las.x, las.y, las.z = xyz[:, 0], xyz[:, 1], xyz[:, 2]
    rgb16 = rgb.astype(np.uint16) * 257
    las.red, las.green, las.blue = rgb16[:, 0], rgb16[:, 1], rgb16[:, 2]
    las.write(target)


def level_name(count: int) -> str:
    if count % 1_000_000 == 0:
        return f"{count // 1_000_000}M"
    if count % 1_000 == 0:
        return f"{count // 1_000}K"
    return str(count)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("source", type=Path)
    parser.add_argument("out_dir", type=Path)
    parser.add_argument("--levels", default="1M,2M,5M,10M", help="point counts, e.g. 1M,2M,5M,10M")
    parser.add_argument("--name", help="base name of the outputs (default: source name)")
    parser.add_argument("--seed", type=int, default=1)
    parser.add_argument("--no-tiles", action="store_true", help="skip the 3D Tiles tileset")
    parser.add_argument("--no-laz", action="store_true", help="skip the per-level LAZ files")
    parser.add_argument("--jobs", type=int, default=8, help="py3dtiles workers")
    args = parser.parse_args()

    levels = sorted({parse_count(level) for level in args.levels.split(",")})
    name = args.name or args.source.stem
    out_dir = args.out_dir.resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"sampling {levels[-1]:,} points from {args.source}", file=sys.stderr)
    xyz, rgb = sample_scene(args.source, levels[-1], args.seed)

    for count in levels if not args.no_laz else []:
        target = out_dir / f"{name}-{level_name(count)}.laz"
        write_las(target, xyz[:count], rgb[:count])
        print(f"{target}: {count:,} points, {target.stat().st_size / 1e6:.1f} MB", file=sys.stderr)

    if args.no_tiles:
        return
    py3dtiles = shutil.which("py3dtiles") or str(Path(sys.executable).with_name("py3dtiles"))
    # py3dtiles reads LAZ only through the external laszip, so hand it LAS.
    las_input = out_dir / f"{name}-{level_name(levels[-1])}.tmp.las"
    write_las(las_input, xyz, rgb)
    tiles_dir = out_dir / "tiles" / name
    shutil.rmtree(tiles_dir, ignore_errors=True)
    tiles_dir.parent.mkdir(parents=True, exist_ok=True)
    try:
        subprocess.run(
            [py3dtiles, "convert", str(las_input), "--out", str(tiles_dir), "--overwrite",
             "--jobs", str(args.jobs), "--disable-processpool"],
            check=True, cwd=out_dir,
        )
    finally:
        las_input.unlink(missing_ok=True)
    shutil.rmtree(tiles_dir / "tmp", ignore_errors=True)
    print(f"{tiles_dir / 'tileset.json'}: {levels[-1]:,} points", file=sys.stderr)


if __name__ == "__main__":
    main()
