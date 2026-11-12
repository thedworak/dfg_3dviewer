#!/usr/bin/env python3
"""Generate viewer/examples/audio/: a short soundscape for the viewer's audio
files (viewer/audio.js). Synthesised here - no recording of anyone or
anything - so it can be shared freely.

    soundscape.wav   Broadcast Wave, 16-bit stereo, 22.05 kHz, 12 s: a bell
                     (inharmonic partials dying away), a bird call sweeping
                     up on the left, a chord with its harmonics, wind on the
                     right, the bell again. Its bext chunk, LIST INFO tags and
                     four cue points with labels say what is where: the
                     viewer lists them as markers.
    soundscape.ogg   the same in Ogg Vorbis, with Vorbis comments and the
                     same markers as chapters (CHAPTERxxx); only with ffmpeg.

The WAV is deterministic (a fixed seed); the Ogg file's stream serial number
is ffmpeg's own.

Usage: python3 scripts/generate-audio-samples.py [output folder]
"""

import shutil
import struct
import subprocess
import sys
from pathlib import Path

import numpy as np

RATE = 22050
SECONDS = 12.0
TITLE = "Soundscape (synthetic)"
ARTIST = "ExPlora4D examples"
DATE = "2026-11-11"
COMMENT = "Made up by scripts/generate-audio-samples.py: bell, bird call, chord, wind."
MARKERS = [(0.2, "Bell"), (3.0, "Bird call"), (5.5, "Chord"), (9.0, "Bell again")]


def envelope(t, start, attack, decay):
    """0 before start, up in `attack` seconds, then dying away (e^-t/decay)."""
    local = t - start
    rise = np.clip(local / attack, 0, 1)
    return np.where(local < 0, 0.0, rise * np.exp(-np.maximum(local, 0) / decay))


def bell(t, start, base):
    # Partials of a church bell (hum, prime, tierce, quint, nominal...).
    ratios = [0.5, 1.0, 1.19, 1.5, 2.0, 2.52, 3.0, 4.07]
    out = np.zeros_like(t)
    for i, ratio in enumerate(ratios):
        out += envelope(t, start, 0.004, 2.6 / (1 + i * 0.45)) * np.sin(2 * np.pi * base * ratio * t) / (1 + i * 0.6)
    return out * 0.32


def bird(t, start):
    out = np.zeros_like(t)
    for n in range(5):
        s = start + n * 0.28
        local = np.clip(t - s, 0, 0.18)
        # A chirp sweeping 2.5 -> 5.5 kHz in 0.18 s.
        phase = 2 * np.pi * (2500 * local + (3000 / 0.36) * local ** 2)
        window = np.where((t >= s) & (t <= s + 0.18), np.sin(np.pi * (t - s) / 0.18) ** 2, 0)
        out += window * np.sin(phase)
    return out * 0.22


def chord(t, start, length):
    out = np.zeros_like(t)
    for base in (220.0, 277.18, 329.63):
        for harmonic in range(1, 7):
            out += np.sin(2 * np.pi * base * harmonic * t) / harmonic ** 1.6
    gate = np.clip((t - start) / 0.4, 0, 1) * np.clip((start + length - t) / 0.8, 0, 1)
    return out * gate * 0.07


def wind(t, rng):
    noise = rng.standard_normal(t.size)
    # Low-passed noise (a moving average), swelling and fading.
    kernel = np.ones(40) / 40
    smooth = np.convolve(noise, kernel, mode="same")
    swell = np.clip(np.sin(np.pi * (t - 6.5) / 4.5), 0, 1) ** 2
    return smooth * swell * 0.9


def soundscape():
    rng = np.random.default_rng(4)
    t = np.arange(int(RATE * SECONDS)) / RATE
    left = bell(t, 0.2, 392.0) + bird(t, 3.0) + chord(t, 5.5, 4.5) * 0.8 + bell(t, 9.0, 330.0) * 0.9
    right = bell(t, 0.2, 392.0) * 0.85 + bird(t, 3.0) * 0.25 + chord(t, 5.5, 4.5) + wind(t, rng) + bell(t, 9.0, 330.0)
    stereo = np.stack([left, right], axis=1)
    stereo /= np.max(np.abs(stereo)) / 0.89
    return (stereo * 32767).astype("<i2")


def chunk(cid, body):
    pad = b"\0" if len(body) % 2 else b""
    return cid + struct.pack("<I", len(body)) + body + pad


def fixed(text, size):
    return text.encode("latin-1")[:size].ljust(size, b"\0")


def write_wav(path, samples):
    channels = samples.shape[1]
    fmt = struct.pack("<HHIIHH", 1, channels, RATE, RATE * channels * 2, channels * 2, 16)
    bext = (
        fixed(COMMENT, 256) + fixed(ARTIST, 32) + fixed("EXPLORA4D-SOUNDSCAPE", 32)
        + fixed(DATE, 10) + fixed("12:00:00", 8) + struct.pack("<IIH", 0, 0, 1) + b"\0" * 64 + b"\0" * 190
    )
    info = b"INFO" + b"".join(
        chunk(cid, text.encode("latin-1") + b"\0")
        for cid, text in [(b"INAM", TITLE), (b"IART", ARTIST), (b"ICRD", DATE), (b"ICMT", COMMENT), (b"IGNR", "Soundscape")]
    )
    cue = struct.pack("<I", len(MARKERS)) + b"".join(
        struct.pack("<II4sIII", i + 1, int(time * RATE), b"data", 0, 0, int(time * RATE)) for i, (time, _label) in enumerate(MARKERS)
    )
    adtl = b"adtl" + b"".join(chunk(b"labl", struct.pack("<I", i + 1) + label.encode("latin-1") + b"\0") for i, (_time, label) in enumerate(MARKERS))
    body = b"WAVE" + chunk(b"fmt ", fmt) + chunk(b"bext", bext) + chunk(b"LIST", info) + chunk(b"data", samples.tobytes()) + chunk(b"cue ", cue) + chunk(b"LIST", adtl)
    path.write_bytes(b"RIFF" + struct.pack("<I", len(body)) + body)


def write_ogg(path, wav):
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        print("ffmpeg not found: soundscape.ogg skipped")
        return
    tags = {"title": TITLE, "artist": ARTIST, "date": DATE, "comment": COMMENT}
    for i, (time, label) in enumerate(MARKERS, start=1):
        seconds = int(time)
        tags[f"CHAPTER{i:03d}"] = f"00:00:{seconds:02d}.{int(round((time - seconds) * 1000)):03d}"
        tags[f"CHAPTER{i:03d}NAME"] = label
    args = [ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", str(wav), "-map_metadata", "-1", "-c:a", "libvorbis", "-q:a", "3"]
    for key, value in tags.items():
        args += ["-metadata", f"{key}={value}"]
    subprocess.run([*args, str(path)], check=True)


def main():
    out = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / "viewer" / "examples" / "audio")
    out.mkdir(parents=True, exist_ok=True)
    wav = out / "soundscape.wav"
    write_wav(wav, soundscape())
    print(f"wrote {wav}")
    write_ogg(out / "soundscape.ogg", wav)
    if (out / "soundscape.ogg").exists():
        print(f"wrote {out / 'soundscape.ogg'}")


if __name__ == "__main__":
    main()
