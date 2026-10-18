"""AI assistance for the viewer (Claude API) - optional, off by default.

Three features, each one request to Claude with a structured (JSON schema)
answer; the viewer shows the answer, the worker never acts on it:

  validation  explain a model's validation.json (validate.py) in plain
              language, with what to fix first
              POST /api/ai/validation/<job id>   {lang}
  ifc-query   turn a question about an IFC model ("load-bearing walls on
              level 2") into a filter over its properties; the viewer runs
              the filter itself (viewer/ai/ifc-query.js), so counts and
              sums are computed, never made up
              POST /api/ai/ifc-query   {question, schema, lang, selection?}
  variants    compare reconstruction variants (viewer/editor/compare.js)
              and review their paradata (sources, Level of Certainty)
              POST /api/ai/variants    {variants, label, description, lang}

plus GET /api/ai/config -> {enabled, features, model} for the viewer to know
what to offer.

What is sent to Claude: the validation report, the names/types and a few
sample values of the IFC properties, the variants' texts and numbers. Never
the model files, textures or the full property data.

Configuration (environment):
  WORKER_AI_ENABLED           true | false (default) - nothing is offered
                              without it, even with a key
  ANTHROPIC_API_KEY           the Claude API key (or any credential the
                              Anthropic SDK resolves, e.g. ANTHROPIC_AUTH_TOKEN)
  WORKER_AI_MODEL             default claude-opus-5-5
  WORKER_AI_FEATURES          comma-separated subset of
                              validation,ifc-query,variants (default: all)
  WORKER_AI_ACCESS            who may use it: business (default: the
                              Business and Enterprise plans - accounts, and
                              the app's Business subscribers) | users (logged
                              in) | all | admin
  WORKER_AI_REQUESTS_PER_HOUR per caller (account, else IP); default 30, 0 = unlimited
  WORKER_AI_TIMEOUT           seconds per request (default 120)
  WORKER_AI_FALLBACKS         true (default) | false - server-side refusal
                              fallback (beta server-side-fallback-2026-07-01)

Requires the `anthropic` package (pip install anthropic); without it the
features report themselves as unavailable.
"""

import hashlib
import json
import os
import sys
import threading
import time
from collections import OrderedDict

try:
    import anthropic
except ImportError:  # the worker runs without AI then
    anthropic = None

FEATURES = ("validation", "ifc-query", "variants")
ACCESS_LEVELS = ("all", "users", "business", "admin")
DEFAULT_MODEL = "claude-opus-5-5"
HOUR = 3600
# Largest request body accepted by the AI endpoints (an IFC schema summary).
MAX_BODY_BYTES = 512 * 1024
MAX_QUESTION_CHARS = 500
LANGUAGES = {"en": "English", "pl": "Polish", "de": "German"}
FALLBACK_BETA = "server-side-fallback-2026-07-01"


class AIError(Exception):
    def __init__(self, status: int, message: str, code: str = "ai_error"):
        super().__init__(message)
        self.status = status
        self.message = message
        self.code = code

    def payload(self) -> dict:
        return {"error": self.message, "code": self.code}


def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name, "").strip().lower()
    if raw == "":
        return default
    return raw in ("1", "true", "yes", "on")


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name, "").strip()
    try:
        return max(0, int(raw)) if raw else default
    except ValueError:
        return default


def model() -> str:
    return os.environ.get("WORKER_AI_MODEL", "").strip() or DEFAULT_MODEL


def enabled_features() -> list:
    raw = os.environ.get("WORKER_AI_FEATURES", "").strip()
    if not raw:
        return list(FEATURES)
    wanted = {part.strip() for part in raw.split(",")}
    return [feature for feature in FEATURES if feature in wanted]


def access_level() -> str:
    value = os.environ.get("WORKER_AI_ACCESS", "business").strip().lower()
    return value if value in ACCESS_LEVELS else "business"


def enabled() -> bool:
    return anthropic is not None and _env_bool("WORKER_AI_ENABLED", False)


def allowed(user, is_business: bool) -> bool:
    """Whether this caller may use the AI features (WORKER_AI_ACCESS).
    is_business: the account has the Business or Enterprise plan, or the
    app user sending X-App-User-Id subscribes to Business (no account)."""
    level = access_level()
    if level == "all":
        return True
    if user and user.get("role") == "admin":
        return True
    if level == "business":
        return is_business
    if level == "users":
        return bool(user)
    return False


