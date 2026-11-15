#!/usr/bin/env python3
"""Write the example manifests of the viewer's sounds and 2D images
(viewer/manifesto/examples/), each showing one of the example files with
settings that show what the tools are for:

    images-aim3d-inscription-relief.json   the worn inscription in relief
    images-aim3d-rock-art-dstretch.json    the faded rock art, decorrelation
                                           stretch against the original
    images-aim3d-manuscript-equalize.json  the faded page, equalised
    sounds-aim3d-bird-call.json            the soundscape: the bird call in a
                                           loop, in a church's reverberation
    sounds-aim3d-low-pass.json             the soundscape seen on a linear
                                           axis, heard through a low-pass

The scene shows the file itself: a painting annotation with an Image or
Sound body. The files come from scripts/generate-image-samples.py and
scripts/generate-audio-samples.py.

Usage: python3 scripts/build-media-manifests.py
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "viewer" / "manifesto" / "examples"
VERSION = "1.3"
GENERATED = "2026-11-11T00:00:00.000Z"
RIGHTS = "http://creativecommons.org/publicdomain/zero/1.0/"

FORMATS = {".png": "image/png", ".jpg": "image/jpeg", ".wav": "audio/wav", ".ogg": "audio/ogg"}

MANIFESTS = [
    ("images-aim3d-inscription-relief.json", "./examples/images/inscription.png", "Image",
     "Worn inscription in relief (2D image)", {"image": {"relief": 0.85, "reliefAngle": 120, "sharpen": 0.4}}),
    ("images-aim3d-rock-art-dstretch.json", "./examples/images/rock-art.jpg", "Image",
     "Faded rock art, decorrelation stretch against the original (2D image)", {"image": {"dstretch": True, "compare": True, "split": 0.35}}),
    ("images-aim3d-manuscript-equalize.json", "./examples/images/manuscript.jpg", "Image",
     "Faded manuscript, equalised (2D image)", {"image": {"equalize": True, "channel": "luminance", "contrast": 1.2}}),
    ("sounds-aim3d-bird-call.json", "./examples/audio/soundscape.wav", "Sound",
     "Soundscape: the bird call in a loop, in a church (audio)",
     {"audio": {"range": 70, "playback": {"loop": True, "region": {"start": 2.9, "end": 4.6}, "reverb": "church", "reverbMix": 0.45}}}),
    ("sounds-aim3d-low-pass.json", "./examples/audio/soundscape.ogg", "Sound",
     "Soundscape: a linear frequency axis, through a low-pass filter (audio)",
     {"audio": {"frequencyScale": "linear", "heightScale": 0.6, "playback": {"filter": {"type": "lowpass", "frequency": 700, "q": 1}}}}),
]


def manifest(url, kind, label, block):
    scene = f"{url}/scene"
    body = {"id": url, "type": kind}
    media = FORMATS.get(Path(url).suffix)
    if media:
        body["format"] = media
    return {
        "@context": "http://iiif.io/api/presentation/4/context.json",
        "id": f"{url}/manifest.json",
        "type": "Manifest",
        "label": {"en": [label]},
        "rights": RIGHTS,
        "items": [{
            "id": scene,
            "type": "Scene",
            "label": {"en": [Path(url).stem]},
            "items": [{
                "id": f"{scene}/page/model",
                "type": "AnnotationPage",
                "items": [{
                    "id": f"{scene}/annotation/model",
                    "type": "Annotation",
                    "motivation": ["painting"],
                    "body": body,
                    "target": {"id": scene, "type": "Scene"},
                }],
            }],
            "annotations": [{"id": f"{scene}/page/annotations", "type": "AnnotationPage", "items": []}],
        }],
        "AIM3DViewer": {"version": VERSION, "generatedAt": GENERATED, **block},
    }


def main():
    for name, url, kind, label, block in MANIFESTS:
        path = OUT / name
        path.write_text(json.dumps(manifest(url, kind, label, block), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
