# 2D images

The viewer opens 2D images the way it opens models: dropped on it, from the
upload panel, by URL or from the example list. It can open one image, or a
set of them:

- **one image**: JPEG, PNG, WebP, AVIF, GIF or BMP;
- **a set**: a `.zip` of images, or several images dropped together (in
  natural name order: `img2` before `img10`).

A `.zip` of slices, as micro-CT software exports them, stays a volume
([conversion](conversion-pipeline.md), `viewer/image-slices-reader.js`).
Slices are recognised in two ways: a SkyScan reconstruction log
(`*_rec.log`) next to them, or at least 8 images of one kind in one folder,
grey and all of one size (the first, the middle and the last are checked).
Any other `.zip` of images is a set.

Examples are under *Images (2D)* in the example list, in
`viewer/examples/images/`. They are made by
`scripts/generate-image-samples.py`, so they can be shared freely:

- `inscription.png`: a worn carved inscription, 300 dpi;
- `rock-art.jpg`: faded red ochre figures on rock, with EXIF and a made-up
  GPS position;
- `manuscript.jpg`: a faded page;
- `images-set.zip`: the three of them as a set.

## What is shown

The image is a plane in the scene, seen straight on (`viewer/image2d.js`).
A drag moves it and the wheel zooms; the camera does not turn, and the
ground is hidden. When the file gives its resolution (DPI: the JFIF
density, the EXIF resolution, PNG's `pHYs`), the plane is the image's real
size in metres, so the ruler measures the object: a 300 dpi scan measures in
centimetres. Without it, one scene unit is one pixel. Transparent pixels
show over a checkerboard.

Images larger than the GPU's texture size (at most 8192 pixels across) are
shown scaled down. The panel says at what size.

## The tools

The toolbar's image button opens the *Image* window
(`viewer/editor/image-panel.js`). Every setting works on the GPU (the
plane's shader), so it applies at once:

- **histogram**: red, green, blue and luminance, of the image as it is;
- **adjust**: brightness, contrast, gamma, saturation; one **channel**
  alone (red, green, blue, or the luminance as grey);
- **auto levels**: each channel stretched from its 0.5th to its 99.5th
  percentile to the full range. For a dull or faded photograph;
- **equalise the histogram**: the luminance spread evenly over the range.
  For faint writing and low contrast;
- **invert**: a negative, for glass plates and film;
- **sharpen**: an unsharp mask;
- **relief**: the image embossed in a light direction that can be chosen.
  For worn inscriptions, tool marks, coins and seals. It is what a raking
  light does to a 3D model, done on the photograph;
- **edges**: Sobel edges;
- **decorrelation stretch**: the colours turned onto their principal axes,
  each stretched to the same spread, then turned back (as DStretch does).
  Faint pigments come out in strong colours: rock art, faded ink, a
  palimpsest. On a JPEG it also brings out the compression's blocks;
- **false colour**: the luminance through a colour map (inferno, viridis,
  turbo), so small differences in brightness show as hues;
- **compare**: the original left of a line that can be moved;
- **reset**, and **save the image (PNG)**: the image as shown, at the
  pixels it is shown in, without the comparison line.

The order is fixed: sharpen, decorrelation stretch, levels, equalisation,
channel, brightness, contrast, gamma, saturation, relief, edges, invert,
false colour.

The window also says what the file is:

- its name, format, pixels and bit depth;
- its resolution and real size;
- its tags: title, description, author, copyright;
- the camera's data: date, camera, lens, exposure, aperture, sensitivity,
  focal length;
- its GPS position (`viewer/image-metadata.js`: EXIF in JPEG, PNG `eXIf`
  and WebP; PNG `tEXt` / `iTXt`).

## A set

- **The filmstrip**, over the top of the scene, holds the thumbnails, with
  the one shown marked, ‹ › and the position (`2 / 12`).
  <kbd>←</kbd> <kbd>→</kbd> (or <kbd>Page Up</kbd> <kbd>Page Down</kbd>)
  step through the set, and <kbd>Home</kbd> <kbd>End</kbd> go to the first
  and the last image.
- **The grid button** shows all the images at once, as a contact sheet. A
  click opens an image, and <kbd>Escape</kbd> closes the grid.
- **The settings** are the set's: the next image is shown the same way, to
  compare the photographs of a series. An image of another size or
  resolution is framed again.

## In a manifest

A manifest's scene can show an image: its painting annotation's body is an
`Image` (`{ "id": ".../rock-art.jpg", "type": "Image", "format":
"image/jpeg" }`). `AIM3DViewer.image` keeps the tools' settings that are
not the defaults, e.g. `{ "dstretch": true, "compare": true, "split": 0.35 }`
([AIM3DViewer-schema.md](../viewer/manifesto/AIM3DViewer-schema.md)). A
manifest saved from the viewer writes both.

The example manifests are under *Images (2D)* in the list of manifests:

- the inscription in relief;
- the rock art in a decorrelation stretch, against the original;
- the manuscript, equalised.

They are written by `scripts/build-media-manifests.py`. A `.zip` set
cannot be opened from a manifest yet.

## The worker

A single image uploaded is kept as it is, like the other formats the viewer
reads directly. No GLB and no thumbnails are made. A `.zip` of images
uploaded is converted to a volume as before (`worker/image_slices.py`); a
set of photographs is opened in the browser, dropped or by URL.

## Next

- Deep zoom for very large images: tiles from a IIIF Image API service or a
  pyramidal TIFF, instead of one texture.
- IIIF Presentation 3 manifests of images (Canvases) as a set.
- RTI / PTM (Reflectance Transformation Imaging): the light moved over the
  object in the browser.
- A single-page TIFF as a 2D image (now it is read as a volume).
