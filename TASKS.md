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
- [ ] **Volumes: CT voxel size from scanner logs** - SkyScan `.log` ("Image Pixel Size (um)"), Nikon `.xtekct`, Volume Graphics `.vgi` next to slice stacks

## Done

- [x] ~~**Volumes: DICOM series**~~ (2026-11-02) - worker `dicom_series.py` (pydicom + JPEG plugins), viewer `dicom-reader.js` (uncompressed), HU windows in the panel, samples in `viewer/examples/volumes/`
- [x] ~~**Volumes: NRRD, NIfTI, MetaImage**~~ (2026-11-02) - worker `raw_volume.py`, viewer `raw-volume-reader.js` (streamed, gzip/zlib)
- [x] ~~**Volumes: TIFF stacks and OME-TIFF**~~ (2026-11-02) - worker `tiff_stack.py` (tifffile), viewer `tiff-reader.js` (geotiff.js + own LZW decoder)
