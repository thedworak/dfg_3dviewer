#!/usr/bin/env python3
"""Generate viewer/examples/images/: 2D images for the viewer's image tools
(viewer/image2d.js). Synthesised here - no photograph of anyone or anything -
so they can be shared freely.

    inscription.png   a stone slab with a worn carved inscription, barely
                      seen in flat light: relief, sharpening, edges bring it
                      out. 300 dpi (pHYs), so the ruler measures centimetres;
                      Title and Author (tEXt).
    rock-art.jpg      a rock face with faded red ochre figures: the
                      decorrelation stretch shows them. EXIF: camera, lens,
                      exposure, date, a (made up) GPS position.
    manuscript.jpg    a faded page of handwriting-like lines on parchment:
                      auto levels and histogram equalisation.
    images-set.zip    the three of them, browsed as a set (filmstrip, grid).

Deterministic (fixed seeds). Needs numpy and Pillow; the inscription's
letters use DejaVu Serif (its licence allows this) when it is installed,
else Pillow's own font.

Usage: python3 scripts/generate-image-samples.py
"""

import io
import zipfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, PngImagePlugin
from PIL.TiffImagePlugin import IFDRational as R

OUT = Path(__file__).resolve().parent.parent / "viewer" / "examples" / "images"
WIDTH, HEIGHT = 1200, 750


def noise(rng, width, height, octaves=5):
    """Fractal value noise, 0..1."""
    total = np.zeros((height, width))
    amplitude, weight = 1.0, 0.0
    for octave in range(octaves):
        cells = 4 * 2 ** octave
        grid = rng.random((cells + 1, int(cells * width / height) + 2))
        layer = np.array(Image.fromarray((grid * 255).astype(np.uint8)).resize((width, height), Image.BICUBIC)) / 255.0
        total += layer * amplitude
        weight += amplitude
        amplitude *= 0.5
    return total / weight


def font(size):
    for path in ("/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf", "/usr/share/fonts/TTF/DejaVuSerif-Bold.ttf"):
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default(size)


def inscription(rng):
    stone = 0.6 * noise(rng, WIDTH, HEIGHT) + 0.4 * noise(rng, WIDTH, HEIGHT, 7)
    grain = rng.normal(0, 0.012, (HEIGHT, WIDTH))
    # The letters as a depth map, worn (blurred) and shallow.
    mask = Image.new("L", (WIDTH, HEIGHT), 0)
    draw = ImageDraw.Draw(mask)
    lines = ["EXPLORARE", "EXPERIRI", "MMXXVI"]
    for index, line in enumerate(lines):
        size = 112 if index < 2 else 82
        letters = font(size)
        box = draw.textbbox((0, 0), line, font=letters)
        x = (WIDTH - (box[2] - box[0])) / 2
        y = 110 + index * 195
        draw.text((x, y), line, fill=255, font=letters)
    depth = np.array(mask.filter(ImageFilter.GaussianBlur(5)), dtype=np.float64) / 255.0
    depth *= 0.55 + 0.45 * noise(rng, WIDTH, HEIGHT, 3)
    # Flat, frontal light: the carving only darkens the grooves a little.
    shade = 0.62 + 0.25 * stone + grain - 0.045 * depth
    gy, gx = np.gradient(depth)
    shade += 0.25 * (gx * -0.6 + gy * -0.8)
    rgb = np.stack([shade * 1.02, shade * 0.98, shade * 0.9], axis=-1)
    # Lichen and weathering, soft-edged.
    stains = noise(rng, WIDTH, HEIGHT, 4)[..., None]
    rgb = rgb * (0.92 + 0.08 * stains) + np.array([0.025, 0.018, 0.0]) * np.clip((stains - 0.55) * 4, 0, 1)
    return Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8))


def rock_art(rng):
    rock = noise(rng, WIDTH, HEIGHT)
    cracks = np.array(Image.fromarray((noise(rng, WIDTH, HEIGHT, 6) * 255).astype(np.uint8)).filter(ImageFilter.FIND_EDGES)) / 255.0
    base = np.stack([0.66 + 0.2 * rock, 0.55 + 0.18 * rock, 0.42 + 0.15 * rock], axis=-1) - 0.25 * cracks[..., None]
    # Red ochre figures, almost gone: a few percent of colour.
    figures = Image.new("L", (WIDTH, HEIGHT), 0)
    draw = ImageDraw.Draw(figures)
    for cx, cy, scale in ((315, 390, 0.75), (700, 320, 0.95), (945, 480, 0.6)):
        # An animal: body, neck and head, legs, horns.
        draw.ellipse((cx - 120 * scale, cy - 45 * scale, cx + 120 * scale, cy + 45 * scale), fill=255)
        draw.line((cx + 100 * scale, cy - 20 * scale, cx + 170 * scale, cy - 90 * scale), fill=255, width=int(26 * scale))
        draw.ellipse((cx + 150 * scale, cy - 125 * scale, cx + 215 * scale, cy - 75 * scale), fill=255)
        for leg in (-80, -40, 50, 90):
            draw.line((cx + leg * scale, cy + 30 * scale, cx + (leg + 8) * scale, cy + 140 * scale), fill=255, width=int(14 * scale))
        draw.arc((cx + 150 * scale, cy - 200 * scale, cx + 260 * scale, cy - 90 * scale), 200, 300, fill=255, width=int(8 * scale))
    for hx, hy in ((180, 170), (1090, 195)):
        # Hand stencils: the rock left bare in a spray of pigment.
        draw.ellipse((hx - 68, hy - 82, hx + 68, hy + 82), fill=110)
    alpha = np.array(figures.filter(ImageFilter.GaussianBlur(3)), dtype=np.float64)[..., None] / 255.0
    alpha *= 0.035 + 0.03 * noise(rng, WIDTH, HEIGHT, 3)[..., None]
    ochre = np.array([0.62, 0.22, 0.14])
    rgb = base * (1 - alpha) + ochre * alpha + rng.normal(0, 0.012, base.shape)
    return Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8))


