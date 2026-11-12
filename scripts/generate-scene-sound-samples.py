#!/usr/bin/env python3
"""Generate the Tempietto's sounds and the manifest that places them
(viewer/editor/scene-sounds.js, viewer/editor/narration.js). All of it is
synthesised here - no recording of anyone or anything - so it can be shared
freely.

    viewer/examples/tempietto/sound/
      wind.ogg            ambient: wind in gusts and a few birds (20 s, loops)
      bell.ogg            a point source on the roof: a bell struck every 8 s
      hum.ogg             a spot source in the cella, aimed out of the door:
                          a low chord (12 s, loops)
      narration-01..03.ogg / .vtt
                          narrations of three of the tour's annotations,
                          spoken by ffmpeg's flite voice, with WebVTT captions
                          timed sentence by sentence

    viewer/manifesto/examples/tempietto-aim3d-sound.json
                          the guided tour manifest (tempietto-aim3d-tour.json)
                          with those sounds (AIM3DViewer.sounds and IIIF
                          Presentation 4 AmbientAudio / PointAudio / SpotAudio
                          annotations) and the narrations on its annotations

Needs numpy and ffmpeg with libvorbis and flite (Ubuntu's ffmpeg has both).
The sounds are deterministic (fixed seeds); the Ogg stream serial numbers
are ffmpeg's own.

Usage: python3 scripts/generate-scene-sound-samples.py
"""

import json
import shutil
import subprocess
import tempfile
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SOUND_DIR = ROOT / "viewer" / "examples" / "tempietto" / "sound"
MANIFEST_DIR = ROOT / "viewer" / "manifesto" / "examples"
RATE = 22050
URL = "./examples/tempietto/sound"

# The tour's annotations told, sentence by sentence (captions per sentence).
NARRATIONS = {
    "tour-01-podium": [
        "The temple stands on a raised podium of stone blocks.",
        "Three steps lead up to it at the front.",
        "The podium lifts the cella above the ground, and gives this small building its monumental presence.",
    ],
    "tour-02-colonnade": [
        "Four columns carry the entablature of the portico.",
        "Only the lower drums of the fourth column survive.",
        "Its upper part is a reconstruction, based on the three complete columns.",
    ],
    "tour-06-roof": [
        "Nothing of the roof has survived.",
        "The gabled roof and its pediments follow comparable temples.",
        "It is a hypothesis, and the Level of Certainty view marks it as such.",
    ],
}

SOURCES = [
    {"id": "wind", "type": "ambient", "src": f"{URL}/wind.ogg", "label": "Wind and birds", "volume": 0.45},
    {"id": "bell", "type": "point", "src": f"{URL}/bell.ogg", "label": "Bell on the roof", "position": [0, 4.6, 0.6], "distance": 2.5, "volume": 0.8},
    {"id": "hum", "type": "spot", "src": f"{URL}/hum.ogg", "label": "Hum from the cella", "position": [0, 1.6, -0.9], "lookAt": [0, 1.4, 8], "angle": 70, "distance": 1.5, "volume": 0.7},
]


def loop_crossfade(signal, seconds):
    """The end faded into the start, so the file loops without a click."""
    n = int(seconds * RATE)
    head, body, tail = signal[:n], signal[n:-n], signal[-n:]
    ramp = np.linspace(0, 1, n)
    return np.concatenate([body, tail * (1 - ramp) + head * ramp])


def wind(rng):
    t = np.arange(int(22 * RATE)) / RATE
    noise = rng.standard_normal(t.size)
    smooth = np.convolve(noise, np.ones(60) / 60, mode="same")
    gusts = 0.55 + 0.45 * np.sin(2 * np.pi * t / 7.3) * np.sin(2 * np.pi * t / 3.1 + 1)
    out = smooth * gusts * 2.2
    for start in (2.0, 2.4, 9.1, 9.35, 9.6, 15.2, 15.5):
        local = t - start
        window = np.where((local >= 0) & (local < 0.12), np.sin(np.pi * np.clip(local, 0, 0.12) / 0.12) ** 2, 0)
        out += 0.12 * window * np.sin(2 * np.pi * (3200 * local + 9000 * local ** 2))
    return loop_crossfade(out, 2.0)


def bell():
    t = np.arange(int(8 * RATE)) / RATE
    out = np.zeros_like(t)
    for i, ratio in enumerate([0.5, 1.0, 1.19, 1.5, 2.0, 2.52, 3.0, 4.07]):
        decay = 3.2 / (1 + i * 0.45)
        out += np.minimum(t / 0.004, 1) * np.exp(-t / decay) * np.sin(2 * np.pi * 349.2 * ratio * t) / (1 + i * 0.6)
    # Silent at the end, so it loops as one strike every 8 s.
    return out * np.clip((8 - t) / 1.5, 0, 1)


def hum():
    t = np.arange(int(14 * RATE)) / RATE
    out = np.zeros_like(t)
    for base in (110.0, 164.81, 220.0):
        for harmonic in range(1, 6):
            out += np.sin(2 * np.pi * base * harmonic * t + harmonic) / harmonic ** 1.8
    out *= 0.8 + 0.2 * np.sin(2 * np.pi * t / 5)
    return loop_crossfade(out, 2.0)


def write_wav(path, signal, peak=0.85):
    signal = signal / np.max(np.abs(signal)) * peak
    with wave.open(str(path), "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(RATE)
        out.writeframes((signal * 32767).astype("<i2").tobytes())


def to_ogg(ffmpeg, wav, ogg, quality="2"):
    subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", str(wav), "-map_metadata", "-1",
                    "-c:a", "libvorbis", "-q:a", quality, str(ogg)], check=True)


