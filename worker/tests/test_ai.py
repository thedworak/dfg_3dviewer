"""Tests of worker/ai.py and its endpoints, with a stand-in for the Claude
API (no key, no network):

  python3 -m unittest discover -s worker/tests
"""

import json
import os
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from types import SimpleNamespace

WORKER_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(WORKER_DIR))
JOBS = tempfile.mkdtemp(prefix="ai-test-jobs-")
os.environ["WORKER_JOBS_DIR"] = JOBS
os.environ["WORKER_AI_ENABLED"] = "true"
# The endpoint tests call without an account; access levels are tested below.
os.environ["WORKER_AI_ACCESS"] = "all"

import ai  # noqa: E402

try:
    import anthropic  # noqa: F401
    HAVE_SDK = True
except ImportError:
    HAVE_SDK = False


class FakeMessages:
    def __init__(self, answers):
        self.answers = list(answers)
        self.calls = []

    def create(self, **params):
        self.calls.append(params)
        answer = self.answers.pop(0)
        if isinstance(answer, SimpleNamespace):
            return answer
        return SimpleNamespace(
            stop_reason="end_turn",
            content=[SimpleNamespace(type="thinking", thinking=""), SimpleNamespace(type="text", text=json.dumps(answer))],
        )


def fake_client(*answers):
    messages = FakeMessages(answers)
    return SimpleNamespace(beta=SimpleNamespace(messages=messages)), messages


IFC_SUMMARY = {
    "classes": {"IfcWall": 12, "IfcWindow": 8},
    "storeys": ["Level 1", "Level 2"],
    "psets": {"Pset_WallCommon": {"LoadBearing": {"type": "boolean", "samples": [True, False]}}},
}

IFC_ANSWER = {
    "understood": True,
    "interpretation": "Load-bearing walls on Level 2",
    "match": "all",
    "conditions": [
        {"field": "type", "pset": None, "property": None, "op": "eq", "value": "IfcWall"},
        {"field": "property", "pset": "Pset_WallCommon", "property": "LoadBearing", "op": "true", "value": None},
        {"field": "storey", "pset": None, "property": None, "op": "eq", "value": "Level 2"},
    ],
    "aggregate": {"kind": "count", "pset": None, "property": None, "unit": None},
    "action": "highlight",
    "note": None,
}


@unittest.skipUnless(HAVE_SDK, "anthropic package not installed")
class AskTests(unittest.TestCase):
    def setUp(self):
        ai.CACHE.items.clear()
        os.environ.pop("WORKER_AI_FEATURES", None)
        os.environ.pop("WORKER_AI_FALLBACKS", None)

    def test_request_shape(self):
        client, messages = fake_client(IFC_ANSWER)
        ai.set_client(client)
        answer = ai.ifc_query("load-bearing walls on level 2", IFC_SUMMARY, "pl")
        self.assertEqual(answer["conditions"][1]["property"], "LoadBearing")
        self.assertEqual(answer["model"], ai.DEFAULT_MODEL)
        params = messages.calls[0]
        self.assertEqual(params["model"], ai.DEFAULT_MODEL)
        self.assertEqual(params["output_config"]["format"]["type"], "json_schema")
        self.assertEqual(params["output_config"]["effort"], "medium")
        self.assertEqual(params["fallbacks"], "default")
        self.assertIn(ai.FALLBACK_BETA, params["betas"])
        self.assertIn("Polish", params["system"])
        self.assertNotIn("thinking", params)

    def test_cached_answer(self):
        client, messages = fake_client(IFC_ANSWER)
        ai.set_client(client)
        ai.ifc_query("walls", IFC_SUMMARY)
        ai.ifc_query("walls", IFC_SUMMARY)
        self.assertEqual(len(messages.calls), 1)

    def test_refusal_and_truncation(self):
        client, _ = fake_client(
            SimpleNamespace(stop_reason="refusal", content=[]),
            SimpleNamespace(stop_reason="max_tokens", content=[SimpleNamespace(type="text", text="{")]),
        )
        ai.set_client(client)
        with self.assertRaises(ai.AIError) as refused:
            ai.ifc_query("a", IFC_SUMMARY)
        self.assertEqual(refused.exception.code, "ai_refusal")
        with self.assertRaises(ai.AIError) as cut:
            ai.ifc_query("b", IFC_SUMMARY)
        self.assertEqual(cut.exception.code, "ai_truncated")

    def test_input_checks(self):
        ai.set_client(fake_client()[0])
        with self.assertRaises(ai.AIError):
            ai.ifc_query("", IFC_SUMMARY)
        with self.assertRaises(ai.AIError):
            ai.ifc_query("x" * (ai.MAX_QUESTION_CHARS + 1), IFC_SUMMARY)
        with self.assertRaises(ai.AIError):
            ai.ifc_query("walls", {"nothing": 1})
        with self.assertRaises(ai.AIError):
            ai.describe_variants({"variants": [{"id": "a"}]})

    def test_feature_switch(self):
        os.environ["WORKER_AI_FEATURES"] = "validation"
        ai.set_client(fake_client()[0])
        with self.assertRaises(ai.AIError) as off:
            ai.ifc_query("walls", IFC_SUMMARY)
        self.assertEqual(off.exception.code, "ai_feature_disabled")

    def test_validation_digest_caps_pointers(self):
        report = {
            "status": "warning",
            "validator": {"issues": [{"code": "X", "level": "warning", "count": 900, "pointers": [str(i) for i in range(50)]}]},
            "bounds": {"size": [12000, 8000, 30000]},
        }
        client, messages = fake_client({"headline": "h", "summary": "s", "findings": []})
        ai.set_client(client)
        ai.explain_validation(report, "de")
        prompt = messages.calls[0]["messages"][0]["content"]
        digest = json.loads(prompt.split("\n", 1)[1])
        self.assertEqual(len(digest["issues"][0]["pointers"]), 3)
        self.assertEqual(messages.calls[0]["output_config"]["effort"], "low")
        self.assertIn("German", messages.calls[0]["system"])


