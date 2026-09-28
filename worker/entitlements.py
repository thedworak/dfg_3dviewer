"""Plans of the mobile app (stdlib only).

The app (viewer/monetization/plan.js) sells its plans through Google Play,
verified by RevenueCat. The app sends its RevenueCat app user id in
X-App-User-Id; this module asks RevenueCat's REST API which plan that id has.
Two uses:

- Business uploads: the worker applies the WORKER_LIMIT_BUSINESS_* limits
  instead of the per-IP defaults (see limits.py and _limit_context() in
  server.py).
- Linking a purchase to an account (POST /api/app/link): the verified plan is
  stored on the account (auth.py set_app_plan) and shown in the admin panel
  and next to the user name.

Off unless WORKER_REVENUECAT_SECRET_KEY is set (a RevenueCat *secret* API key,
never the app's public one). Answers are cached (WORKER_REVENUECAT_CACHE_SEC,
a shorter time for "not business"), so an upload normally costs no request.
A RevenueCat outage only means the default limits.
"""

import json
import os
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

from limits import _env_int, business_limits as _business_limits

API_URL = "https://api.revenuecat.com/v1/subscribers/"
# RevenueCat ids: "$RCAnonymousID:<hex>" or whatever the app logs in with.
APP_USER_ID_RE = re.compile(r"^[A-Za-z0-9_$:.@-]{1,200}$")
NEGATIVE_CACHE_SEC = 120


def business_limits() -> dict:
    """Business limits of an app without an account: no account to charge
    storage to (as with anonymous uploads), so no storage/model quota."""
    return {**_business_limits(), "storageMb": 0, "maxModels": 0}


def _parse_date(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


class Entitlements:
    def __init__(self):
        self.secret = os.environ.get("WORKER_REVENUECAT_SECRET_KEY", "").strip()
        self.entitlements = {
            "business": os.environ.get("WORKER_REVENUECAT_BUSINESS_ENTITLEMENT", "business").strip() or "business",
            "pro": os.environ.get("WORKER_REVENUECAT_PRO_ENTITLEMENT", "pro").strip() or "pro",
        }
        self.cache_sec = _env_int("WORKER_REVENUECAT_CACHE_SEC", 600)
        self._cache = {}  # app user id -> (plan, checked_at)
        self._lock = threading.Lock()

    @property
    def enabled(self) -> bool:
        return bool(self.secret)

    @staticmethod
    def valid_id(app_user_id: str) -> bool:
        return bool(app_user_id) and bool(APP_USER_ID_RE.fullmatch(app_user_id))

    def _fetch(self, app_user_id: str) -> dict:
        request = urllib.request.Request(
            API_URL + urllib.parse.quote(app_user_id, safe=""),
            headers={"Authorization": f"Bearer {self.secret}", "Accept": "application/json"},
        )
        with urllib.request.urlopen(request, timeout=5) as response:
            data = json.load(response)
        active = (data.get("subscriber") or {}).get("entitlements", {})
        now = datetime.now(timezone.utc)
        for tier in ("business", "pro"):
            entitlement = active.get(self.entitlements[tier])
            if not entitlement:
                continue
            expires = _parse_date(entitlement.get("expires_date"))
            # No expiry date = lifetime.
            if expires is None or expires > now:
                return {"tier": tier, "expiresAt": int(expires.timestamp()) if expires else None}
        return {"tier": "free", "expiresAt": None}

    def plan(self, app_user_id: str, fresh: bool = False) -> dict:
        """{"tier": "free"|"pro"|"business", "expiresAt": unix time or None}
        of an app user id, from RevenueCat (cached unless fresh). Raises
        OSError/ValueError when RevenueCat can't be asked."""
        now = time.time()
        if not fresh:
            with self._lock:
                cached = self._cache.get(app_user_id)
            if cached:
                plan, checked_at = cached
                if now - checked_at < (self.cache_sec if plan["tier"] != "free" else NEGATIVE_CACHE_SEC):
                    return plan
        plan = self._fetch(app_user_id)
        with self._lock:
            self._cache[app_user_id] = (plan, now)
            if len(self._cache) > 10000:
                self._cache.clear()
        return plan

    def is_business(self, app_user_id: str) -> bool:
        if not self.enabled or not self.valid_id(app_user_id):
            return False
        try:
            return self.plan(app_user_id)["tier"] == "business"
        except (urllib.error.URLError, TimeoutError, ValueError, OSError) as exc:
            print(f"[entitlements] RevenueCat check failed: {exc}")
            # Not asked again for NEGATIVE_CACHE_SEC, so an outage doesn't
            # slow every upload down by the timeout.
            with self._lock:
                self._cache[app_user_id] = ({"tier": "free", "expiresAt": None}, time.time())
            return False
