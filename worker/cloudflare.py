"""Cloudflare cache purge, for the worker and the deploy workflow.

The worker purges /files/<job>/ when a model is deleted and a thumbnail's
URL when "Render preview" overwrites it; deploy.yml purges the static
assets of every viewer host. Purging only reaches Cloudflare's edge - a
browser keeps what it has until its own max-age runs out, which is why the
URLs that change in place are versioned (?v=) or served with no-cache.

Configuration (environment):
  CF_API_TOKEN        API token with Zone > Cache Purge on the zone
  CF_ZONE_ID          the zone's id (Overview page of the domain), or one
                      per domain when the hosts span several zones:
                      example.org=<id>,example.eu=<id> (a host goes to the
                      zone its name ends with)
  WORKER_PUBLIC_HOSTS comma-separated hostnames the viewers are served
                      under (test.example.org,dev.example.org,...); every
                      viewer proxies the same /files/, so each host has its
                      own cached copy. Unset: the host of the request.
Without a token or zone id purging is off (the calls do nothing).

CLI (deploy.yml):
  python3 worker/cloudflare.py <prefix> [<prefix> ...]
  e.g. python3 worker/cloudflare.py dev.example.org/assets/ dev.example.org/examples/
"""

import json
import os
import sys
import threading
import urllib.error
import urllib.request

API = "https://api.cloudflare.com/client/v4"
# Cloudflare accepts at most 30 prefixes (or URLs) per purge request.
BATCH = 30


def enabled() -> bool:
    return bool(os.environ.get("CF_API_TOKEN") and os.environ.get("CF_ZONE_ID"))


def public_hosts(request_host: str = "") -> list:
    hosts = [h.strip() for h in os.environ.get("WORKER_PUBLIC_HOSTS", "").split(",") if h.strip()]
    if not hosts and request_host:
        hosts = [request_host.split(":")[0]]
    return hosts


def zone_for(prefix: str) -> str:
    """The zone id whose domain the prefix's host belongs to."""
    setting = os.environ.get("CF_ZONE_ID", "").strip()
    if "=" not in setting:
        return setting
    host = prefix.split("/")[0].lower()
    zones = dict(part.strip().split("=", 1) for part in setting.split(",") if "=" in part)
    for domain, zone in sorted(zones.items(), key=lambda item: -len(item[0])):
        domain = domain.strip().lower()
        if host == domain or host.endswith("." + domain):
            return zone.strip()
    raise RuntimeError(f"No zone in CF_ZONE_ID for {host}")


def purge_prefixes(prefixes: list) -> None:
    """Purges every cached URL starting with one of `prefixes` (host/path,
    no scheme - query-string variants included). Raises RuntimeError with
    Cloudflare's own error message when a request is refused."""
    if not enabled():
        return
    by_zone = {}
    for prefix in prefixes:
        by_zone.setdefault(zone_for(prefix), []).append(prefix)
    for zone, zone_prefixes in by_zone.items():
        _purge_zone(zone, zone_prefixes)


def _purge_zone(zone: str, prefixes: list) -> None:
    token = os.environ.get("CF_API_TOKEN", "")
    for start in range(0, len(prefixes), BATCH):
        body = json.dumps({"prefixes": prefixes[start:start + BATCH]}).encode("utf-8")
        request = urllib.request.Request(
            f"{API}/zones/{zone}/purge_cache",
            data=body,
            method="POST",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                result = json.loads(response.read() or b"{}")
        except urllib.error.HTTPError as exc:
            # 4xx answers still carry Cloudflare's JSON with the reason
            # (bad token, missing permission, wrong zone, rate limit).
            raise RuntimeError(f"HTTP {exc.code}: {exc.read().decode('utf-8', 'replace')}") from None
        except (urllib.error.URLError, OSError, ValueError) as exc:
            raise RuntimeError(str(exc)) from None
        if not result.get("success"):
            raise RuntimeError(json.dumps(result.get("errors") or result))


def purge_paths_async(paths: list, request_host: str = "") -> None:
    """Purges `paths` (/files/<job>/...) on every public host, in the
    background - a request never waits for Cloudflare, and a failed purge
    only costs a stale cached copy, so it is logged, not reported."""
    if not enabled():
        return
    prefixes = [host + path for host in public_hosts(request_host) for path in paths]
    if not prefixes:
        return

    def run():
        try:
            purge_prefixes(prefixes)
            print(f"[cloudflare] purged {', '.join(prefixes)}", file=sys.stderr)
        except RuntimeError as exc:
            print(f"[cloudflare] purge of {', '.join(prefixes)} failed: {exc}", file=sys.stderr)

    threading.Thread(target=run, daemon=True).start()


if __name__ == "__main__":
    if not enabled():
        sys.exit("CF_API_TOKEN and CF_ZONE_ID must be set.")
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    try:
        purge_prefixes(sys.argv[1:])
    except RuntimeError as exc:
        sys.exit(f"Cloudflare cache purge failed: {exc}")
    print(f"Cloudflare cache purged: {' '.join(sys.argv[1:])}")
