# The One (`.one4d`) — draft 0.1

One file for a 3D object as a repository keeps it: its meshes at several
levels of detail (LoD), point clouds, Gaussian splats, textures, its
history in time (4D), the Level of Certainty (LoC) of a reconstruction, and
its descriptive metadata and provenance.

> **Status: draft.** Version 0.1 is a prototype to try the idea. Fields may
> still change; a file says which version it follows, and a reader refuses
> a newer major version.

- Reader and writer (browser and Node, no dependencies): `viewer/one/one-container.js`
- Viewer support: `viewer/one/one-viewer.js`, opened like any model (drop the file, or `?model=…/x.one4d`)
- Command-line tool: `scripts/one-pack.mjs` (pack, inspect, verify, unpack)
- Manifest schema: [`one-format.schema.json`](one-format.schema.json)

## Why a container, and why ZIP

The formats inside are the ones that already exist and that decoders,
GPUs and archives know: glTF/GLB (with Meshopt, Draco and KTX2), LAS/LAZ
and COPC, SPZ, PNG/WebP/KTX2, JSON-LD. The One adds what none of them
has: **one manifest tying them together**, with levels of detail, a time
axis and a certainty scale across all of them.

| Need | How |
|---|---|
| Anyone can open it, now and in 50 years | A plain ZIP archive: `unzip`, Python's `zipfile`, any file manager. |
| Show something at once, stream the rest | The manifest first, then the preview, then every part's levels from the coarsest to the finest. `one.json` gives every part's place in the file, so after the first read a reader goes straight to the part it needs (HTTP Range). |
| Hand a part to a decoder without copying | Entries start on a **64-byte boundary** and are **stored** when their format is compressed already (Meshopt/Draco GLB, LAZ, SPZ, KTX2, images, audio). |
| Not larger than a ZIP | A part that is not compressed already (a plain GLB, JSON, LAS) is **deflated** when that saves at least 10% - still read on its own by range. |
| Tell what a file is from its first bytes | `PK\x03\x04`, then the name `one.json` at byte 30. |
| Trust what is inside | Every file's size and SHA-256 in the manifest, plus ZIP's own CRC-32. |

`.one` is the format's name, but the extension is `.one4d`: Microsoft
OneNote uses `.one`, and Windows would hand the file to OneNote. The
viewer also opens `.one` for now, since the content is unambiguous.
The media type is `model/vnd.one4d+zip` (not registered).

## Layout

```
model.one4d
├── one.json            the manifest (always the first entry)
├── meta/preview.webp   thumbnail, shown before any 3D data
├── meta/scene.json     optional: an AIM3D manifest (annotations, camera, looks)
├── meta/record.jsonld  optional: descriptive metadata, linked data
├── mesh/lod0.glb       coarsest level of the mesh
├── mesh/lod1.glb
├── mesh/lod2.glb       finest level
├── points/scan.laz     point cloud (COPC is a LAZ)
├── splats/capture.spz  Gaussian splats
└── …                   anything else: kept, listed in files
```

Folder names are a convention: the manifest names every path. The writer
orders the entries itself (`containerOrder` in `one-container.js`):
`one.json`, the preview, the scene manifest, then level 0 of every part
(primary part first), level 1 of every part, and so on, then the rest.

### Container rules (version 0.1)

1. ZIP; each entry **stored** (method 0) or **deflated** (method 8). A
   writer deflates an entry only when it saves at least 10%; a reader
   must read both (the reference reader uses the platform's
   `DecompressionStream("deflate-raw")`, so it needs no library).
2. The first entry is `one.json`.
3. Each entry's data starts at an offset divisible by 64. The padding is
   an extra field in the local header, ID `0x4F4E`, that readers ignore.
4. Names are UTF-8, relative, `/`-separated, without `..`.
5. No ZIP64 yet: a file is at most 4 GB. (Version 0.2 adds ZIP64.)

## The manifest, `one.json`

