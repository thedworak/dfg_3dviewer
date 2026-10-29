# IIIF / AIM3D manifests in Blender

A Blender add-on (`aim3d_iiif`) that imports a IIIF Presentation 4 manifest
with the viewer's `AIM3DViewer` block into a scene and exports it back. You
can also make a new manifest from a Blender scene.

## Install

Blender 4.2 and newer (extension):

```bash
blender --command extension build --source-dir blender/aim3d_iiif --output-dir dist/blender
```

Then use *Edit > Preferences > Get Extensions > Install from Disk* and pick
`dist/blender/aim3d_iiif-0.1.0.zip`.

Blender 4.0 and 4.1 (legacy add-on): zip the `blender/aim3d_iiif` folder and
install it through *Edit > Preferences > Add-ons > Install*.

Once installed, the add-on adds:

- *File > Import > IIIF / AIM3D Manifest (.json)*. Reads a file, or a URL
  given in the URL field.
- *File > Export > IIIF / AIM3D Manifest (.json)*.
- *View3D > Sidebar > AIM3D*. Has Import, Export and Add Comment (on the 3D
  cursor), and the label and text of the selected comment.

## What becomes what

Coordinates are converted as the glTF importer converts them: the viewer's
`(x, y, z)` is Blender's `(x, -z, y)`.

| Manifest | Blender |
|---|---|
| Model painted into the Scene (`Model`, glb/gltf/obj/stl/ply/fbx) | Empty *(model root)*, with an *up axis* empty under it, and under that the imported file |
| `AIM3DViewer.modelTransform` (position, rotation, scale, `upAxis`) | Transform of the model root; `upAxis` is the rotation of the up-axis empty |
| IIIF body `transform` and target `PointSelector` | Transform of the model root, for a model without `modelTransform` |
| `AIM3DViewer.camera` | Camera *AIM3D View* (the scene camera). It has a Track To constraint on *AIM3D View Target*, which is the orbit target |
| IIIF `PerspectiveCamera` / `OrthographicCamera` | Camera. `fieldOfView` is the vertical FOV; `lookAt` becomes the target distance |
| `AIM3DViewer.lights` and IIIF lights: Directional, Point, Spot | Sun, Point and Spot lights |
| `AmbientLight`, `HemisphereLight` | Not shown in Blender; kept in the manifest |
| Comments on a point (`commenting`, `PointSelector`) | Sphere empties in *AIM3D Comments* with `aim3d_label` and `aim3d_text` |
| Everything else: `viewer`, `timeline`, `variants`, `weather`, `photos`, `certainty`, metadata, rights | Kept in the text block *AIM3D manifest.json* and written back unchanged |

Intensities: a sun's strength is the viewer's intensity, and a point or spot
light has 100 W per unit of intensity (`convert.py`). Colours are converted
between sRGB (manifest) and linear (Blender).

## Export

The exporter starts from the stored manifest and rewrites only the objects
that changed since the import or the last export. An untouched scene
therefore exports the same manifest it read. The following carry over to
the manifest:

- Deleting a managed object removes it from the manifest.
- New lights in *AIM3D Lights* are added to `AIM3DViewer.lights`, or to the
  Scene as IIIF lights in a manifest without the block.
- New cameras in *AIM3D Cameras* are added as IIIF cameras.
- New empties in *AIM3D Comments* are added as comments.
- A moved comment loses its exact face anchoring. The viewer then anchors it
  by the point.

Without an imported manifest, the exporter makes a new one from the scene:

- The scene camera becomes `AIM3DViewer.camera`.
- The lights go to `AIM3DViewer.lights`.
- The visible meshes are written as a GLB next to the manifest
  (`./name.glb`).

Relative model paths resolve against the viewer page, not the manifest. You
may need to change the model's `id` before publishing.

## Tests

```bash
blender -b --factory-startup --python-exit-code 1 --python blender/tests/test_roundtrip.py
```

The tests cover the following:

- Every manifest in `viewer/manifesto/examples` exports unchanged when
  nothing is edited.
- Edits come back where the viewer reads them.
- A second export changes nothing.
- The manifests written pass `scripts/inspect-manifest.mjs`, when node is
  installed.

## Limits

- Only the first Scene is imported.
- Models: glTF/GLB, OBJ, STL, PLY and FBX. Gaussian splats, point clouds,
  3D Tiles and IFC appear only as a placeholder empty.
- Only the first model's transform goes to `AIM3DViewer.modelTransform`.
  Other models get the IIIF body transform list.
- `upAxis` is read on import and written back, but it cannot be changed in
  Blender. Turn the model root instead.