def manuscript(rng):
    parchment = noise(rng, WIDTH, HEIGHT)
    base = np.stack([0.83 + 0.08 * parchment, 0.76 + 0.08 * parchment, 0.6 + 0.07 * parchment], axis=-1)
    ink = Image.new("L", (WIDTH, HEIGHT), 0)
    draw = ImageDraw.Draw(ink)
    for row in range(12):
        y = 80 + row * 52
        x = 105 + rng.integers(0, 22)
        while x < WIDTH - 150:
            length = int(rng.integers(30, 120))
            points = [(x + i * 6, y + 10 * np.sin(i * 1.7 + row) * rng.random()) for i in range(length // 6)]
            if len(points) > 1:
                draw.line(points, fill=255, width=4)
            x += length + int(rng.integers(18, 36))
    ink_alpha = np.array(ink.filter(ImageFilter.GaussianBlur(1.2)), dtype=np.float64)[..., None] / 255.0
    # Faded: brown ink at a fraction of its strength, weaker towards one side.
    fade = np.linspace(0.32, 0.14, WIDTH)[None, :, None]
    ink_color = np.array([0.36, 0.24, 0.14])
    rgb = base * (1 - ink_alpha * fade) + ink_color * ink_alpha * fade
    stains = noise(rng, WIDTH, HEIGHT, 3)[..., None]
    rgb *= 1 - 0.12 * np.clip(stains - 0.55, 0, 1) * 3
    # Low contrast all over, as an old photograph of the page.
    rgb = 0.35 + rgb * 0.55
    return Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8))


def exif_for_rock_art():
    exif = Image.Exif()
    exif[0x010F] = "ExPlora4D"
    exif[0x0110] = "Synthetic camera"
    exif[0x0131] = "scripts/generate-image-samples.py"
    exif[0x013B] = "ExPlora4D examples"
    exif[0x8298] = "CC0"
    exif[0x010E] = "Rock face with faded red ochre figures (synthetic)"
    exif_ifd = exif.get_ifd(0x8769)
    exif_ifd[0x9003] = "2026:11:11 10:30:00"
    exif_ifd[0x829A] = R(1, 125)
    exif_ifd[0x829D] = R(56, 10)
    exif_ifd[0x8827] = 200
    exif_ifd[0x920A] = R(35, 1)
    exif_ifd[0xA434] = "Synthetic 35 mm"
    gps = exif.get_ifd(0x8825)
    gps[1] = "N"
    gps[2] = (R(50, 1), R(3, 1), R(0, 1))
    gps[3] = "E"
    gps[4] = (R(19, 1), R(56, 1), R(0, 1))
    gps[5] = b"\x00"
    gps[6] = R(250, 1)
    return exif


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    files = {}

    info = PngImagePlugin.PngInfo()
    info.add_text("Title", "Worn inscription (synthetic)")
    info.add_text("Author", "ExPlora4D examples")
    buffer = io.BytesIO()
    inscription(np.random.default_rng(1)).save(buffer, "PNG", pnginfo=info, dpi=(300, 300), optimize=True)
    files["inscription.png"] = buffer.getvalue()

    buffer = io.BytesIO()
    rock_art(np.random.default_rng(2)).save(buffer, "JPEG", quality=90, exif=exif_for_rock_art())
    files["rock-art.jpg"] = buffer.getvalue()

    buffer = io.BytesIO()
    manuscript(np.random.default_rng(3)).save(buffer, "JPEG", quality=88, dpi=(200, 200))
    files["manuscript.jpg"] = buffer.getvalue()

    for name, data in files.items():
        (OUT / name).write_bytes(data)
        print(f"wrote {OUT / name} ({len(data) // 1024} kB)")
    with zipfile.ZipFile(OUT / "images-set.zip", "w", zipfile.ZIP_STORED) as archive:
        for index, name in enumerate(("inscription.png", "rock-art.jpg", "manuscript.jpg"), start=1):
            info = zipfile.ZipInfo(f"images-set/{index:02d}-{name}", date_time=(2026, 11, 11, 0, 0, 0))
            archive.writestr(info, files[name])
    print(f"wrote {OUT / 'images-set.zip'}")


if __name__ == "__main__":
    main()