```json
{
  "format": "one",
  "version": "0.1",
  "generator": "one-pack.mjs",
  "created": "2026-11-28T10:00:00Z",
  "title": "Pagoda",
  "units": "m",
  "upAxis": "Y",
  "preview": "meta/preview.webp",
  "scene": "meta/scene.json",
  "metadata": {
    "creator": "…",
    "rights": "https://creativecommons.org/licenses/by/4.0/",
    "record": "meta/record.jsonld",
    "provenance": [
      { "activity": "capture", "agent": "…", "date": "2025-06-02", "method": "photogrammetry" },
      { "activity": "decimation", "software": "meshoptimizer 1.3", "parameters": { "ratio": 0.1 } }
    ]
  },
  "parts": [
    {
      "id": "model",
      "kind": "mesh",
      "role": "primary",
      "lods": [
        { "path": "mesh/lod0.glb", "triangles": 20000, "geometricError": 0.05 },
        { "path": "mesh/lod1.glb", "triangles": 400000, "geometricError": 0.002 }
      ]
    },
    { "id": "scan", "kind": "points", "path": "points/scan.laz", "certainty": "A" },
    { "id": "roof-1615", "kind": "mesh", "path": "mesh/roof-1615.glb", "certainty": "C" },
    { "id": "roof-1890", "kind": "mesh", "path": "mesh/roof-1890.glb", "certainty": "B" }
  ],
  "timeline": {
    "startYear": 1600,
    "endYear": 2025,
    "stages": [
      { "year": 1615, "label": "Built", "parts": ["model", "roof-1615"], "type": "modelled" },
      { "year": 1890, "label": "New roof", "parts": ["model", "roof-1890"], "type": "documented" },
      { "year": 2025, "label": "Scan", "parts": ["scan"], "type": "documented" }
    ]
  },
  "certainty": {
    "levels": [
      { "value": 10, "code": "A", "label": "Documented", "color": "#2e7d32" },
      { "value": 6, "code": "B", "label": "Analogy", "color": "#f9a825" },
      { "value": 2, "code": "C", "label": "Hypothesis", "color": "#c62828" }
    ]
  },
  "files": {
    "mesh/lod0.glb": { "size": 673156, "sha256": "…", "mediaType": "model/gltf-binary",
                       "offset": 1856, "length": 558802, "compression": "deflate" }
  }
}
```

### Fields

| Field | Meaning |
|---|---|
| `format`, `version` | `"one"` and `"major.minor"`. A newer major version is not read; a newer minor version is read and its unknown fields are skipped. |
| `generator`, `created`, `title` | What wrote the file, when, and what it shows. |
| `units`, `upAxis` | The unit of the parts' coordinates and their up axis (`Y` as in glTF, or `Z`). |
| `preview` | An image shown before any 3D data. |
| `scene` | An AIM3D manifest (the viewer's own, `viewer/manifesto/AIM3DViewer-schema.json`): annotations, cameras, lights, looks, tour, sounds, photos, data, surroundings... Applied over the parts once they are shown. **Any string in it that names a file of the container** (`"./res/bell.ogg"`) is read from the container. |
| `metadata` | Descriptive metadata: free fields, `rights`, `record` (a JSON-LD file in the container, e.g. CIDOC-CRM from WissKI), `provenance` (the steps from capture to this file: paradata). |
| `parts` | What is drawn, see below. At least one. |
| `timeline` | The time axis (4D), see below. |
| `certainty` | The Level of Certainty scale (the same object as `AIM3DViewer.certainty`). |
| `files` | Written by the packer: each file's `size`, `sha256`, `mediaType`, and where its data lies: `offset` (from the start of the file), `length` and `compression: "deflate"` when deflated. |

### Parts

| Field | Meaning |
|---|---|
| `id` | Unique in the file. The viewer names the part's root node `one-<id>`. |
| `kind` | `mesh` (glTF/GLB), `points` (LAS/LAZ/COPC), `splats` (SPZ, PLY, SPLAT, KSPLAT, SOG). Reserved: `image`, `audio`, `data`. A reader skips kinds it does not know. |
| `role` | `primary`: the part shown first and named in the order of the entries. |
| `path` or `lods` | One file, or the levels of detail from the **coarsest to the finest**. A level is a path or `{ path, triangles?, points?, geometricError?, screenSize? }` (see *Levels of detail*). |
| `label` | A readable name. |
| `certainty` | The part's level on the certainty scale (its `code`, or a number). |
| `transform` | Optional 4×4 column-major matrix placing the part in the file's space. |
| `hidden` | `true`: kept in the file, not shown at first. |
| `metadata` | The part's own metadata (its source, capture date, method...). |
| `properties` | A building's element properties: the `<name>_ifc.json` the IFC conversion writes (the viewer's BIM tools: click an element, see its property sets). |
| `lighting` | Splats only: their lighting volume (`<name>.light`, what the server builds next to an uploaded splat capture). |

