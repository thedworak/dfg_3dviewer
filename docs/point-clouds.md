# Point clouds

How the viewer handles point clouds, from a small scan opened directly to a multi-gigabyte one converted for streaming, and what is planned next.

## Two ways to show a point cloud

| | Direct loading | Streamed (converted) |
| --- | --- | --- |
| Input | LAS, LAZ (also XYZ, PCD) | LAS, LAZ, E57, face-less PLY, uploaded to the worker |
| Where the work happens | the browser (Web Worker) | the conversion worker (`worker/pointcloud.py`, py3dtiles) |
| What the viewer loads | the whole file | only the octree nodes the view needs (3D Tiles `pnts`, or Potree 2) |
| Size limit | thinned to `viewer.pointCloud.maxPoints` (default 5 million) | none: detail loads as you zoom in |
| Code | `viewer/pointcloud-las*.js` | `viewer/tiles.js` |

Rule of thumb: direct loading for quick looks and drag and drop (up to a few hundred MB); the worker for anything that should be published or viewed at full resolution.

## Direct loading (LAS / LAZ)

`loaders.js` hands the file's URL (a `blob:` URL for drag and drop) to `loadLasPointCloud()` in `viewer/pointcloud-las.js`:

1. A module Web Worker (`viewer/pointcloud-las-worker.js`) downloads the file with `fetch` and decodes it (`viewer/pointcloud-las-decode.js`):
   - **LAS** is decoded record by record *while it downloads*: the file itself is never held in memory, only the points that are kept. All point formats 0-10 (LAS 1.0-1.4).
   - **LAZ** is downloaded in full (laz-perf needs the whole file) and decompressed by loaders.gl's laz-perf build in batches. Point formats 0-3.
2. Points go back to the page in batches of 100 000 (positions re-centred in double precision, then Float32; RGB; intensity; classification), as transferred buffers.
3. The viewer shows the cloud with the first batch: the buffers are sized from the LAS header and the header's bounds frame the camera, so the model is placed correctly from the start. Later batches fill in the same buffers (only the new range is uploaded to the GPU).
4. When all points are in, the point cloud panel and the model statistics are set up; `window.viewer.fullModelLoaded` becomes `true`; a toast reports the point count.

Clouds larger than `viewer.pointCloud.maxPoints` are thinned (every n-th point; toast `pointCloudThinned`). If the worker cannot start (no module workers, or the bundle is served from another origin), the same decoder runs on the main thread - slower to show, same result. If the download breaks off, the points that arrived stay.

Display (`viewer/pointcloud-material.js`, the point cloud panel): directly loaded clouds use the same material as the streamed ones (from 3d-tiles-renderer), so they get:

- **colouring on the GPU** - RGB, intensity, height or classification is a shader uniform; switching modes never rewrites millions of colours;
- **adaptive point size** (default) - in world units, from the cloud's estimated point spacing, so surfaces stay closed when zoomed in and points do not blot out details from afar; or a fixed size in pixels;
- **square, round or sphere points** - spheres write their depth, so overlapping points meet as solid surfaces;
- **Eye-Dome Lighting** - shades edges and creases from the depth of neighbouring points, which makes the shape readable without normals.

While a LAS/LAZ file is still loading, points are drawn at a fixed pixel size; the panel and these settings apply once all points are in.

Settings: `viewer.pointCloud.maxPoints`, `colorMode`, `sizeMode`, `pointSize`, `pointShape`, `edlStrength` - see [viewer-settings.md](viewer-settings.md).

## Streamed point clouds (Potree 2 / 3D Tiles)

Uploaded scans are converted by the worker to a level-of-detail octree - see "Point clouds" in [worker/README.md](../worker/README.md):

- **Potree 2** (default, PotreeConverter): three files - `metadata.json`, `hierarchy.bin`, `octree.bin`. The viewer reads each node from `octree.bin` with an HTTP range request, so the server must answer ranges: the worker does (`worker/static_files.py`), the viewer's nginx caches `octree.bin` in 1 MB slices, and the test server (`scripts/serve-dist.js`) handles them too. Intensity and classification are kept, and the point cloud panel colours by them.
- **3D Tiles** (py3dtiles, `WORKER_POINTCLOUD_FORMAT=3dtiles` or when PotreeConverter is missing): `tileset.json` + one `.pnts` per node; position and colour only.

