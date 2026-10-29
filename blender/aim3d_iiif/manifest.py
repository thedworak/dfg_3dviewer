# Reading the parts of a IIIF Presentation 4 manifest the add-on maps to
# Blender objects. Plain JSON, no bpy.

import copy
import json
import os
import urllib.parse
import urllib.request

CAMERA_TYPES = {"PerspectiveCamera", "OrthographicCamera"}
LIGHT_TYPES = {"AmbientLight", "DirectionalLight", "PointLight", "SpotLight"}
MODEL_EXTENSIONS = {".glb", ".gltf", ".obj", ".stl", ".ply", ".fbx"}


def is_url(value):
    return isinstance(value, str) and value.split(":", 1)[0].lower() in ("http", "https")


def load(source):
    if is_url(source):
        with urllib.request.urlopen(source, timeout=60) as response:
            return json.loads(response.read().decode("utf-8"))
    with open(source, encoding="utf-8") as handle:
        return json.load(handle)


def dump(manifest, path):
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(manifest, handle, indent=2, ensure_ascii=False)
        handle.write("\n")


def type_of(value):
    return value.get("type") if isinstance(value, dict) else None


def as_list(value):
    if value is None:
        return []
    return value if isinstance(value, list) else [value]


def first_scene(manifest):
    return next((item for item in as_list(manifest.get("items")) if type_of(item) == "Scene"), None)


def scene_count(manifest):
    return sum(1 for item in as_list(manifest.get("items")) if type_of(item) == "Scene")


def painting_annotations(scene):
    for page in as_list(scene.get("items")):
        if not isinstance(page, dict):
            continue
        for annotation in as_list(page.get("items")):
            if isinstance(annotation, dict):
                yield page, annotation


def comment_annotations(scene):
    for page in as_list(scene.get("annotations")):
        if not isinstance(page, dict):
            continue
        for annotation in as_list(page.get("items")):
            if isinstance(annotation, dict):
                yield page, annotation


def unwrap(body):
    """(wrapper, resource): the body, or the source of the SpecificResource
    wrapping it."""
    body = as_list(body)[0] if as_list(body) else None
    if type_of(body) == "SpecificResource" and isinstance(body.get("source"), dict):
        return body, body["source"]
    return None, body


def is_model(resource):
    if not isinstance(resource, dict):
        return False
    if type_of(resource) == "Model":
        return True
    return str(resource.get("format", "")).startswith("model/")


def point_of(selector_holder):
    """The PointSelector of a target (or a lookAt) as [x, y, z], or None."""
    if not isinstance(selector_holder, dict):
        return None
    if type_of(selector_holder) == "PointSelector":
        selector = selector_holder
    else:
        selector = next(
            (item for item in as_list(selector_holder.get("selector")) if type_of(item) == "PointSelector"),
            None,
        )
    if selector is None:
        return None
    try:
        return [float(selector.get(key, 0) or 0) for key in ("x", "y", "z")]
    except (TypeError, ValueError):
        return None


def point_selector(point):
    return {"type": "PointSelector", "x": point[0], "y": point[1], "z": point[2]}


def scene_target(scene_id, point):
    return {
        "type": "SpecificResource",
        "source": {"id": scene_id, "type": "Scene"},
        "selector": [point_selector(point)],
    }


def first_text(language_map):
    if isinstance(language_map, str):
        return language_map
    if isinstance(language_map, dict):
        for values in language_map.values():
            values = as_list(values)
            if values:
                return str(values[0])
    return ""


def set_first_text(language_map, text):
    if isinstance(language_map, dict) and language_map:
        language = next(iter(language_map))
        updated = dict(language_map)
        updated[language] = [text]
        return updated
    return {"en": [text]}


def body_text(body):
    for item in as_list(body):
        if type_of(item) == "TextualBody":
            return str(item.get("value", ""))
        if type_of(item) == "Choice":
            return body_text(item.get("items"))
    return ""


def set_body_text(body, text):
    """The body with its (first) TextualBody's value replaced."""
    if body is None:
        return {"type": "TextualBody", "value": text, "format": "text/plain"}
    body = copy.deepcopy(body)
    for item in as_list(body):
        if type_of(item) == "TextualBody":
            item["value"] = text
            return body
        if type_of(item) == "Choice":
            item["items"] = set_body_text(item.get("items"), text)
            return body
    return body


def intensity_of(resource, default=1.0):
    value = resource.get("intensity")
    if isinstance(value, dict):
        value = value.get("quantityValue", value.get("value"))
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def set_intensity(resource, value):
    """Keeps the form the manifest uses: a Quantity or a plain number."""
    current = resource.get("intensity")
    if isinstance(current, dict):
        current = dict(current)
        current["quantityValue"] = value
        resource["intensity"] = current
    elif current is None:
        resource["intensity"] = {"type": "Quantity", "quantityValue": value, "unit": "relative"}
    else:
        resource["intensity"] = value


def resolve_model_url(url, manifest_source, model_base=""):
    """Candidates for a model's file: an absolute URL as it is; a relative one
    against the base given, the manifest's folder and its parents (the
    examples resolve against the viewer's root)."""
    if is_url(url) or os.path.isabs(url):
        return [url]
    candidates = []
    bases = []
    if model_base:
        bases.append(model_base)
    if manifest_source:
        if is_url(manifest_source):
            bases.append(urllib.parse.urljoin(manifest_source, "."))
        else:
            folder = os.path.dirname(os.path.abspath(manifest_source))
            for _level in range(5):
                bases.append(folder)
                parent = os.path.dirname(folder)
                if parent == folder:
                    break
                folder = parent
    for base in bases:
        if is_url(base):
            candidates.append(urllib.parse.urljoin(base.rstrip("/") + "/", url))
        else:
            candidates.append(os.path.normpath(os.path.join(base, url)))
    return candidates


def fetch_model(url, manifest_source, model_base, cache_folder):
    """A local path of the model file, downloading it when it is remote.
    None when no candidate exists."""
    for candidate in resolve_model_url(url, manifest_source, model_base):
        if is_url(candidate):
            name = os.path.basename(urllib.parse.urlparse(candidate).path) or "model.glb"
            os.makedirs(cache_folder, exist_ok=True)
            target = os.path.join(cache_folder, name)
            try:
                urllib.request.urlretrieve(candidate, target)
            except OSError:
                continue
            return target
        if os.path.isfile(candidate):
            return candidate
    return None


def model_extension(url, resource=None):
    path = urllib.parse.urlparse(url).path if is_url(url) else url
    extension = os.path.splitext(path)[1].lower()
    if extension in MODEL_EXTENSIONS:
        return extension
    media = str((resource or {}).get("format", ""))
    return {"model/gltf-binary": ".glb", "model/gltf+json": ".gltf", "model/obj": ".obj",
            "model/stl": ".stl", "model/ply": ".ply"}.get(media, extension)
