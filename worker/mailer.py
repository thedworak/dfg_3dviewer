"""Optional outgoing mail for the standalone worker (stdlib only).

Off unless WORKER_SMTP_HOST is set. Used to tell a user their account was
approved (or why it was not), to send a password reset link, to tell the moderators about a
reported model and the administrators about a new account. Configuration (all environment variables):

  WORKER_SMTP_HOST      SMTP server; unset disables mail entirely
  WORKER_SMTP_PORT      default 587 (465 with ssl)
  WORKER_SMTP_SECURITY  starttls (default) | ssl | none
  WORKER_SMTP_USER / WORKER_SMTP_PASSWORD   optional login
  WORKER_SMTP_FROM      sender address (default: WORKER_SMTP_USER)
  WORKER_SIGNUP_EMAIL   who gets the administrators' mail - a new account,
                        the digest, the disk filling up (comma-separated;
                        default: the admin accounts' addresses; "off": nobody)
  WORKER_SIGNUP_NOTIFY  each (default): a mail per new account; off: only
                        in the digest (WORKER_ADMIN_DIGEST, admin_watch.py)
  WORKER_PUBLIC_URL     link put in the message, e.g. https://viewer.example.org
                        (a password reset needs it: the link points there)
"""

import os
import smtplib
import ssl
import sys
import threading
import time
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


def _sender() -> str:
    sender = os.environ.get("WORKER_SMTP_FROM") or os.environ.get("WORKER_SMTP_USER", "")
    if not sender:
        print("mail: WORKER_SMTP_FROM (or WORKER_SMTP_USER) is required to send mail", file=sys.stderr)
    return sender


def public_url() -> str:
    return os.environ.get("WORKER_PUBLIC_URL", "").strip().rstrip("/")


def password_reset_enabled() -> bool:
    """A reset link needs mail and an address of the viewer to point at -
    never the request's Host header, which the requester controls."""
    return enabled() and bool(public_url())


def send_password_reset(username: str, email: str, token: str, ttl_minutes: int, background: bool = True) -> None:
    """The "forgot password" link (auth.py request_password_reset): the
    viewer opens a form for a new password with ?resetPassword=<token>.
    Never raises."""
    if not password_reset_enabled() or not email:
        return
    sender = _sender()
    if not sender:
        return
    message = EmailMessage()
    message["Subject"] = "Reset your DLF AIM 3D Viewer password"
    message["From"] = sender
    message["To"] = email
    lines = [
        f"Hello {username},",
        "",
        "Someone (hopefully you) asked to reset the password of this account.",
        f"To choose a new password, open this link within {ttl_minutes} minutes:",
        "",
        f"{public_url()}/?resetPassword={token}",
        "",
        "If you did not ask for it, ignore this message - your password stays as it is.",
    ]
    message.set_content("\n".join(lines))

    def run() -> None:
        try:
            _send(message)
        except Exception as exc:  # noqa: BLE001 - logged, never propagated
            print(f"mail: could not send password reset mail to {email}: {exc}", file=sys.stderr)

    if background:
        threading.Thread(target=run, daemon=True).start()
    else:
        run()


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


def _gb(value) -> str:
    return f"{value / 1024 ** 3:.1f} GB"


