#!/usr/bin/env python3
"""Generate the room acoustics example: the Wolpa Synagogue's prayer hall
heard with its reverberation worked out from the model
(viewer/editor/scene-acoustics.js, viewer/room-acoustics.js).

    viewer/examples/audio/shofar.ogg
        a dry, synthesised horn call - a long blast, three broken ones, nine
        short ones - then silence, so that the hall's reverberation is heard
        after each part (16 s, loops). No recording: it can be shared freely.

    viewer/manifesto/examples/wolpa-synagogue-aim3d-local-acoustics.json
        the section through the prayer hall (wolpa-synagogue-aim3d-local-
        section-measured.json) without its measurements, with the call at
        the middle of the hall and AIM3DViewer.sounds.acoustics: wooden
        walls, benches on the floor, the listening point a few meters from the call.

Needs numpy and ffmpeg with libvorbis. The sound is deterministic.

Usage: python3 scripts/generate-acoustics-sample.py
"""

import copy
import json
import shutil
import subprocess
import tempfile
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SOUND = ROOT / "viewer" / "examples" / "audio" / "shofar.ogg"
MANIFEST_DIR = ROOT / "viewer" / "manifesto" / "examples"
BASE = MANIFEST_DIR / "wolpa-synagogue-aim3d-local-section-measured.json"
OUT = MANIFEST_DIR / "wolpa-synagogue-aim3d-local-acoustics.json"
RATE = 22050
SECONDS = 16.0

# Scene units are centimeters (the manifest's spatialScale); the hall's
# floor is at y = 110.
SOURCE = {
    "id": "call",
    "type": "point",
    "src": "./examples/audio/shofar.ogg",
    "label": "A horn call in the middle of the hall",
    "position": [0, 280, -200],
    "distance": 150,
    "volume": 0.9,
}
ACOUSTICS = {"on": True, "position": [0, 270, 250], "material": "wood", "floor": "pews"}


def note(t, start, length, f0, rise=0.0):
    """One blast: a slightly rising, buzzing horn tone."""
    local = t - start
    inside = (local >= 0) & (local < length)
    local = np.clip(local, 0, length)
    attack = np.minimum(local / 0.04, 1)
    release = np.clip((length - local) / 0.06, 0, 1)
    pitch = f0 * (1 + rise * np.minimum(local / 0.25, 1)) * (1 + 0.006 * np.sin(2 * np.pi * 5.5 * local))
    phase = 2 * np.pi * np.cumsum(pitch) / RATE
    tone = sum(np.sin(k * phase) * (0.9 ** k) / (1 + 0.15 * k) for k in range(1, 12))
    return np.where(inside, tone * attack * release, 0)


def shofar():
    t = np.arange(int(SECONDS * RATE)) / RATE
    out = note(t, 0.2, 2.6, 330, 0.12)
    for i in range(3):
        out += note(t, 4.4 + i * 0.55, 0.42, 300, 0.2)
    for i in range(9):
        out += note(t, 7.9 + i * 0.16, 0.1, 330, 0.08)
    out += note(t, 10.4, 1.9, 330, 0.15)
    return out


def write_wav(path, signal, peak=0.85):
    signal = signal / np.max(np.abs(signal)) * peak
    with wave.open(str(path), "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(RATE)
        out.writeframes((signal * 32767).astype("<i2").tobytes())


def manifest():
    out = copy.deepcopy(json.loads(BASE.read_text(encoding="utf-8")))
    out["label"] = {
        "en": ["Wolpa Synagogue - the prayer hall heard: room acoustics from the model (AIM3D, localhost)"],
        "pl": ["Synagoga w Wołpie - jak brzmi sala modlitw: akustyka wnętrza z modelu (AIM3D, localhost)"],
        "de": ["Synagoge Wolpa - der Gebetssaal gehört: Raumakustik aus dem Modell (AIM3D, localhost)"],
    }
    out["summary"] = {
        "en": ["A horn call in the middle of the prayer hall, heard a few meters away with the hall's reverberation, worked out from the model's geometry: wooden walls, benches on the floor. Press the sounds' play button, or click the scene."],
        "pl": ["Głos rogu pośrodku sali modlitw, słyszany kilka metrów dalej z pogłosem sali obliczonym z geometrii modelu: drewniane ściany, ławki na posadzce. Naciśnij przycisk odtwarzania dźwięków albo kliknij scenę."],
        "de": ["Ein Hornruf in der Mitte des Gebetssaals, einige Meter entfernt gehört, mit dem Nachhall des Saals, aus der Geometrie des Modells berechnet: Holzwände, Bänke auf dem Boden. Die Wiedergabe der Klänge starten oder in die Szene klicken."],
    }
    aim3d = out["AIM3DViewer"]
    aim3d.pop("measurements", None)
    aim3d["sounds"] = {"autoplay": True, "sources": [SOURCE], "acoustics": ACOUSTICS}
    return out


def main():
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise SystemExit("ffmpeg is needed (with libvorbis)")
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "shofar.wav"
        write_wav(wav, shofar())
        subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", str(wav), "-map_metadata", "-1",
                        "-c:a", "libvorbis", "-q:a", "3", str(SOUND)], check=True)
    print(f"wrote {SOUND}")
    OUT.write_text(json.dumps(manifest(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
