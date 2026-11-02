# Tasks

## Active

- [ ] **Volumes: NRRD, NIfTI, MetaImage** - header + raw/gzip data, ~100-150 lines per format on each side (worker + `lif-reader.js`-style reader); change the README sentence that NRRD is left out on purpose
- [ ] **Volumes: DICOM series (worker)** - `pydicom`; sort slices by ImagePositionPatient, RescaleSlope/Intercept to Hounsfield units, compressed transfer syntaxes (JPEG 2000, JPEG-LS)
  - viewer: Hounsfield windows in the volume panel (bone / soft tissue presets) instead of percentiles for CT
- [ ] **Volumes: OME-Zarr** - archive format written by the worker, and streamed level-of-detail rendering (bricks) for scans above 512 voxels per axis (micro-CT is often 2000³+)

## Waiting On

## Someday

- [ ] **Volumes: Zeiss CZI, Nikon ND2, Imaris IMS (worker only)** - when real users bring such files; `pylibCZIrw`, `nd2`, `h5py`
- [ ] **Volumes: LAS X 4 `.xlef` / `.lof`** - LIF successor (XML + separate image files)
- [ ] **Volumes: clipping planes, picking and measuring inside volumes** - planes passed to the ray marcher, picking on the isosurface
- [ ] **Volumes: CT voxel size from scanner logs** - SkyScan `.log` ("Image Pixel Size (um)"), Nikon `.xtekct`, Volume Graphics `.vgi` next to slice stacks

## Done

- [x] ~~**Volumes: TIFF stacks and OME-TIFF**~~ (2026-11-02) - worker `tiff_stack.py` (tifffile), viewer `tiff-reader.js` (geotiff.js + own LZW decoder)
