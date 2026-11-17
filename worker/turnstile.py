"""Cloudflare Turnstile (stdlib only): a check that a person, not a script,
sends a login, a registration, a password reset or an administrator's
second step. Off unless both keys are set:

  WORKER_TURNSTILE_SITE_KEY   the widget's site key (public, sent to the
                              pages by GET /api/auth/config)
  WORKER_TURNSTILE_SECRET     its secret key, for siteverify
  WORKER_TURNSTILE_PROTECT    what asks for it, comma-separated (default
                              login,register,forgot-password,2fa)

The pages render the widget (viewer/turnstile.js) and send its token as
"turnstileToken"; server.py checks it here once (a token is good once and
for a few minutes) before the action. Cloudflare not answering counts as a
failed check: the protected actions wait rather than open up.
"""

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
ACTIONS = ("login", "register", "forgot-password", "2fa")
DEFAULT_PROTECT = ",".join(ACTIONS)
MAX_TOKEN_LENGTH = 2048


def site_key() -> str:
    return os.environ.get("WORKER_TURNSTILE_SITE_KEY", "").strip()


def _secret() -> str:
    return os.environ.get("WORKER_TURNSTILE_SECRET", "").strip()


def enabled() -> bool:
    return bool(site_key() and _secret())


def protected_actions() -> list:
    if not enabled():
        return []
    raw = os.environ.get("WORKER_TURNSTILE_PROTECT", DEFAULT_PROTECT)
    return [action for action in (part.strip() for part in raw.split(",")) if action in ACTIONS]


def protects(action: str) -> bool:
    return action in protected_actions()


def public_config():
    """For GET /api/auth/config: what the pages need to show the widget."""
    if not enabled():
        return None
    return {"siteKey": site_key(), "actions": protected_actions()}


def verify(token: str, remote_ip: str = "", timeout: float = 10.0) -> tuple:
    """(ok, error codes) of a widget's token, asked of Cloudflare."""
    token = str(token or "").strip()
    if not token:
        return False, ["missing-input-response"]
    if len(token) > MAX_TOKEN_LENGTH:
        return False, ["invalid-input-response"]
    fields = {"secret": _secret(), "response": token}
    if remote_ip:
        fields["remoteip"] = remote_ip
    request = urllib.request.Request(
        VERIFY_URL, data=urllib.parse.urlencode(fields).encode("ascii"), method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            result = json.loads(response.read() or b"{}")
    except (OSError, ValueError, urllib.error.URLError) as exc:
        print(f"turnstile: verification failed: {exc}", file=sys.stderr)
        return False, ["verification-unavailable"]
    return bool(result.get("success")), list(result.get("error-codes") or [])
