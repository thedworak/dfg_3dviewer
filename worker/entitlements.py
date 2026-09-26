"""Business plan of the mobile app (stdlib only).

The app (viewer/monetization/plan.js) sells its plans through Google Play,
verified by RevenueCat. A Business subscriber's app sends its RevenueCat app
user id in X-App-User-Id with uploads; this module asks RevenueCat's REST API
whether that id has the business entitlement, and the worker then applies the
WORKER_LIMIT_BUSINESS_* limits instead of the per-IP defaults (see
limits.py and _limit_context() in server.py).

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

from limits import _env_int

API_URL = "https://api.revenuecat.com/v1/subscribers/"
# RevenueCat ids: "$RCAnonymousID:<hex>" or whatever the app logs in with.
APP_USER_ID_RE = re.compile(r"^[A-Za-z0-9_$:.@-]{1,200}$")
NEGATIVE_CACHE_SEC = 120


def business_limits() -> dict:
    return {
        "uploadsPerHour": _env_int("WORKER_LIMIT_BUSINESS_UPLOADS_PER_HOUR", 100),
        "uploadsPerDay": _env_int("WORKER_LIMIT_BUSINESS_UPLOADS_PER_DAY", 500),
        # No account to charge storage to (as with anonymous uploads).
        "storageMb": 0,
        "maxModels": 0,
        "concurrentJobs": _env_int("WORKER_LIMIT_BUSINESS_CONCURRENT_JOBS", 3),
    }


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
        self.entitlement = os.environ.get("WORKER_REVENUECAT_BUSINESS_ENTITLEMENT", "business").strip() or "business"
        self.cache_sec = _env_int("WORKER_REVENUECAT_CACHE_SEC", 600)
        self._cache = {}  # app user id -> (is_business, checked_at)
        self._lock = threading.Lock()

    @property
    def enabled(self) -> bool:
        return bool(self.secret)

    def _fetch(self, app_user_id: str) -> bool:
        request = urllib.request.Request(
            API_URL + urllib.parse.quote(app_user_id, safe=""),
            headers={"Authorization": f"Bearer {self.secret}", "Accept": "application/json"},
        )
        with urllib.request.urlopen(request, timeout=5) as response:
            data = json.load(response)
        entitlement = (data.get("subscriber") or {}).get("entitlements", {}).get(self.entitlement)
        if not entitlement:
            return False
        expires = _parse_date(entitlement.get("expires_date"))
        # No expiry date = lifetime.
        return expires is None or expires > datetime.now(timezone.utc)

    def is_business(self, app_user_id: str) -> bool:
        if not self.enabled or not app_user_id or not APP_USER_ID_RE.fullmatch(app_user_id):
            return False
        now = time.time()
        with self._lock:
            cached = self._cache.get(app_user_id)
        if cached:
            is_business, checked_at = cached
            if now - checked_at < (self.cache_sec if is_business else NEGATIVE_CACHE_SEC):
                return is_business
        try:
            is_business = self._fetch(app_user_id)
        except (urllib.error.URLError, TimeoutError, ValueError, OSError) as exc:
            print(f"[entitlements] RevenueCat check failed: {exc}")
            is_business = False
        with self._lock:
            self._cache[app_user_id] = (is_business, now)
            if len(self._cache) > 10000:
                self._cache.clear()
        return is_business
