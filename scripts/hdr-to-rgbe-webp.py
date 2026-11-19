#!/usr/bin/env python3
"""Repack a Radiance .hdr environment map as a lossless WebP, for ultra.html.

The ultralight viewer (viewer/ultra.js) loads its environment map as a WebP
twice as wide as the map: the RGBE mantissas (R, G, B) on the left, the
exponent (E, in all three channels) on the right, no alpha. The bytes are the
.hdr file's exactly (lossless WebP; checked below), so the lighting is the
same, at about half the transfer of the gzipped .hdr; the viewer decodes it on
the GPU (no canvas read-back, which privacy settings can add noise to).

    python3 scripts/hdr-to-rgbe-webp.py viewer/js/maps/lite/neutral.hdr viewer/js/maps/lite/neutral.rgbe.webp
"""
import argparse
import importlib.util
import io
from pathlib import Path

import numpy as np
from PIL import Image

spec = importlib.util.spec_from_file_location("downscale_hdr", Path(__file__).with_name("downscale-hdr.py"))
downscale_hdr = importlib.util.module_from_spec(spec)
spec.loader.exec_module(downscale_hdr)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("input")
    parser.add_argument("output")
    args = parser.parse_args()

    rgbe = downscale_hdr.read_rgbe(args.input)
    exponent = np.repeat(rgbe[..., 3:4], 3, axis=2)
    packed = np.ascontiguousarray(np.concatenate([rgbe[..., :3], exponent], axis=1))
    buffer = io.BytesIO()
    Image.fromarray(packed, "RGB").save(buffer, "WEBP", lossless=True, quality=100, method=6, exact=True)
    data = buffer.getvalue()

    decoded = np.asarray(Image.open(io.BytesIO(data)).convert("RGB"))
    if not np.array_equal(decoded, packed):
        raise SystemExit("the WebP does not decode to the same bytes")
    Path(args.output).write_bytes(data)
    height, width = rgbe.shape[:2]
    print(f"{args.output}: {width}x{height} map, {len(data)} bytes")


if __name__ == "__main__":
    main()
