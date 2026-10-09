"""Optional outgoing mail for the standalone worker (stdlib only).

Off unless WORKER_SMTP_HOST is set. Currently used for one message: telling a
user their account was approved. Configuration (all environment variables):

  WORKER_SMTP_HOST      SMTP server; unset disables mail entirely
  WORKER_SMTP_PORT      default 587 (465 with ssl)
  WORKER_SMTP_SECURITY  starttls (default) | ssl | none
  WORKER_SMTP_USER / WORKER_SMTP_PASSWORD   optional login
  WORKER_SMTP_FROM      sender address (default: WORKER_SMTP_USER)
  WORKER_PUBLIC_URL     link put in the message, e.g. https://viewer.example.org
"""

import os
import smtplib
import ssl
import sys
import threading
from email.message import EmailMessage

SECURITY_MODES = ("starttls", "ssl", "none")


def enabled() -> bool:
    return bool(os.environ.get("WORKER_SMTP_HOST"))


def _send(message: EmailMessage) -> None:
    host = os.environ["WORKER_SMTP_HOST"]
    security = (os.environ.get("WORKER_SMTP_SECURITY") or "starttls").lower()
    if security not in SECURITY_MODES:
        raise ValueError(f"WORKER_SMTP_SECURITY must be one of {SECURITY_MODES}, got {security!r}")
    port = int(os.environ.get("WORKER_SMTP_PORT") or (465 if security == "ssl" else 587))
    context = ssl.create_default_context()
    if security == "ssl":
        client = smtplib.SMTP_SSL(host, port, timeout=20, context=context)
    else:
        client = smtplib.SMTP(host, port, timeout=20)
    with client:
        if security == "starttls":
            client.starttls(context=context)
        user = os.environ.get("WORKER_SMTP_USER", "")
        if user:
            client.login(user, os.environ.get("WORKER_SMTP_PASSWORD", ""))
        client.send_message(message)


def send_account_approved(username: str, email: str, background: bool = True) -> None:
    """Never raises: a mail problem must not undo the approval itself."""
    if not enabled() or not email:
        return
    sender = os.environ.get("WORKER_SMTP_FROM") or os.environ.get("WORKER_SMTP_USER", "")
    if not sender:
        print("mail: WORKER_SMTP_FROM (or WORKER_SMTP_USER) is required to send mail", file=sys.stderr)
        return
    url = os.environ.get("WORKER_PUBLIC_URL", "").strip()
    message = EmailMessage()
    message["Subject"] = "Your DLF AIM 3D Viewer account has been approved"
    message["From"] = sender
    message["To"] = email
    lines = [
        f"Hello {username},",
        "",
        "An administrator has approved your account.",
        f"You can now log in and upload 3D models: {url}" if url else "You can now log in and upload 3D models.",
    ]
    message.set_content("\n".join(lines))

    def run() -> None:
        try:
            _send(message)
        except Exception as exc:  # noqa: BLE001 - logged, never propagated
            print(f"mail: could not send approval mail to {email}: {exc}", file=sys.stderr)

    if background:
        threading.Thread(target=run, daemon=True).start()
    else:
        run()
