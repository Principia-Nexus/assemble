"""Deliberate, organizer-initiated review invitations through Emergent managed email."""
import ipaddress
import logging
import os
import re
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse

import httpx
from fastapi import HTTPException

logger = logging.getLogger(__name__)
EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ["EMERGENT_EMAIL_KEY"]
EMAIL_FROM_NAME = os.environ["EMAIL_FROM_NAME"]
BLOCKED = re.compile(r"(\.test|\.example|\.invalid|\.localhost|@example\.(com|org|net))$", re.I)

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host):
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown, real):
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject, html):
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} differs from link host {real!r} (G3)")


def sendable(email):
    return bool(email) and not BLOCKED.search(email.strip())


def invitation(organizer_firm, job_name, partner_name, version_number, url):
    subject = f"{organizer_firm} asks you to review your terms for {job_name}"
    text = (f"{organizer_firm} prepared plan v{version_number} for {job_name} and asks {partner_name} to review "
            "the exact sites, dates, price and payment terms proposed for your firm. You can confirm, request a change "
            "or decline. Confirming does not award the job or form a contract.")
    html = (f'<table role="presentation" width="100%"><tr><td style="padding:24px;font-family:Arial,sans-serif;'
            f'color:#1A2838;font-size:14px;line-height:1.5">'
            f'<p>{escape(text)}</p>'
            f'<p><a href="{escape(url)}" style="display:inline-block;background:#1A2838;color:#ffffff;padding:10px 16px;'
            f'text-decoration:none;border-radius:4px">Open your private review</a></p>'
            f'<p style="font-size:12px;color:#666">Sign in with this email address to open it. Sent by '
            f'{escape(EMAIL_FROM_NAME)} on behalf of {escape(organizer_firm)}. We never ask for your password or '
            f'payment details by email.</p></td></tr></table>')
    return subject, text, html


def code_html(code):
    return (f'<table role="presentation" width="100%"><tr><td style="padding:24px;font-family:Arial,sans-serif;color:#1A2838">'
            f'<p>Your Assemble verification code is</p><p style="font-size:28px;letter-spacing:6px;font-weight:bold">{escape(code)}</p>'
            f'<p style="font-size:12px;color:#666">It expires in 15 minutes. Enter it in the page you were using. '
            f'We never ask for your password by email.</p></td></tr></table>')


async def send_email(*, to, subject, html):
    _assert_safe_email(subject, html)
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(f"{EMAIL_BASE_URL}/api/v1/email/send", headers={"X-Email-Key": EMAIL_KEY}, json=payload)
        resp.raise_for_status()
        return resp.json().get("id")
    except httpx.HTTPStatusError as e:
        try:
            code = e.response.json().get("code", "")
        except ValueError:
            code = ""
        if code in ("insufficient_credits", "integration_disabled", "daily_limit_reached"):
            logger.warning(f"Email paused: {code} ({e.response.status_code})")
            raise HTTPException(503, "Email is temporarily unavailable. Copy the link instead.")
        logger.error(f"Email send failed: {e.response.status_code} {e.response.text[:300]}")
        raise HTTPException(502, "The email could not be sent. Copy the link instead.")
    except httpx.HTTPError as e:
        logger.error(f"Email send error: {e}")
        raise HTTPException(502, "The email could not be sent. Copy the link instead.")