def speak(ffmpeg, text, wav, work):
    text_file = work / "line.txt"
    text_file.write_text(text, encoding="utf-8")
    subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi",
                    "-i", f"flite=textfile={text_file}:voice=slt", "-ar", str(RATE), "-ac", "1", str(wav)], check=True)
    with wave.open(str(wav)) as clip:
        frames = np.frombuffer(clip.readframes(clip.getnframes()), dtype="<i2").astype(np.float32) / 32768
        rate = clip.getframerate()
    assert rate == RATE
    return frames


def vtt_time(seconds):
    hours, rest = divmod(seconds, 3600)
    minutes, secs = divmod(rest, 60)
    return f"{int(hours):02d}:{int(minutes):02d}:{secs:06.3f}"


def narration(ffmpeg, key, sentences, work):
    gap = np.zeros(int(0.45 * RATE), dtype=np.float32)
    parts, cues, at = [], [], 0.3
    parts.append(np.zeros(int(0.3 * RATE), dtype=np.float32))
    for sentence in sentences:
        voice = speak(ffmpeg, sentence, work / "line.wav", work)
        cues.append((at, at + voice.size / RATE, sentence))
        parts += [voice, gap]
        at += (voice.size + gap.size) / RATE
    wav = work / f"{key}.wav"
    write_wav(wav, np.concatenate(parts), peak=0.9)
    return wav, "WEBVTT\n\n" + "\n\n".join(f"{vtt_time(a)} --> {vtt_time(b)}\n{text}" for a, b, text in cues) + "\n"


def manifest():
    base = json.loads((MANIFEST_DIR / "tempietto-aim3d-tour.json").read_text(encoding="utf-8"))
    out = json.loads(json.dumps(base))
    out["id"] = base["id"].replace("manifest-tour.json", "manifest-sound.json")
    out["label"] = {"en": ["Tempietto - sounds in the scene and a narrated tour (AIM3D, localhost)"]}
    scene = out["items"][0]
    scene_id = scene["id"]
    narrated = []
    for annotation in scene["annotations"][0]["items"]:
        key = annotation["id"].split("/")[-1]
        if key not in NARRATIONS:
            continue
        index = list(NARRATIONS).index(key) + 1
        audio = {"src": f"{URL}/narration-{index:02d}.ogg", "captions": f"{URL}/narration-{index:02d}.vtt"}
        annotation["AIM3DViewer"]["audio"] = audio
        annotation["body"] = [annotation["body"], {"id": audio["src"], "type": "Sound"}]
        narrated.append(key)
    # Other viewers: the sources as IIIF audio emitters painted into the scene.
    painting = scene["items"][0]["items"]
    for index, source in enumerate(SOURCES, start=1):
        body = {
            "type": {"ambient": "AmbientAudio", "point": "PointAudio", "spot": "SpotAudio"}[source["type"]],
            "label": {"none": [source["label"]]},
            "source": {"id": source["src"], "type": "Audio"},
            "volume": {"type": "Quantity", "quantityValue": source.get("volume", 1), "unit": "relative"},
            "timeMode": "loop",
        }
        if source["type"] == "spot":
            x, y, z = source["lookAt"]
            body["lookAt"] = {"type": "PointSelector", "x": x, "y": y, "z": z}
            body["angle"] = source["angle"]
        target = {"id": scene_id, "type": "Scene"}
        if source["type"] != "ambient":
            x, y, z = source["position"]
            target = {"type": "SpecificResource", "source": {"id": scene_id, "type": "Scene"},
                      "selector": [{"type": "PointSelector", "x": x, "y": y, "z": z}]}
        painting.append({"id": f"{scene_id}/annotation/sound/{index}", "type": "Annotation",
                         "motivation": ["painting"], "body": body, "target": target})
    aim3d = out["AIM3DViewer"]
    # The tour is played with a click (sound needs one), not by itself.
    aim3d["viewer"]["tour"] = {**aim3d["viewer"].get("tour", {}), "autostart": True, "autoplay": False}
    aim3d["sounds"] = {"autoplay": True, "sources": SOURCES}
    return out, narrated


def main():
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise SystemExit("ffmpeg is needed (with libvorbis and flite)")
    SOUND_DIR.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(11)
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp)
        for name, signal in (("wind", wind(rng)), ("bell", bell()), ("hum", hum())):
            wav = work / f"{name}.wav"
            write_wav(wav, signal)
            to_ogg(ffmpeg, wav, SOUND_DIR / f"{name}.ogg")
            print(f"wrote {SOUND_DIR / name}.ogg")
        for index, (key, sentences) in enumerate(NARRATIONS.items(), start=1):
            wav, vtt = narration(ffmpeg, key, sentences, work)
            to_ogg(ffmpeg, wav, SOUND_DIR / f"narration-{index:02d}.ogg", quality="1")
            (SOUND_DIR / f"narration-{index:02d}.vtt").write_text(vtt, encoding="utf-8")
            print(f"wrote {SOUND_DIR}/narration-{index:02d}.ogg / .vtt")
    out, narrated = manifest()
    path = MANIFEST_DIR / "tempietto-aim3d-sound.json"
    path.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {path} (narrated: {', '.join(narrated)})")


if __name__ == "__main__":
    main()