def config(user=None, is_business: bool = False) -> dict:
    """GET /api/ai/config: what the viewer may offer to this caller."""
    on = enabled()
    permitted = on and allowed(user, is_business)
    return {
        "enabled": permitted,
        # Switched on, but not for this caller: the viewer can say why.
        "restricted": on and not permitted,
        "access": access_level() if on else None,
        # Also when restricted: the app shows those tools with a lock.
        "features": enabled_features() if on else [],
        "model": model() if permitted else None,
    }


def language_name(lang) -> str:
    return LANGUAGES.get(str(lang or "en").lower()[:2], "English")


# ---- rate limit and answer cache -------------------------------------------


class RateLimiter:
    """Requests per caller key in a rolling hour, in memory (a restart
    resets it - the API key's own limits still apply)."""

    def __init__(self):
        self.lock = threading.Lock()
        self.log = {}

    def check(self, key: str, now: float = None) -> None:
        limit = _env_int("WORKER_AI_REQUESTS_PER_HOUR", 30)
        if limit <= 0:
            return
        now = time.time() if now is None else now
        with self.lock:
            recent = [stamp for stamp in self.log.get(key, []) if stamp > now - HOUR]
            if len(recent) >= limit:
                retry = int(recent[0] + HOUR - now) + 1
                self.log[key] = recent
                error = AIError(429, f"AI request limit reached ({limit} per hour).", "ai_rate_limited")
                error.retry_after = retry
                raise error
            recent.append(now)
            self.log[key] = recent


class AnswerCache:
    """The last answers by request, so asking the same again costs nothing."""

    def __init__(self, size: int = 256):
        self.size = size
        self.lock = threading.Lock()
        self.items = OrderedDict()

    @staticmethod
    def key(*parts) -> str:
        text = json.dumps(parts, sort_keys=True, ensure_ascii=False, default=str)
        return hashlib.sha256(text.encode("utf-8")).hexdigest()

    def get(self, key: str):
        with self.lock:
            if key not in self.items:
                return None
            self.items.move_to_end(key)
            return self.items[key]

    def put(self, key: str, value) -> None:
        with self.lock:
            self.items[key] = value
            self.items.move_to_end(key)
            while len(self.items) > self.size:
                self.items.popitem(last=False)


RATE_LIMITER = RateLimiter()
CACHE = AnswerCache()


# ---- the Claude call -------------------------------------------------------

_client = None
_client_lock = threading.Lock()


def api_key():
    """ANTHROPIC_API_KEY without what an .env file can leave around it: a
    Windows line end, spaces, quotes kept by an env_file. None = let the SDK
    resolve its other credentials."""
    key = os.environ.get("ANTHROPIC_API_KEY", "").strip().strip("\"'").strip()
    return key or None


def client():
    global _client
    with _client_lock:
        if _client is None:
            # One attempt within WORKER_AI_TIMEOUT: retries would outlast the
            # proxies in front of the worker (docker/nginx.conf, Cloudflare's
            # 100 s), which then answer the viewer with an HTML 504.
            options = {"timeout": float(_env_int("WORKER_AI_TIMEOUT", 90)), "max_retries": 0}
            if api_key():
                options["api_key"] = api_key()
            _client = anthropic.Anthropic(**options)
        return _client


def set_client(value) -> None:
    """Tests: replace the SDK client by a stand-in."""
    global _client
    with _client_lock:
        _client = value


