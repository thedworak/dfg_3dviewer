# Server-side conversion and rendering

Main workflow is divided into two automatic parts:
- pre-processing - uploaded model is uncompressed (if so) and converted into glTF (glb) format
- automatic rendering - Blender side rendering of 3D model's thumbnails

The conversion pipeline lives in `scripts/` and `php/`.

After uploading 3D model into repository there are triggered following steps:
- uncompressing 3D models - it is done on Drupal side module script inside ```dfg_3dviewer_entity_presave``` and supports following archive formats: zip, rar, tar, xz, gz. According to the format, the bash script is triggered with following arguments:
```/scripts/uncompress.sh archiveType -i inputPath -o extractPath -n fileName```
- automatic conversion into glTF (glb) format for the following supported formats:
    - abc, dae, fbx, obj, ply, stl, wrl, x3d, usd, usda, usdc, usdz - function ```handle_file``` (the usd* formats need a Blender build with USD support, e.g. the official release; distro packages such as Ubuntu's often lack it)
    - ifc - function ```handle_ifc_file```
    - blend (in progress) - function ```handle_blend_file```
    - glb - triggers next step - function ```render_preview```
    - step, stp, iges, igs, 3mf - not handled by `convert.sh`: the standalone Docker worker converts them with `scripts/convert_mesh.py` (OpenCASCADE/trimesh) instead

This step is performed inside ```scripts/convert.sh``` bash script, which is the primary helper for converting files to glTF/GLB and rendering preview images with Blender.
Defaults .env variables should be adjusted due to your needs:

```
BLENDER_BIN=''
# Optional override. If empty, scripts auto-detect the module root from this file location.
SPATH=
BACKUP_SETTINGS_PATH=/var/www/data/project/web/sites/default/settings.php
RENDER_RESOLUTION='1024x1024x16'
RENDER_SAMPLES='20'
```

The script uses Blender to convert the file into glTF format and then renders a preview image with it using blender's built-in cycles engine. The result is saved in a set of pictures with different view angles.
This step needs some steps to be performed before rendering:
- create scene containing loaded 3D model
- calculate bounding box (for camera and lights settlement)
- scale scene according to bounding box
- setup basic properties for rendering engine, output quality, lights, camera
- prepare rendering from camera placed in 9 different positions (left, left top, front, front top, right, right top, back, back top, top)
- write rendering outputs into png files with consecutive naming


![Backend overview|500](https://i.postimg.cc/7fw9zs6n/image3.png)

## Optimization in the standalone worker

The Docker worker additionally compresses every converted GLB with gltfpack (Meshopt geometry, KTX2 textures) and writes a lightweight `<name>.preview.glb` that the viewer shows first - see "GLB optimization and progressive loading" in [`worker/README.md`](../worker/README.md). `worker/optimize.py model.glb --preview` does the same for files produced by this pipeline.

## Supported conversion inputs

- Blender importers (`scripts/convert.sh`): abc, dae, fbx, obj, ply, stl, wrl, x3d, usd, usda, usdc, usdz, ifc, blend, gml, glb
- Without Blender (`scripts/convert_mesh.py`, used by the worker): step, stp, iges, igs (tessellated by OpenCASCADE, so `--tol-linear` trades detail for size), 3mf
- Viewer-native, kept as uploaded and without thumbnails: gltf (inside a .zip with its .bin/textures), 3ds, pcd, xyz, amf, kmz, vox, lwo

## Minimal conversion examples

Convert an OBJ to GLB and render previews:

```bash
./scripts/convert.sh -c true -l 3 -i '/path/to/input.obj' -b true
```

Convert an IFC with IfcConvert:

```bash
./scripts/convert.sh -i '/path/to/building.ifc'
```

IFC conversion produces two files: the GLB (IfcConvert with `--use-element-guids`, so node names are IFC GlobalIds) and `metadata/<name>_ifc.json` with the spatial tree and per-element type, name, material, property sets and quantities, keyed by GlobalId (`scripts/ifc_metadata.py`). glTF cannot hold IFC property sets, hence the separate file. When the viewer finds it next to the model, clicking an element opens a properties panel.

The metadata export needs the `ifcopenshell` Python package on the conversion host (`pip3 install ifcopenshell`); it is already included in `worker/Dockerfile.base`. Without it the GLB is still produced, only `_ifc.json` is skipped.

Run lightweight conversion without xvfb checks:

```bash
./scripts/convert.sh -t true -c false -i '/path/to/input.obj'
```

## Script flags

- `-c` — compression true/false
- `-l` — compression level 0-6
- `-i` — input file path
- `-o` — output folder (optional)
- `-b` — binary output true/false (GLB vs glTF)
- `-t` — lightweight true/false
- `-f` — force overwrite

## Environment variables in `scripts/.env`

- `BLENDER_PATH` — path to the Blender binary
- `SPATH` — repository or module base path used by scripts
- `COMPRESSION` — whether glTF compression is enabled
- `COMPRESSION_LEVEL` — compression level
- `GLTF` — target `gltf` or `glb`
- `FORCE` — overwrite existing outputs
- `IS_ARCHIVE` — if input is an archive
- `LIGHTWEIGHT` — skip heavyweight checks and rendering steps