class AccessTests(unittest.TestCase):
    def tearDown(self):
        os.environ["WORKER_AI_ACCESS"] = "all"

    def test_default_is_business_and_up(self):
        os.environ.pop("WORKER_AI_ACCESS", None)
        self.assertEqual(ai.access_level(), "business")
        free = {"username": "f", "role": "user", "plan": None}
        self.assertFalse(ai.allowed(free, False))
        self.assertFalse(ai.allowed(None, False))
        # The app's Business subscriber has no account.
        self.assertTrue(ai.allowed(None, True))

    def test_config_when_restricted(self):
        os.environ.pop("WORKER_AI_ACCESS", None)
        config = ai.config(None, False)
        self.assertFalse(config["enabled"])
        self.assertTrue(config["restricted"])
        # The tools the app shows locked.
        self.assertEqual(config["features"], list(ai.FEATURES))

    def test_enterprise_counts_as_business(self):
        from limits import is_business_account
        from auth import APP_TIERS, PLAN_RANK
        self.assertIn("enterprise", APP_TIERS)
        self.assertGreater(PLAN_RANK["enterprise"], PLAN_RANK["business"])
        self.assertTrue(is_business_account({"plan": {"tier": "enterprise"}}))
        self.assertTrue(is_business_account({"plan": {"tier": "business"}}))
        self.assertFalse(is_business_account({"plan": {"tier": "pro"}}))

    def test_levels(self):
        user = {"username": "u", "role": "user"}
        admin = {"username": "a", "role": "admin"}
        os.environ["WORKER_AI_ACCESS"] = "all"
        self.assertTrue(ai.allowed(None, False))
        os.environ["WORKER_AI_ACCESS"] = "users"
        self.assertFalse(ai.allowed(None, False))
        self.assertTrue(ai.allowed(user, False))
        os.environ["WORKER_AI_ACCESS"] = "business"
        self.assertFalse(ai.allowed(user, False))
        self.assertTrue(ai.allowed(user, True))
        self.assertTrue(ai.allowed(admin, False))
        os.environ["WORKER_AI_ACCESS"] = "admin"
        self.assertFalse(ai.allowed(user, True))

    def test_rate_limit(self):
        os.environ["WORKER_AI_REQUESTS_PER_HOUR"] = "2"
        try:
            limiter = ai.RateLimiter()
            limiter.check("k", now=1000)
            limiter.check("k", now=1001)
            with self.assertRaises(ai.AIError) as limited:
                limiter.check("k", now=1002)
            self.assertEqual(limited.exception.status, 429)
            limiter.check("k", now=1000 + ai.HOUR + 1)
        finally:
            os.environ.pop("WORKER_AI_REQUESTS_PER_HOUR")


@unittest.skipUnless(HAVE_SDK, "anthropic package not installed")
class EndpointTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import server
        from http.server import ThreadingHTTPServer

        cls.server_module = server
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        cls.base = f"http://127.0.0.1:{cls.httpd.server_address[1]}"
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()

    def setUp(self):
        ai.CACHE.items.clear()

    def request(self, path, body=None):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(self.base + path, data=data, headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req) as response:
                return response.status, json.loads(response.read())
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read())

    def test_config(self):
        status, body = self.request("/api/ai/config")
        self.assertEqual(status, 200)
        self.assertTrue(body["enabled"])
        self.assertEqual(body["features"], list(ai.FEATURES))

    def test_validation_endpoint(self):
        job = "a" * 32
        (Path(JOBS) / job).mkdir(exist_ok=True)
        (Path(JOBS) / job / self.server_module.validate.REPORT_NAME).write_text(json.dumps({"status": "ok"}))
        client, _ = fake_client({"headline": "Ready", "summary": "Fine.", "findings": []})
        ai.set_client(client)
        status, body = self.request(f"/api/ai/validation/{job}", {"lang": "en"})
        self.assertEqual(status, 200)
        self.assertEqual(body["headline"], "Ready")
        status, body = self.request(f"/api/ai/validation/{'b' * 32}", {})
        self.assertEqual(status, 404)
        self.assertEqual(body["code"], "no_report")

    def test_ifc_endpoint(self):
        client, _ = fake_client(IFC_ANSWER)
        ai.set_client(client)
        status, body = self.request("/api/ai/ifc-query", {"question": "walls", "schema": IFC_SUMMARY})
        self.assertEqual(status, 200)
        self.assertEqual(body["action"], "highlight")
        status, body = self.request("/api/ai/ifc-query", {"question": "", "schema": IFC_SUMMARY})
        self.assertEqual(status, 400)

    def test_disabled(self):
        os.environ["WORKER_AI_ENABLED"] = "false"
        try:
            status, body = self.request("/api/ai/config")
            self.assertFalse(body["enabled"])
            status, body = self.request("/api/ai/variants", {"variants": []})
            self.assertEqual(status, 404)
        finally:
            os.environ["WORKER_AI_ENABLED"] = "true"


if __name__ == "__main__":
    unittest.main()