def ask(system: str, prompt: str, schema: dict, effort: str = "medium", max_tokens: int = 16000) -> dict:
    """One request; returns the answer parsed from the schema's JSON."""
    if not enabled():
        raise AIError(404, "AI features are not enabled on this server.", "ai_disabled")
    cache_key = CACHE.key(model(), system, prompt, schema, effort)
    cached = CACHE.get(cache_key)
    if cached is not None:
        return cached

    params = {
        "model": model(),
        "max_tokens": max_tokens,
        "system": system,
        "messages": [{"role": "user", "content": prompt}],
        "output_config": {"effort": effort, "format": {"type": "json_schema", "schema": schema}},
    }
    if _env_bool("WORKER_AI_FALLBACKS", True):
        params["betas"] = [FALLBACK_BETA]
        params["fallbacks"] = "default"
    # 503, never 502/504: Cloudflare replaces an origin's 502 and 504 with
    # its own HTML page, and the viewer would lose the message below.
    try:
        response = client().beta.messages.create(**params)
    except anthropic.AuthenticationError:
        raise AIError(503, "The AI service rejected the server's credentials.", "ai_auth")
    except anthropic.PermissionDeniedError:
        raise AIError(503, "The server's AI account may not use this model.", "ai_permission")
    except anthropic.RateLimitError:
        raise AIError(503, "The AI service is busy. Try again in a minute.", "ai_busy")
    except anthropic.BadRequestError as exc:
        raise AIError(503, f"The AI service did not accept the request: {exc.message}", "ai_bad_request")
    except anthropic.APIStatusError as exc:
        raise AIError(503, f"The AI service failed ({exc.status_code}).", "ai_upstream")
    except anthropic.APITimeoutError:
        raise AIError(503, "The AI answer took too long. Try again or ask a narrower question.", "ai_timeout")
    except anthropic.APIConnectionError as exc:
        # The cause (DNS, TLS, refused connection, proxy) is what an admin needs.
        cause = exc.__cause__ or exc
        print(f"[ai] connection to the Claude API failed: {cause!r}", file=sys.stderr)
        raise AIError(503, f"The AI service could not be reached ({type(cause).__name__}).", "ai_unreachable")

    if response.stop_reason == "refusal":
        raise AIError(422, "The AI declined to answer this request.", "ai_refusal")
    if response.stop_reason == "max_tokens":
        raise AIError(503, "The AI answer was too long and got cut off.", "ai_truncated")
    text = "".join(block.text for block in response.content if getattr(block, "type", "") == "text")
    try:
        answer = json.loads(text)
    except ValueError:
        raise AIError(503, "The AI answer could not be read.", "ai_invalid")
    if not isinstance(answer, dict):
        raise AIError(503, "The AI answer could not be read.", "ai_invalid")
    CACHE.put(cache_key, answer)
    return answer


def _nullable(schema: dict) -> dict:
    return {"anyOf": [schema, {"type": "null"}]}


def _object(properties: dict) -> dict:
    return {
        "type": "object",
        "properties": properties,
        "required": list(properties),
        "additionalProperties": False,
    }


def _compact(value) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), default=str)


# ---- 1. validation report --------------------------------------------------

VALIDATION_SCHEMA = _object({
    "headline": {"type": "string", "description": "One sentence: can the model be published as it is?"},
    "summary": {"type": "string", "description": "Two to four sentences on the model's state."},
    "findings": {
        "type": "array",
        "items": _object({
            "level": {"type": "string", "enum": ["error", "warning", "info"]},
            "title": {"type": "string"},
            "explanation": {"type": "string", "description": "What it means for viewers of the model."},
            "fix": {"type": "string", "description": "What to do about it, concretely."},
            "codes": {"type": "array", "items": {"type": "string"}, "description": "Issue codes/check ids this covers."},
        }),
    },
})

VALIDATION_SYSTEM = """You help people who publish 3D models (cultural heritage, architecture, archaeology) in a web viewer understand the automatic check of their model file.

You get the worker's validation report: the Khronos glTF-Validator issues grouped by code, statistics (triangles, vertices, materials, texture sizes), the bounding box in metres and the worker's own heuristic checks.

Explain it to a curator who is not a 3D graphics expert:
- Lead with whether the model can be published as it is.
- Group related issues into findings, most important first; skip issues that do not matter to anyone viewing the model, and say so in the summary when you skip many.
- For each finding say what it means in practice (does it fail to load, look wrong, load slowly on phones?) and what to do, naming the tool step when it is obvious (e.g. re-export from Blender with "Apply transforms", reduce textures to 4096 px).
- Judge size and units from the bounding box: a building of 12 000 m was probably exported in millimetres.
- Use only what the report says. Do not invent issues or numbers.
- Answer in {language}."""


def _validation_digest(report: dict) -> dict:
    """The parts of validation.json worth sending (issue pointers are capped)."""
    validator = report.get("validator") or {}
    issues = []
    for group in (validator.get("issues") or [])[:60]:
        issues.append({
            "code": group.get("code"),
            "level": group.get("level"),
            "count": group.get("count"),
            "message": group.get("message"),
            "pointers": (group.get("pointers") or [])[:3],
        })
    return {
        "status": report.get("status"),
        "file": report.get("file"),
        "validatorVersion": validator.get("version"),
        "validatorFailed": validator.get("failed"),
        "issues": issues,
        "stats": report.get("stats"),
        "bounds": report.get("bounds"),
        "checks": report.get("checks"),
    }


