"""Time-based one-time passwords (RFC 6238, the codes of Google
Authenticator, Microsoft Authenticator, Aegis, 1Password...): the second
step of an administrator's login to the admin pages (auth.py, server.py).
Standard library only: HMAC-SHA1, 6 digits, 30-second steps.
"""

import base64
import hashlib
import hmac
import secrets
import struct
import time
from urllib.parse import quote

DIGITS = 6
STEP = 30
# Codes of the step before and after count too: a phone's clock a little off.
WINDOW = 1


def new_secret() -> str:
    """160 random bits in base32, as authenticator apps take them."""
    return base64.b32encode(secrets.token_bytes(20)).decode("ascii").rstrip("=")


def _key(secret: str) -> bytes:
    padded = secret.upper() + "=" * (-len(secret) % 8)
    return base64.b32decode(padded)


def code_at(secret: str, step: int) -> str:
    digest = hmac.new(_key(secret), struct.pack(">Q", step), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    value = struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF
    return str(value % 10 ** DIGITS).zfill(DIGITS)


def matching_step(secret: str, code: str, now: float = None, after: int = -1):
    """The time step the code belongs to (now, or one step either side), or
    None. A step at or before `after` (the last one used) is refused: a code
    is good once."""
    code = "".join(str(code or "").split())
    if len(code) != DIGITS or not code.isdigit():
        return None
    current = int((now if now is not None else time.time()) // STEP)
    for step in range(current - WINDOW, current + WINDOW + 1):
        if step > after and hmac.compare_digest(code_at(secret, step), code):
            return step
    return None


def provisioning_uri(secret: str, account: str, issuer: str) -> str:
    """otpauth://totp/... - the QR code an authenticator app scans."""
    label = quote(f"{issuer}:{account}")
    return (f"otpauth://totp/{label}?secret={secret}&issuer={quote(issuer)}"
            f"&algorithm=SHA1&digits={DIGITS}&period={STEP}")


def new_recovery_codes(count: int = 8) -> list:
    """One-time codes for when the phone is lost: xxxx-xxxx-xxxx."""
    alphabet = "abcdefghjkmnpqrstuvwxyz23456789"
    return ["-".join("".join(secrets.choice(alphabet) for _ in range(4)) for _ in range(3)) for _ in range(count)]


def hash_recovery_code(code: str) -> str:
    return hashlib.sha256("".join(str(code).lower().split()).encode("utf-8")).hexdigest()
