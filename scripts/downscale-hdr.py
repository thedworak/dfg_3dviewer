#!/usr/bin/env python3
"""Downscale a Radiance .hdr environment map (32-bit RLE RGBE).

The lightweight viewer loads its environment maps from assets/maps/lite/
(viewer/loaders.js): the same maps at a quarter of the pixels, so a quarter
of the bytes. Pixels are averaged in linear light, factor x factor at a time.

    python3 scripts/downscale-hdr.py viewer/js/maps/neutral.hdr viewer/js/maps/lite/neutral.hdr
    python3 scripts/downscale-hdr.py --factor 4 in.hdr out.hdr
"""
import argparse
import re

import numpy as np


def read_hdr(path):
    data = open(path, "rb").read()
    pos = 0
    header = []
    while True:
        end = data.index(b"\n", pos)
        line = data[pos:end].decode("latin-1")
        pos = end + 1
        if line == "":
            break
        header.append(line)
    if not header or not header[0].startswith("#?"):
        raise ValueError(f"{path}: not a Radiance HDR file")
    if any(l.startswith("FORMAT=") and l != "FORMAT=32-bit_rle_rgbe" for l in header):
        raise ValueError(f"{path}: only 32-bit_rle_rgbe is supported")
    end = data.index(b"\n", pos)
    size = data[pos:end].decode("latin-1")
    pos = end + 1
    m = re.fullmatch(r"-Y (\d+) \+X (\d+)", size.strip())
    if not m:
        raise ValueError(f"{path}: unsupported orientation {size!r}")
    height, width = int(m.group(1)), int(m.group(2))
    rgbe = np.zeros((height, width, 4), dtype=np.uint8)
    for y in range(height):
        if data[pos] == 2 and data[pos + 1] == 2 and (data[pos + 2] << 8 | data[pos + 3]) == width:
            pos += 4
            for c in range(4):
                x = 0
                while x < width:
                    count = data[pos]
                    pos += 1
                    if count > 128:
                        count -= 128
                        rgbe[y, x:x + count, c] = data[pos]
                        pos += 1
                    else:
                        rgbe[y, x:x + count, c] = np.frombuffer(data, np.uint8, count, pos)
                        pos += count
                    x += count
        else:  # flat scanline
            rgbe[y] = np.frombuffer(data, np.uint8, width * 4, pos).reshape(width, 4)
            pos += width * 4
    exp = rgbe[..., 3].astype(np.int32)
    scale = np.where(exp == 0, 0.0, np.ldexp(1.0, exp - 136))
    return rgbe[..., :3].astype(np.float64) * scale[..., None]


def encode_rgbe(rgb):
    peak = rgb.max(axis=-1)
    mantissa, exp = np.frexp(peak)
    rgbe = np.zeros(rgb.shape[:2] + (4,), dtype=np.uint8)
    lit = peak > 1e-32
    scale = np.where(lit, mantissa * 256.0 / np.where(lit, peak, 1.0), 0.0)
    rgbe[..., :3] = np.clip(rgb * scale[..., None], 0, 255).astype(np.uint8)
    rgbe[..., 3] = np.where(lit, exp + 128, 0).astype(np.uint8)
    return rgbe


def rle_channel(values):
    out = bytearray()
    i, n = 0, len(values)
    while i < n:
        run = 1
        while i + run < n and run < 127 and values[i + run] == values[i]:
            run += 1
        if run >= 3:
            out += bytes((128 + run, values[i]))
            i += run
            continue
        start = i
        while i < n and i - start < 128:
            if i + 2 < n and values[i] == values[i + 1] == values[i + 2]:
                break
            i += 1
        out.append(i - start)
        out += bytes(values[start:i])
    return out


def write_hdr(path, rgb):
    height, width = rgb.shape[:2]
    rgbe = encode_rgbe(rgb)
    out = bytearray(b"#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n")
    out += f"-Y {height} +X {width}\n".encode()
    for y in range(height):
        out += bytes((2, 2, width >> 8, width & 255))
        for c in range(4):
            out += rle_channel(rgbe[y, :, c].tolist())
    open(path, "wb").write(out)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("input")
    parser.add_argument("output")
    parser.add_argument("--factor", type=int, default=2, help="shrink each side by this much (default 2)")
    args = parser.parse_args()
    rgb = read_hdr(args.input)
    f = args.factor
    h, w = rgb.shape[0] // f * f, rgb.shape[1] // f * f
    small = rgb[:h, :w].reshape(h // f, f, w // f, f, 3).mean(axis=(1, 3))
    write_hdr(args.output, small)
    print(f"{args.input} {rgb.shape[1]}x{rgb.shape[0]} -> {args.output} {small.shape[1]}x{small.shape[0]}")


if __name__ == "__main__":
    main()