def explain_validation(report: dict, lang: str = "en") -> dict:
    if "validation" not in enabled_features():
        raise AIError(404, "This AI feature is not enabled.", "ai_feature_disabled")
    if not isinstance(report, dict):
        raise AIError(404, "This model has no validation report.", "no_report")
    prompt = "Validation report (JSON):\n" + _compact(_validation_digest(report))
    answer = ask(VALIDATION_SYSTEM.replace("{language}", language_name(lang)), prompt, VALIDATION_SCHEMA, effort="low")
    answer["model"] = model()
    return answer


# ---- 2. IFC query ----------------------------------------------------------

IFC_FIELDS = ["type", "name", "description", "objectType", "predefinedType", "tag", "material", "typeName", "storey", "property"]
IFC_OPS = ["eq", "ne", "contains", "gt", "gte", "lt", "lte", "exists", "missing", "true", "false"]

IFC_CONDITION = _object({
    "field": {"type": "string", "enum": IFC_FIELDS},
    "pset": _nullable({"type": "string"}),
    "property": _nullable({"type": "string"}),
    "op": {"type": "string", "enum": IFC_OPS},
    "value": _nullable({"type": "string"}),
})

IFC_SCHEMA = _object({
    "understood": {"type": "boolean", "description": "False when the question cannot be answered from these properties."},
    "interpretation": {"type": "string", "description": "The question restated as the filter does it, one sentence."},
    "match": {"type": "string", "enum": ["all", "any"]},
    "conditions": {"type": "array", "items": IFC_CONDITION},
    "aggregate": _object({
        "kind": {"type": "string", "enum": ["none", "count", "sum", "average", "min", "max"]},
        "pset": _nullable({"type": "string"}),
        "property": _nullable({"type": "string"}),
        "unit": _nullable({"type": "string"}),
    }),
    "action": {"type": "string", "enum": ["highlight", "isolate", "hide"]},
    "note": _nullable({"type": "string", "description": "Caveats, e.g. a property the model lacks."}),
})

IFC_SYSTEM = """You translate questions about a building model (IFC) into a filter over its elements. You never answer with numbers yourself: the viewer runs the filter on the real data and computes counts and sums.

You get a summary of the model's data: the IFC classes with element counts, the storeys, the materials, and the property sets with their properties, value types and a few sample values.

Each element has the fields: type (IFC class, e.g. IfcWall), name, description, objectType, predefinedType, tag, material, typeName (its IFC type object's name), storey (name of the storey containing it) and properties in property sets (psets; quantities like Qto_WallBaseQuantities are psets too).

Build the filter:
- conditions: field + op + value. For field "property" give pset and property exactly as in the summary (pset may be null to look in any pset). For other fields pset and property are null.
- ops: eq/ne (case-insensitive text or number), contains (text), gt/gte/lt/lte (numbers), exists/missing (the property is there or not), true/false (boolean properties). value is a string; null for exists/missing/true/false.
- "type" matching: IfcWall also matches IfcWallStandardCase; use the class names from the summary.
- match "all" = every condition, "any" = at least one.
- aggregate: count when the user asks how many; sum/average/min/max of a numeric property (e.g. NetArea in Qto_..., for "how many m2"); else none. Give the unit if the summary shows it.
- action: "isolate" when the user wants to see only those elements, "hide" when they want them out of the way, else "highlight".
- Use only property sets, properties, classes and storeys present in the summary. If the question needs data the model does not have, set understood false and say in note what is missing; if you approximate (e.g. "load-bearing" through LoadBearing=true in Pset_WallCommon), say so in note.
- interpretation and note are in {language}; field names, psets and values are written exactly as in the data.
- A selected element may be given (the one the user picked in the viewer, with its own fields and properties). Then "this", "this element", "like this", "the same type", "on this storey" refer to it: build the conditions from its values (e.g. type and typeName for "elements like this", its storey for "on this storey"). The selection is only context: the filter still runs over all the elements."""

MAX_SELECTION_CHARS = 4000
SELECTION_FIELDS = ("guid", "type", "name", "description", "objectType", "predefinedType", "tag", "material", "typeName", "storey")


def _check_ifc_schema(schema) -> dict:
    if not isinstance(schema, dict) or not isinstance(schema.get("classes"), (dict, list)):
        raise AIError(400, "The model's IFC summary is missing.", "bad_request")
    return schema


