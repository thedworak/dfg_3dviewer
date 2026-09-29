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

Uses RevenueCat's REST API v2. Off unless WORKER_REVENUECAT_SECRET_KEY (a
v2 *secret* API key, never the app's public one) and
WORKER_REVENUECAT_PROJECT_ID are set. The key needs only two read
permissions: customer_information:customers:read (a customer's active
entitlements) and project_configuration:entitlements:read (to map the
entitlement identifiers "business"/"pro" to the ids v2 reports). Answers are
cached (WORKER_REVENUECAT_CACHE_SEC, a shorter time for "not business"), so
an upload normally costs no request. A RevenueCat outage only means the
default limits.
"""

import json
import os
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

from limits import _env_int, business_limits as _business_limits

API_ORIGIN = "https://api.revenuecat.com"
# RevenueCat ids: "$RCAnonymousID:<hex>" or whatever the app logs in with.
APP_USER_ID_RE = re.compile(r"^[A-Za-z0-9_$:.@-]{1,200}$")
NEGATIVE_CACHE_SEC = 120


def business_limits() -> dict:
    """Business limits of an app without an account: no account to charge
    storage to (as with anonymous uploads), so no storage/model quota."""
    return {**_business_limits(), "storageMb": 0, "maxModels": 0}


# The entitlement identifier -> id map changes only when entitlements are
# edited in RevenueCat; an identifier not found refreshes it sooner.
ENTITLEMENT_IDS_CACHE_SEC = 3600
ENTITLEMENT_IDS_RETRY_SEC = 60
# Pagination guard: a customer or project has a handful of entitlements.
MAX_PAGES = 20


class Entitlements:
    def __init__(self):
        self.secret = os.environ.get("WORKER_REVENUECAT_SECRET_KEY", "").strip()
        self.project_id = os.environ.get("WORKER_REVENUECAT_PROJECT_ID", "").strip()
        self.entitlements = {
            "business": os.environ.get("WORKER_REVENUECAT_BUSINESS_ENTITLEMENT", "business").strip() or "business",
            "pro": os.environ.get("WORKER_REVENUECAT_PRO_ENTITLEMENT", "pro").strip() or "pro",
        }
        self.cache_sec = _env_int("WORKER_REVENUECAT_CACHE_SEC", 600)
        self._cache = {}  # app user id -> (plan, checked_at)
        self._entitlement_ids = ({}, 0.0)  # identifier -> id, fetched_at
        self._lock = threading.Lock()

    @property
    def enabled(self) -> bool:
        return bool(self.secret) and bool(self.project_id)

    @staticmethod
    def valid_id(app_user_id: str) -> bool:
        return bool(app_user_id) and bool(APP_USER_ID_RE.fullmatch(app_user_id))

    def _get(self, path: str) -> dict:
        request = urllib.request.Request(
            API_ORIGIN + path,
            headers={"Authorization": f"Bearer {self.secret}", "Accept": "application/json"},
        )
        with urllib.request.urlopen(request, timeout=5) as response:
            return json.load(response)

    def _list(self, path: str = None, first_page: dict = None) -> list:
        """All items of a v2 list (fetched from path, or starting from a list
        embedded in another object), following next_page."""
        items = []
        page = first_page
        for _ in range(MAX_PAGES):
            if page is None:
                page = self._get(path)
            items.extend(page.get("items") or [])
            path = page.get("next_page")
            if not path:
                break
            page = None
        return items

    def _project_path(self, rest: str) -> str:
        return f"/v2/projects/{urllib.parse.quote(self.project_id, safe='')}{rest}"

    def _entitlement_id(self, identifier: str):
        """The v2 id (entl...) of an entitlement identifier ("business")."""
        with self._lock:
            ids, fetched_at = self._entitlement_ids
        age = time.time() - fetched_at
        if identifier in ids and age < ENTITLEMENT_IDS_CACHE_SEC:
            return ids[identifier]
        if identifier not in ids and fetched_at and age < ENTITLEMENT_IDS_RETRY_SEC:
            return None
        items = self._list(self._project_path("/entitlements?limit=100"))
        ids = {item["lookup_key"]: item["id"] for item in items if item.get("lookup_key") and item.get("id")}
        with self._lock:
            self._entitlement_ids = (ids, time.time())
        if identifier not in ids:
            print(f"[entitlements] no entitlement '{identifier}' in RevenueCat project {self.project_id}")
        return ids.get(identifier)

    def _fetch(self, app_user_id: str) -> dict:
        customer = urllib.parse.quote(app_user_id, safe="")
        try:
            data = self._get(self._project_path(f"/customers/{customer}"))
        except urllib.error.HTTPError as exc:
            # Unknown to RevenueCat: never bought anything.
            if exc.code == 404:
                return {"tier": "free", "expiresAt": None}
            raise
        active = self._list(first_page=data.get("active_entitlements") or {})
        expiry_by_id = {item.get("entitlement_id"): item.get("expires_at") for item in active}
        now_ms = time.time() * 1000
        for tier in ("business", "pro"):
            entitlement_id = self._entitlement_id(self.entitlements[tier])
            if not entitlement_id or entitlement_id not in expiry_by_id:
                continue
            expires_ms = expiry_by_id[entitlement_id]
            # No expiry = lifetime.
            if expires_ms is None or expires_ms > now_ms:
                return {"tier": tier, "expiresAt": int(expires_ms // 1000) if expires_ms else None}
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
