"""Downloads a model from a URL for POST /api/model/create-from-url.

The worker fetches it (not the browser, which most hosts would block with
CORS), so the URL is untrusted input pointed at the worker's own network:
only http(s) to public addresses, every redirect checked again, and the
connection pinned to the address that was checked (a hostname resolving
differently a moment later - DNS rebinding - cannot reach an internal host).
"""

import http.client
import ipaddress
import re
import socket
import ssl
import time
from pathlib import PurePosixPath
from urllib.parse import unquote, urljoin, urlsplit

MAX_REDIRECTS = 5
CONNECT_TIMEOUT = 15
READ_TIMEOUT = 30
# The whole download, answered before nginx (120 s for this endpoint,
# docker/nginx.conf) or Cloudflare (100 s) give up on the request.
TOTAL_TIMEOUT = 80
CHUNK = 1024 * 1024
USER_AGENT = "dfg-3dviewer-worker (model import)"


class FetchError(ValueError):
    """A URL that cannot be imported; `status` is the HTTP status to answer."""

    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


class FetchTooLarge(FetchError):
    def __init__(self, max_bytes: int):
        super().__init__(f"The file is larger than the {max(1, round(max_bytes / 1048576))} MB upload limit.", 413)


def _public_address(host: str, port: int) -> str:
    """The first address of host, after checking that none of its addresses
    is private, loopback, link-local or otherwise not on the internet."""
    try:
        infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except socket.gaierror:
        raise FetchError("The host of that link could not be found.")
    addresses = []
    for info in infos:
        ip = ipaddress.ip_address(info[4][0].split("%")[0])
        if ip.version == 6 and ip.ipv4_mapped:
            ip = ip.ipv4_mapped
        if not ip.is_global or ip.is_multicast:
            raise FetchError("Links to private or local addresses are not allowed.")
        addresses.append(str(ip))
    if not addresses:
        raise FetchError("The host of that link could not be found.")
    return addresses[0]


class _PinnedHTTPConnection(http.client.HTTPConnection):
    def __init__(self, host, port, ip, **kwargs):
        super().__init__(host, port, **kwargs)
        self._ip = ip

    def connect(self):
        self.sock = socket.create_connection((self._ip, self.port), CONNECT_TIMEOUT)
        self.sock.settimeout(READ_TIMEOUT)


class _PinnedHTTPSConnection(http.client.HTTPSConnection):
    def __init__(self, host, port, ip, **kwargs):
        super().__init__(host, port, context=ssl.create_default_context(), **kwargs)
        self._ip = ip

    def connect(self):
        sock = socket.create_connection((self._ip, self.port), CONNECT_TIMEOUT)
        sock.settimeout(READ_TIMEOUT)
        # Certificate and SNI for the hostname, not the pinned address.
        self.sock = self._context.wrap_socket(sock, server_hostname=self.host)


def check_url(url: str):
    parts = urlsplit(url.strip())
    if parts.scheme not in ("http", "https") or not parts.hostname:
        raise FetchError("Only http:// and https:// links can be imported.")
    if parts.username or parts.password:
        raise FetchError("Links with a user name or password are not allowed.")
    return parts


def _filename_from(parts, headers) -> str:
    disposition = headers.get("Content-Disposition", "")
    match = re.search(r"filename\*\s*=\s*[^']*''([^;]+)", disposition) or \
        re.search(r'filename\s*=\s*"?([^";]+)"?', disposition)
    path_name = PurePosixPath(unquote(parts.path)).name
    name = unquote(match.group(1)).strip() if match else ""
    return name or path_name


def fetch(url: str, max_bytes: int, allowed_extensions) -> tuple:
    """(filename, content) of the file at url. The name comes from the link
    (or the server's Content-Disposition) and must end in one of
    allowed_extensions; the size is capped at max_bytes."""
    started = time.monotonic()
    for _ in range(MAX_REDIRECTS + 1):
        parts = check_url(url)
        port = parts.port or (443 if parts.scheme == "https" else 80)
        ip = _public_address(parts.hostname, port)
        connection_class = _PinnedHTTPSConnection if parts.scheme == "https" else _PinnedHTTPConnection
        connection = connection_class(parts.hostname, port, ip, timeout=READ_TIMEOUT)
        target = parts.path or "/"
        if parts.query:
            target += "?" + parts.query
        try:
            connection.request("GET", target, headers={"User-Agent": USER_AGENT, "Accept": "*/*"})
            response = connection.getresponse()
            if response.status in (301, 302, 303, 307, 308):
                location = response.getheader("Location")
                if not location:
                    raise FetchError("The link redirects nowhere.")
                url = urljoin(url, location)
                continue
            if response.status != 200:
                raise FetchError(f"The link answered with HTTP {response.status}.", 502)

            filename = _filename_from(parts, response.headers)
            ext = PurePosixPath(filename).suffix.lower().lstrip(".")
            if ext not in allowed_extensions:
                raise FetchError(f"Unsupported file type: .{ext}" if ext else "The link does not point to a model file.")

            declared = int(response.getheader("Content-Length") or 0)
            if declared > max_bytes:
                raise FetchTooLarge(max_bytes)
            chunks, size = [], 0
            while True:
                if time.monotonic() - started > TOTAL_TIMEOUT:
                    raise FetchError("Downloading the file took too long.", 504)
                chunk = response.read(CHUNK)
                if not chunk:
                    break
                size += len(chunk)
                if size > max_bytes:
                    raise FetchTooLarge(max_bytes)
                chunks.append(chunk)
            if size == 0:
                raise FetchError("The file at that link is empty.")
            return filename, b"".join(chunks)
        except (OSError, http.client.HTTPException) as exc:
            raise FetchError(f"Could not download the file: {exc}", 502)
        finally:
            connection.close()
    raise FetchError("The link redirects too many times.")