### Levels of detail

Each part has its own levels, a whole file each (a full model). A reader
shows level 0 first; then each part gets the level its size on screen
calls for, and again whenever the camera moves (and stands still) enough
to change it: nearer, finer; further, coarser
(`viewer/one/one-lod.js`):

- levels with `geometricError` (in `units`, as in 3D Tiles): the coarsest
  level whose error, projected at the part's distance, stays under 4
  pixels;
- else levels with `screenSize`: a level is used once the part's bounding
  sphere covers that share of the view's height;
- else, the levels share 30%–80% of the view's height: with two levels,
  the finer one from 30% (a model framed in the view covers 80–90%;
  zoomed out as far as the viewer lets, about 20%).

A level is left for a coarser one only below 70% of its threshold, so a
camera at the edge does not make it flicker. Parts that keep their level
are not loaded again, and the bytes of a level read once stay in memory
(up to 512 MB per file): going back to a level costs no download.

Textures are kept inside each level's GLB in 0.1. Sharing them between
levels (one KTX2 file referenced by several GLBs) is planned for 0.2, as
glTF already allows external images.

### Timeline (4D)

The same object as the viewer's `AIM3DViewer.timeline` (stages with a
`year`, `label`, `description`, `type`, playback settings), with one
addition: a stage may name **parts** (`parts: ["roof-1890"]`) instead of
glTF nodes. The viewer turns them into the node names `one-<id>` and draws
the time axis with its usual fading between stages. Stages may still name
nodes inside a part's glTF (`nodes`).

Planned: changes over time stored as vertex animation textures (vertex
positions per stage, as image rows; 16-bit PNG, EXR or KTX2), so a
deforming object (a crack widening, a wall leaning) needs one mesh and a
texture, not a mesh per stage.

### Level of Certainty

`certainty` is the scale; a part's `certainty` is its level. The viewer
keeps the scale, and the scene manifest's annotations carry assessments as
usual. Planned: the parts' own levels coloured by the viewer's certainty
view, and per-surface certainty as a texture mask (which areas were
measured, which were reconstructed).

## Reading a file over the network

1. `GET` with `Range: bytes=0-65535`: the local header of `one.json` and,
   usually, all of it - with the place of every part (`files[…].offset`).
   A `200` reply instead of `206` means the server does not do ranges: the
   whole file is used.
2. A range per part, as it is needed: the coarsest level is the second
   request.

A file from another ZIP writer (no offsets in `one.json`) costs one more
read: the central directory at the end of the file (`Range: bytes=-65536`),
and its parts' local headers are read together with their data.
`openOneContainer(await urlSource(url))` in `one-container.js` does this;
`one-pack.mjs inspect/verify` always read the central directory too and
check `one.json` against it.
A server must not compress `.one4d` responses on the fly (the content is
already compressed, and on-the-fly compression breaks ranges).

## Tools

```sh
# From the levels of a model (coarsest first) - one.json is written for you
node scripts/one-pack.mjs pack --mesh model.preview.glb --mesh model.glb \
  --points scan.laz --preview thumb.webp --title "Pagoda" -o pagoda.one4d

# From a folder: one.json (without "files") and the files it names
node scripts/one-pack.mjs pack folder/ -o pagoda.one4d

node scripts/one-pack.mjs inspect pagoda.one4d   # parts, levels, offsets, alignment
node scripts/one-pack.mjs verify pagoda.one4d    # CRC-32 and SHA-256 of every entry
node scripts/one-pack.mjs unpack pagoda.one4d -d out/
```

## What this version does not do yet

- Upload: the server does not accept `.one4d` files yet; the viewer opens
  them from the device or by URL.
- Streaming of a COPC hierarchy by range from inside the container,
  shared textures, levels that refine one another instead of replacing
  one another.
- ZIP64 (files over 4 GB), signatures.

## Saving from the viewer

