"""SSRF guard — H3. Shared by checker and collector."""
from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse

import httpx

_BLOCKED_NETS: list[ipaddress.IPv4Network | ipaddress.IPv6Network] = [
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("100.64.0.0/10"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
]


class SSRFError(ValueError):
    """Raised when a URL fails SSRF validation."""


def validate_external_url(url: str) -> None:
    """Raise SSRFError if url is not a safe external http(s) URL on port 80/443."""
    try:
        parsed = urlparse(url)
    except Exception as exc:
        raise SSRFError(f"invalid URL: {exc}") from exc

    if parsed.scheme not in ("http", "https"):
        raise SSRFError(f"scheme not allowed: {parsed.scheme!r}")

    port = parsed.port
    if port is not None and port not in (80, 443):
        raise SSRFError(f"port not allowed: {port}")

    host = parsed.hostname
    if not host:
        raise SSRFError("missing hostname")

    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror as exc:
        raise SSRFError(f"DNS lookup failed for {host!r}: {exc}") from exc

    for info in infos:
        addr = info[4][0]
        try:
            ip = ipaddress.ip_address(addr)
        except ValueError:
            continue
        if any(ip in net for net in _BLOCKED_NETS):
            raise SSRFError(f"host {host!r} resolves to blocked address {addr}")


async def ssrf_safe_get(
    url: str,
    timeout: float = 3.0,
    max_size: int = 1_048_576,
) -> httpx.Response:
    """SSRF-safe GET. Validates url and each redirect target; caps response size."""
    validate_external_url(url)

    async def _check_redirect(response: httpx.Response) -> None:
        if response.is_redirect:
            location = response.headers.get("location", "")
            if location:
                validate_external_url(location)

    async with httpx.AsyncClient(
        timeout=timeout,
        follow_redirects=True,
        max_redirects=5,
        event_hooks={"response": [_check_redirect]},
    ) as client:
        resp = await client.get(url)

    if len(resp.content) > max_size:
        raise SSRFError(f"response from {url!r} exceeds {max_size} bytes")

    return resp
