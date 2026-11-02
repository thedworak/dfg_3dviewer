"""Stacks of image slices - PNG, JPEG, BMP - -> volumes the viewer renders
(viewer/volume.js).

Micro-CT software exports reconstructions as one image per slice: SkyScan /
Bruker NRecon as BMP, PNG or JPEG, many others as PNG. Uploaded as a .zip,
the images of the upload's type in its folder, in natural name order
(rec_2 before rec_10), are the stack; they must all have the size of the
first.

Read with Pillow (python3-pil, which python3-matplotlib brings in
Dockerfile.base), a slice at a time. 8- and 16-bit greys are kept as they
are; colour images are taken as their luminance.

The voxel size comes from a SkyScan reconstruction log next to the slices
(<name>_rec.log: "Image Pixel Size (um)"), else the unit is "px" (voxels).

Output and manifest: volumes.py. The viewer reads these stacks itself too
(viewer/image-slices-reader.js), when opened without this worker.

Also usable on its own: python3 image_slices.py slices/rec_0000.png [out_dir]
"""

from pathlib import Path

import numpy as np

from volumes import MAX_SIZE, ManifestWriter, VolumeError, natural_key, run_cli, skyscan_pixel_size

FORMATS = {"png", "jpg", "jpeg", "bmp"}


class ImageSlicesError(VolumeError):
    pass


def _kind(path: Path) -> str:
    extension = path.suffix.lower().lstrip(".")
    return "jpg" if extension == "jpeg" else extension


def _image():
    try:
        from PIL import Image
    except ImportError as exc:  # the worker's image has it (Dockerfile.base)
        raise ImageSlicesError("Reading image slices needs the Pillow package") from exc
    return Image


def slices_of(source: Path):
    """The images of source's kind in its folder, in natural order."""
    kind = _kind(source)
    return sorted((p for p in source.parent.iterdir() if p.is_file() and _kind(p) == kind), key=natural_key)


def _grey(image):
    """A 2-D array of the image's grey values (16 bits kept)."""
    if image.mode in ("I;16", "I;16B", "I;16L", "I", "F", "L"):
        return np.asarray(image)
    # Palette, bilevel, RGB(A), CMYK...: luminance.
    return np.asarray(image.convert("L"))


class SliceView:
    """A (z, y, x) view of the stack, read when sliced."""

    def __init__(self, paths, shape, Image):
        self.paths, self.shape, self.Image = paths, shape, Image

    def __getitem__(self, key):
        planes = []
        for z in range(*key.indices(self.shape[0])):
            with self.Image.open(self.paths[z]) as image:
                plane = _grey(image)
            if plane.shape != self.shape[1:]:
                raise ImageSlicesError(
                    f"{self.paths[z].name}: {plane.shape[1]} x {plane.shape[0]} pixels, "
                    f"not {self.shape[2]} x {self.shape[1]} as the first slice"
                )
            planes.append(plane)
        return np.stack(planes)


def convert(source: Path, manifest: Path, max_size: int = MAX_SIZE, log_prefix: str = "") -> dict:
    """Writes the manifest and the volume of the slices `source` is one of.
    Raises ImageSlicesError when they cannot be shown."""
    Image = _image()
    paths = slices_of(source)
    if len(paths) < 2:
        raise ImageSlicesError(f"{source.name} is a single image: upload a .zip of all the slices of the stack")
    try:
        with Image.open(paths[0]) as image:
            first = _grey(image)
    except Exception as exc:  # noqa: BLE001 - any decoding error is "not readable"
        raise ImageSlicesError(f"{paths[0].name} is not a readable image: {exc}") from exc
    ny, nx = first.shape
    pixel = skyscan_pixel_size(source.parent)
    name = source.parent.name if source.parent.name not in ("", "extracted") else source.stem
    writer = ManifestWriter(source, manifest, max_size, log_prefix, label=_kind(source).upper())
    writer.add(
        name,
        f"{paths[0].name} … {paths[-1].name}",
        [SliceView(paths, (len(paths), ny, nx), Image)],
        [{"name": name, "color": "#ffffff", "bits": first.dtype.itemsize * 8}],
        [pixel, pixel, pixel] if pixel else [1.0, 1.0, 1.0],
        unit="µm" if pixel else "px",
    )
    return writer.finish()


if __name__ == "__main__":
    run_cli(convert, "Usage: python3 image_slices.py slices/rec_0000.png [out_dir]")
