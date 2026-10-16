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

## Streamed point clouds (3D Tiles / Potree 2)

Uploaded scans are converted by the worker to a 3D Tiles tileset (`pnts` octree) - see "Point clouds" in [worker/README.md](../worker/README.md). Potree 2 output (`metadata.json`, from PotreeConverter 2) is read as well. `viewer/tiles.js` streams them with 3d-tiles-renderer, with Eye-Dome Lighting, round/sphere points and level-of-detail colours in the point cloud panel. Settings: `viewer.tiles.*`.

While py3dtiles runs, the viewer already shows a **quick preview**: the worker first writes a random subsample of about a million points, shuffled, as `tiles/<name>.preview.las`, and the job status reports it as `previewUrl`. The upload panel (`viewer/ui/upload-panel.js`) loads it like any LAS file (direct loading, above) - because the points are in random order, the first batch already shows the whole object and later batches make it denser - with a "Preview · building the full point cloud..." badge. When the job is `ready`, the streamed tiles replace the preview. `WORKER_POINTCLOUD_PREVIEW_POINTS` sets the size (`0`: no preview).

## Roadmap

Planned improvements for very large point clouds, in this order:

1. **Decoding in a Web Worker, progressive display** - *done* (this page, "Direct loading").
2. **Quick preview before the full conversion** - *done* (this page, "Streamed point clouds").
3. **Display: GPU colouring, adaptive point size, Eye-Dome Lighting for directly loaded clouds** - *done* (this page, "Direct loading").
4. **Output format and delivery**: COPC (Cloud Optimized Point Cloud, one LAZ file read with HTTP range requests) or PotreeConverter 2 instead of py3dtiles, keeping intensity and classification; precompressed files, immutable caching and a CDN.
5. **Tools**: cross-sections and profiles, filtering by classification, GPU picking for measurements and annotations on points.
6. **Experimental**: point rasterization in WebGPU compute shaders (hundreds of millions of points).