def send_admin_digest(digest: dict, mode: str, recipients, background: bool = True) -> None:
    """The administrators' daily or weekly summary (admin_watch.py,
    server.py admin_digest). Never raises."""
    if not enabled() or not recipients:
        return
    sender = _sender()
    if not sender:
        return
    url = public_url()
    period = "week" if mode == "weekly" else "day"
    since = time.strftime("%Y-%m-%d %H:%M", time.localtime(digest["since"]))
    message = EmailMessage()
    message["Subject"] = (f"3D viewer, last {period}: {len(digest['newAccounts'])} new accounts, "
                          f"{digest['uploads']} models")
    message["From"] = sender
    message["To"] = ", ".join(recipients)
    lines = [f"Since {since}:", ""]
    lines.append(f"New accounts: {len(digest['newAccounts'])}")
    for account in digest["newAccounts"][:50]:
        lines.append(f"  - {account['username']} <{account['email'] or '-'}> ({account['status']})")
    if len(digest["newAccounts"]) > 50:
        lines.append(f"  ... and {len(digest['newAccounts']) - 50} more")
    lines += [
        f"Waiting for approval now: {digest['pending']}",
        "",
        f"Models uploaded: {digest['uploads']} ({_gb(digest['uploadedBytes'])})",
        f"Conversions failed: {digest['failed']}",
        f"Reports waiting for a decision: {digest['openReports']}",
    ]
    disk = digest.get("disk")
    if disk:
        lines.append(f"Disk: {disk['percent']:.1f}% full, {_gb(disk['free'])} free"
                     + ("  <- over the warning level" if disk.get("warning") else ""))
    lines += ["", f"Admin panel: {url}/exadmin/" if url else "Admin panel: /exadmin/",
              "", "Sent because WORKER_ADMIN_DIGEST is set on the worker."]
    message.set_content("\n".join(lines))

    def run() -> None:
        try:
            _send(message)
        except Exception as exc:  # noqa: BLE001 - logged, never propagated
            print(f"mail: could not send the admin digest: {exc}", file=sys.stderr)

    if background:
        threading.Thread(target=run, daemon=True).start()
    else:
        run()


def send_disk_warning(disk: dict, recipients, background: bool = True) -> None:
    """The jobs volume is nearly full (admin_watch.py). Never raises."""
    if not enabled() or not recipients:
        return
    sender = _sender()
    if not sender:
        return
    url = public_url()
    message = EmailMessage()
    message["Subject"] = f"Disk {disk['percent']:.0f}% full on the 3D viewer server"
    message["From"] = sender
    message["To"] = ", ".join(recipients)
    lines = [
        f"The disk with the uploaded models is {disk['percent']:.1f}% full "
        f"(warning from {disk['warnPercent']:.0f}%).",
        "",
        f"Used: {_gb(disk['used'])} of {_gb(disk['total'])}, free: {_gb(disk['free'])}.",
        "",
        "When it is full, uploads and conversions fail. Delete models, lower the",
        "storage limits or give the volume more space.",
        f"The largest models and accounts: {url}/exadmin/#stats" if url else "The largest models and accounts: admin panel, Statistics.",
    ]
    message.set_content("\n".join(lines))

    def run() -> None:
        try:
            _send(message)
        except Exception as exc:  # noqa: BLE001 - logged, never propagated
            print(f"mail: could not send disk warning: {exc}", file=sys.stderr)

    if background:
        threading.Thread(target=run, daemon=True).start()
    else:
        run()


def send_account_rejected(username: str, email: str, reason: str, background: bool = True) -> None:
    """Tells someone their registration was not approved, with the
    administrator's reason. Never raises: the account is gone anyway."""
    if not enabled() or not email:
        return
    sender = _sender()
    if not sender:
        return
    message = EmailMessage()
    message["Subject"] = "Your DLF AIM 3D Viewer registration was not approved"
    message["From"] = sender
    message["To"] = email
    lines = [
        f"Hello {username},",
        "",
        "An administrator has not approved your account, and it has been removed.",
    ]
    if reason:
        lines += ["", "Reason:", reason]
    lines += ["", "If you think this is a mistake, reply to this message."]
    message.set_content("\n".join(lines))

    def run() -> None:
        try:
            _send(message)
        except Exception as exc:  # noqa: BLE001 - logged, never propagated
            print(f"mail: could not send rejection mail to {email}: {exc}", file=sys.stderr)

    if background:
        threading.Thread(target=run, daemon=True).start()
    else:
        run()


