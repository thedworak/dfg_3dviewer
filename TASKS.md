# Tasks

## Active

- [ ] **Volumes: OME-Zarr** - archive format written by the worker, and streamed level-of-detail rendering (bricks) for scans above 512 voxels per axis (micro-CT is often 2000³+)

## Waiting On

## Someday

- [ ] **Volumes: Zeiss CZI, Nikon ND2, Imaris IMS (worker only)** - when real users bring such files; `pylibCZIrw`, `nd2`, `h5py`
- [ ] **Volumes: LAS X 4 `.xlef` / `.lof`** - LIF successor (XML + separate image files)
- [ ] **Volumes: clipping planes, picking and measuring inside volumes** - planes passed to the ray marcher, picking on the isosurface
- [ ] **Volumes: NIfTI .hdr/.img pairs and Analyze 7.5** - two files per volume
- [ ] **Volumes: orientation from direction cosines** - NRRD space directions, NIfTI qform/sform, MetaImage TransformMatrix: oblique stacks drawn as a sheared/rotated box instead of axis-aligned
- [ ] **Volumes: legibility on the light background** - a grey CT volume (translucent, MIP) is pale on the default light scene; a dark background while a volume is shown, or lighting/shading in the translucent mode
- [ ] **Volumes: DICOM in the browser - compressed and multi-frame** - RLE (simple), JPEG lossless; enhanced multi-frame positions from the functional groups

## Done

- [x] ~~**Intro page**~~ (2026-11-02) - `intro.html`: a cloud of 200k points gathers into the Wołpa Synagogue, the last point lands with a flash and a wave of light, then the real mesh appears (vertices, edges, faces) and a button leads into the viewer; an express feature tour (sections, annotations, shading, sun study, seasons); synthesized sound; optional in front of the viewer page (`viewer.intro`) (`viewer/intro/`, points from `scripts/build-intro-points.mjs`, `docs/intro.md`)
- [x] ~~**Volumes and point clouds: settings on phones as a minimized modal window**~~ (2026-11-02) - the Volume and Point cloud panels appear as its icon; a tap opens it centred over the viewer on a backdrop, a tap beside it, Escape or the toolbar button folds it (`modal` option of `attachToolPanelChrome`, `setToolPanelMinimized`); drawing a profile folds the point cloud window so its clicks reach the cloud
- [x] ~~**Volumes: CT exports - image slices, .vgi, .xtekct; .zip by URL**~~ (2026-11-02) - PNG / JPEG / BMP slices in a .zip (`image_slices.py`, `image-slices-reader.js`), voxel size from a SkyScan `_rec.log` (also for TIFF slices); Volume Graphics `.vgi` and Nikon `.xtekct` + `.vol` in `raw_volume.py` / `raw-volume-reader.js` (Nikon's type by the .vol's size); a `.zip` URL without the repository's `<name>_ZIP/` conversion is downloaded and opened in the browser (`Viewer.openZipFromUrl`), so the CT archives are in the example list
- [x] ~~**Volumes: MRC and Zeiss LSM**~~ (2026-11-02) - MRC/CCP4 (`.mrc`, `.rec`, `.ccp4`; modes 0/1/2/6/12, any axis order in the worker) in `raw_volume.py` / `raw-volume-reader.js`; LSM (channels as samples, thumbnails skipped, CZ_LSMINFO voxel size, Zeiss' BitsPerSample offset) in `tiff_stack.py` / `tiff-reader.js`; samples `capsid.mrc`, `cells.lsm`
- [x] ~~**Volumes: DICOM series**~~ (2026-11-02) - worker `dicom_series.py` (pydicom + JPEG plugins), viewer `dicom-reader.js` (uncompressed), HU windows in the panel, samples in `viewer/examples/volumes/`
- [x] ~~**Volumes: NRRD, NIfTI, MetaImage**~~ (2026-11-02) - worker `raw_volume.py`, viewer `raw-volume-reader.js` (streamed, gzip/zlib)
- [x] ~~**Volumes: TIFF stacks and OME-TIFF**~~ (2026-11-02) - worker `tiff_stack.py` (tifffile), viewer `tiff-reader.js` (geotiff.js + own LZW decoder)