`viewer/tiles.js` streams both with 3d-tiles-renderer. Colours (point cloud panel): RGB, height, intensity and classification (Potree clouds that carry them - `metadata.json` lists each attribute's range), and "detail levels" to see how the octree refines; one set of shader uniforms is shared by all tiles. Also Eye-Dome Lighting and round/sphere points. Scans in projected coordinates (UTM, Gauss-Krüger) are oriented Z-up like local ones, not mistaken for Earth-centred tilesets. Settings: `viewer.tiles.*`. Example: `examples/potree/scan/metadata.json`.

**Delivery.** Converted files are served with byte ranges, ETags (304 on revalidation), 30-day caching, and gzip for formats that are not compressed already (JSON, LAS, `.pnts`, Potree's hierarchy - compressed once in the background, see the worker README). Cloudflare caches them in front.

Why Potree 2 rather than COPC: COPC (Cloud Optimized Point Cloud - one LAZ file with an octree, read by ranges) would be the better archive format, but needs a LAZ chunk decoder and an octree renderer of its own in the viewer, while Potree 2 is read by the 3d-tiles-renderer plugin the viewer already uses, with the same range-request delivery. COPC stays an option for later (e.g. as a download next to the Potree output).

While the converter runs, the viewer already shows a **quick preview**: the worker first writes a random subsample of about a million points, shuffled, as `tiles/<name>.preview.las`, and the job status reports it as `previewUrl`. The upload panel (`viewer/ui/upload-panel.js`) loads it like any LAS file (direct loading, above) - because the points are in random order, the first batch already shows the whole object and later batches make it denser - with a "Preview · building the full point cloud..." badge. When the job is `ready`, the streamed tiles replace the preview. `WORKER_POINTCLOUD_PREVIEW_POINTS` sets the size (`0`: no preview).

## Tools

In the point cloud panel, for directly loaded and streamed clouds alike:

- **Classes** - a check box per ASPRS class in the cloud (Ground, Building, Vegetation ... with their colours and, for a loaded file, point counts). Switched-off classes disappear from the view, the Eye-Dome Lighting and picking - e.g. to measure a building without the vegetation in front of it.
- **Profile** (cross-section) - "Draw profile", then two clicks on the cloud: only a vertical slab of points along that line stays, seen from the side in an orthographic view. The slab's width is adjustable; measurements on it give heights and distances in the section. "Clear profile" brings the whole cloud back.

And for the viewer's other tools:

- **Picking on the GPU** - the ruler, annotations, double-tap focus and the profile get the point that is drawn under the cursor, found by drawing the clouds once more in a small square around it with each point's id as its colour. The raycast it replaces tested every point on the CPU against a fixed distance in world units, which on large scans was slow and often picked a point well away from the cursor.
- **Point annotations** - with annotations on (picking mode), a click on a point cloud opens the annotation dialog for that point. They are stored as point annotations in the model root's space (as IIIF point annotations are), so they work on streamed clouds too, where face annotations are not possible.

## Roadmap

Planned improvements for very large point clouds, in this order:

1. **Decoding in a Web Worker, progressive display** - *done* (this page, "Direct loading").
2. **Quick preview before the full conversion** - *done* (this page, "Streamed point clouds").
3. **Display: GPU colouring, adaptive point size, Eye-Dome Lighting for directly loaded clouds** - *done* (this page, "Direct loading").
4. **Output format and delivery: Potree 2 by default (intensity, classification), range requests, gzip, ETags, nginx slices** - *done* (this page, "Streamed point clouds").
5. **Tools: profiles (cross-sections), class filter, GPU picking, point annotations** - *done* (this page, "Tools").
6. **Experimental**: point rasterization in WebGPU compute shaders (hundreds of millions of points).