def send_content_report(report: dict, background: bool = True) -> None:
    """Tells the moderators (WORKER_REPORTS_EMAIL, comma-separated) about a
    reported model (reports.py). Never raises: the report is stored anyway
    and listed in the admin panel."""
    recipients = [part.strip() for part in os.environ.get("WORKER_REPORTS_EMAIL", "").split(",") if part.strip()]
    if not enabled() or not recipients:
        return
    sender = os.environ.get("WORKER_SMTP_FROM") or os.environ.get("WORKER_SMTP_USER", "")
    if not sender:
        print("mail: WORKER_SMTP_FROM (or WORKER_SMTP_USER) is required to send mail", file=sys.stderr)
        return
    url = os.environ.get("WORKER_PUBLIC_URL", "").strip()
    message = EmailMessage()
    message["Subject"] = f"Model reported: {report.get('reason')} ({report.get('jobId')})"
    message["From"] = sender
    message["To"] = ", ".join(recipients)
    lines = [
        "A model was reported and is waiting for a decision (please act within 24 hours).",
        "",
        f"Model:    {report.get('jobId')}",
        f"Uploader: {report.get('owner') or '(anonymous)'}",
        f"Reason:   {report.get('reason')}",
        f"Reporter: {report.get('reporterUser') or '(not signed in)'}",
        "",
        report.get("details") or "(no details)",
        "",
        f"Decide in the admin panel ({url}/exadmin/), Reports." if url else "Decide in the admin panel, Reports.",
        "Or: docker compose exec worker python3 /app/worker/server.py admin reports",
    ]
    message.set_content("\n".join(lines))

    def run() -> None:
        try:
            _send(message)
        except Exception as exc:  # noqa: BLE001 - logged, never propagated
            print(f"mail: could not send report mail: {exc}", file=sys.stderr)

    if background:
        threading.Thread(target=run, daemon=True).start()
    else:
        run()


def signup_recipients(admin_emails) -> list:
    """WORKER_SIGNUP_EMAIL (comma-separated), "off" for nobody, unset for the
    addresses of the admin accounts (admin_emails)."""
    configured = os.environ.get("WORKER_SIGNUP_EMAIL", "").strip()
    if configured.lower() in ("off", "none", "false", "0"):
        return []
    if configured:
        return [part.strip() for part in configured.split(",") if part.strip()]
    return sorted({email.strip() for email in admin_emails if email and email.strip()})


def send_new_account(account: dict, admin_emails, background: bool = True) -> None:
    """Tells the administrators that someone registered (auth.py register):
    who, with which address, and whether the account waits for approval.
    Never raises: the account is created anyway. WORKER_SIGNUP_NOTIFY=off
    leaves it to the digest (admin_watch.py)."""
    if (os.environ.get("WORKER_SIGNUP_NOTIFY") or "each").strip().lower() == "off":
        return
    recipients = signup_recipients(admin_emails)
    if not enabled() or not recipients:
        return
    sender = _sender()
    if not sender:
        return
    url = public_url()
    pending = account.get("status") == "pending"
    message = EmailMessage()
    message["Subject"] = (f"New account waiting for approval: {account.get('username')}" if pending
                          else f"New account: {account.get('username')}")
    message["From"] = sender
    message["To"] = ", ".join(recipients)
    lines = [
        "Someone created an account.",
        "",
        f"Username: {account.get('username')}",
        f"Email:    {account.get('email') or '(none)'}",
        f"Status:   {account.get('status')}",
        "",
    ]
    if pending:
        lines.append(f"Approve or disable it in the admin panel ({url}/exadmin/#users)." if url
                     else "Approve or disable it in the admin panel, Users.")
        lines.append(f"Or: docker compose exec worker python3 /app/worker/server.py admin approve {account.get('username')}")
    else:
        lines.append(f"The account is active. Accounts: {url}/exadmin/#users" if url else "The account is active.")
    message.set_content("\n".join(lines))

    def run() -> None:
        try:
            _send(message)
        except Exception as exc:  # noqa: BLE001 - logged, never propagated
            print(f"mail: could not send new account mail: {exc}", file=sys.stderr)

    if background:
        threading.Thread(target=run, daemon=True).start()
    else:
        run()
