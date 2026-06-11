"""Plain-text email sender via Resend API. No-op (log only) when RESEND_API_KEY unset."""
from __future__ import annotations

import logging
import os

import httpx

_log = logging.getLogger(__name__)

_RESEND_KEY = os.environ.get("RESEND_API_KEY", "")
_FROM_EMAIL = os.environ.get("EMAIL_FROM", "TrueTraffic <noreply@truetraffic.dev>")


def send_email(to: str, subject: str, body: str) -> bool:
    """Send plain-text email. Returns True if sent, False if no API key configured."""
    key = os.environ.get("RESEND_API_KEY", _RESEND_KEY)
    if not key:
        _log.info("email_skip to=%s subject=%r (no RESEND_API_KEY)", to, subject)
        return False
    resp = httpx.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={
            "from": os.environ.get("EMAIL_FROM", _FROM_EMAIL),
            "to": [to],
            "subject": subject,
            "text": body,
        },
        timeout=10,
    )
    resp.raise_for_status()
    return True