def _ifc_selection(selection) -> dict | None:
    """The element picked in the viewer, as context for the question: its
    plain fields and (while the whole fits MAX_SELECTION_CHARS) its psets."""
    if not isinstance(selection, dict):
        return None
    plain = (str, int, float, bool)
    element = {
        key: selection[key] for key in SELECTION_FIELDS
        if isinstance(selection.get(key), plain) and str(selection[key]).strip()
    }
    psets = selection.get("psets")
    if isinstance(psets, dict):
        kept = {}
        for pset, props in psets.items():
            if not isinstance(props, dict):
                continue
            values = {str(k): v for k, v in props.items() if isinstance(v, plain)}
            if values and len(_compact({**element, "psets": {**kept, str(pset): values}})) <= MAX_SELECTION_CHARS:
                kept[str(pset)] = values
        if kept:
            element["psets"] = kept
    if not element or len(_compact(element)) > MAX_SELECTION_CHARS:
        return None
    return element


def ifc_query(question: str, schema: dict, lang: str = "en", selection: dict | None = None) -> dict:
    if "ifc-query" not in enabled_features():
        raise AIError(404, "This AI feature is not enabled.", "ai_feature_disabled")
    question = str(question or "").strip()
    if not question:
        raise AIError(400, "Ask a question.", "bad_request")
    if len(question) > MAX_QUESTION_CHARS:
        raise AIError(400, f"The question is too long (at most {MAX_QUESTION_CHARS} characters).", "bad_request")
    summary = _check_ifc_schema(schema)
    prompt = (
        "Model data summary (JSON):\n" + _compact(summary)
        + "\n\nQuestion:\n" + question
    )
    element = _ifc_selection(selection)
    if element:
        prompt += "\n\nSelected element (JSON):\n" + _compact(element)
    answer = ask(IFC_SYSTEM.replace("{language}", language_name(lang)), prompt, IFC_SCHEMA, effort="medium")
    answer["model"] = model()
    return answer


# ---- 3. reconstruction variants -------------------------------------------

VARIANTS_SCHEMA = _object({
    "summary": {"type": "string", "description": "How the variants differ, in two to five sentences."},
    "differences": {
        "type": "array",
        "items": _object({
            "aspect": {"type": "string", "description": "e.g. roof height, extent, sources, certainty"},
            "detail": {"type": "string"},
            "variants": {"type": "array", "items": {"type": "string"}, "description": "Variant ids concerned."},
        }),
    },
    "paradata": {
        "type": "array",
        "description": "One entry per variant: how well its hypothesis is documented.",
        "items": _object({
            "variant": {"type": "string"},
            "status": {"type": "string", "enum": ["ok", "incomplete", "inconsistent"]},
            "issues": {"type": "array", "items": {"type": "string"}},
            "suggestions": {"type": "array", "items": {"type": "string"}},
        }),
    },
})

VARIANTS_SYSTEM = """You assist researchers who publish hypothetical 3D reconstructions of cultural heritage (lost or altered buildings and objects) with alternative variants of the same object - e.g. two possible roofs.

You get the variants: id, label, description, cited source, Level of Certainty (a value on the project's scale, with the scale's levels), the model nodes each variant consists of, and measurements the viewer took of each (bounding box size and height in metres, triangle counts, nodes shared with or exclusive to other variants).

Write:
- summary: how the variants differ, combining what the descriptions claim with the measurements (e.g. "Variant B's roof is 3.2 m higher").
- differences: the notable differences, each naming the variants concerned. Numbers only from the measurements given; round sensibly.
- paradata: for every variant, whether its hypothesis is documented well enough to be reused (London Charter / Seville Principles spirit): is there a source, does the description say what it is based on, does the certainty level fit the sources and the wording (e.g. "certain" with no source, or a high level for a variant described as speculative, is inconsistent). Suggest concrete additions. You assess the documentation, never the scholarship itself: do not decide which variant is right.
- Do not invent sources, dates or facts not present in the data.
- Write in {language}; keep ids as given."""


def describe_variants(payload: dict, lang: str = "en") -> dict:
    if "variants" not in enabled_features():
        raise AIError(404, "This AI feature is not enabled.", "ai_feature_disabled")
    variants = payload.get("variants") if isinstance(payload, dict) else None
    if not isinstance(variants, list) or len(variants) < 2:
        raise AIError(400, "At least two variants are needed.", "bad_request")
    data = {
        "label": payload.get("label"),
        "description": payload.get("description"),
        "certaintyScale": payload.get("certaintyScale"),
        "variants": variants[:20],
    }
    prompt = "Reconstruction variants (JSON):\n" + _compact(data)
    answer = ask(VARIANTS_SYSTEM.replace("{language}", language_name(lang)), prompt, VARIANTS_SCHEMA, effort="medium")
    answer["model"] = model()
    return answer