*File → Save as .one4d* (`Viewer.exportOneContainer()`, `viewer/one/one-export.js`)
writes the model shown with all the viewer knows about it:

- the model file as it was opened - a GLB with its `<name>.preview.glb`
  as a coarser level when the server has one; a point cloud or splats as
  they are (splats with their `.light` volume); other mesh formats as the
  GLB three.js exports from the scene. A `.one4d` keeps its parts;
- the scene as an AIM3D manifest (`meta/scene.json`): annotations, views,
  cameras, lights, materials, looks, clipping, measurements, timeline,
  certainty, tour, sounds, photos, data, surroundings, sun, weather...;
- **the files that scene links to**, fetched into `res/` and the links
  rewritten: sounds, historical photos, data tables, the GeoJSON of an old
  map, thumbnails, the environment map, shared metadata. The viewer's own
  settings (`AIM3DViewer.viewer`: credits' logos, links, services) belong
  to the deployment and stay out. A file that cannot be fetched stays a
  link, and the viewer says so;
- the building properties of a converted IFC model; a picture of the
  view (`meta/preview.webp`); a provenance step ("export", date, source).

Opened again, such a file needs nothing from the server it came from.

## The viewer's capabilities and the format

What the viewer can show or do, and where it lives in a `.one4d`.

| Capability | In the format | Status |
|---|---|---|
| Meshes (glTF, and everything converted to it) | `parts[kind=mesh]` | ✓ |
| Progressive loading (`.preview.glb` first) | a part's `lods` | ✓ any number of levels, chosen by the size on screen (or `geometricError`) as the camera moves |
| Point clouds (LAS/LAZ) | `parts[kind=points]` | ✓ whole file; COPC hierarchy by range from inside the container: planned |
| Streamed point clouds (Potree 2, 3D Tiles from the server) | - | ✗ thousands of files; a COPC part is the way in |
| Gaussian splats (SPZ, SPLAT, KSPLAT, SOG, PLY) and their lighting volume | `parts[kind=splats]`, `lighting` | ✓ |
| Paged splats (`.rad`, read by range) | `parts[kind=splats]` | ✓ read whole; by range from inside the container: planned |
| BIM: IFC element properties | a part's `properties` | ✓ |
| Annotations, views, cameras, lights, materials, looks (shading, raking light, AO...), clipping, measurements, tour | `scene` | ✓ |
| Timeline (4D) | `timeline` (stages naming parts) or the scene's `AIM3DViewer.timeline` (stages naming nodes) | ✓ |
| Level of Certainty | `certainty` scale, the scene's assessed annotations | ✓ scale and annotations; parts' own `certainty` in the certainty view: planned |
| Sounds in the scene, narrated annotations, room acoustics | `scene` + files in `res/` | ✓ |
| Historical photos | `scene` + `res/` | ✓ |
| Live data tables | `scene` + `res/` (a snapshot) | ✓ a snapshot; a live table stays a link on purpose |
| Surroundings (old map GeoJSON, water), sun, weather, location | `scene` + `res/` | ✓ map tiles (XYZ) stay links |
| Environment map (HDR) | `scene` + `res/` | ✓ |
| Descriptive metadata, provenance, rights | `metadata`, `metadata.record` (JSON-LD), the scene's metadata | ✓ |
| Several scenes of one manifest, variants, comparisons with another model | - | ✗ planned: further parts with `hidden: true`, scenes naming parts |
| Volumes (CT, microscopy, DICOM) | reserved kind `volume` | ✗ planned: the converted volume (`.dfgvol`: a manifest and chunks read by range) fits as it is |
| Audio files and 2D images as the main content | reserved kinds `audio`, `image` | ✗ planned |
| Thumbnails | `preview` | ✓ one picture; the server's set of views: planned |
| Live link (a shared session) | - | not a file's matter: a session follows the file |

See [the measurements](one-format-benchmarks.md) for what the format
gains (and costs) when a model is opened over a network.

## Related formats

glTF 2.0 (meshes, materials, animation), 3D Tiles 1.1 and I3S/SLPK
(levels of detail for large scenes), COPC (point clouds with levels of
detail), USDZ (a stored, 64-byte aligned ZIP: the model for this
container), E57 (scans). The One keeps their content as it is and adds the
time axis, the certainty and the provenance of one object.
