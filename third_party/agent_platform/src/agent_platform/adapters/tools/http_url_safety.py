"""SSRF-hardening helpers for HTTP-based built-in tools.

Validates URL scheme/host and (optionally) resolved addresses before outbound
requests. Does not eliminate all DNS rebinding races; pair with short timeouts.
"""

from __future__ import annotations

import asyncio
import ipaddress
import socket
from urllib.parse import urljoin, urlparse


class UnsafeUrlError(ValueError):
    """Raised when a URL must not be fetched (SSRF policy)."""


def _parse_host_port(netloc: str) -> tuple[str, int | None]:
    """Return (host, port) from netloc without invoking URL parsers that drop data."""
    if "@" in netloc:
        _, netloc = netloc.rsplit("@", 1)
    hostport = netloc
    if hostport.startswith("["):
        end = hostport.find("]")
        if end == -1:
            raise UnsafeUrlError("invalid IPv6 host in URL")
        host = hostport[1:end]
        rest = hostport[end + 1 :]
        if rest.startswith(":"):
            port = int(rest[1:])
        else:
            port = None
        return host, port
    if ":" in hostport:
        host, port_s = hostport.rsplit(":", 1)
        if hostport.count(":") == 1 and port_s.isdigit():
            return host, int(port_s)
    return hostport, None


def host_matches_allowlist(hostname: str, rules: list[str]) -> bool:
    """If rules is empty, any hostname passes this check (address checks still apply)."""
    if not rules:
        return True
    h = hostname.strip().lower()
    for rule in rules:
        r = rule.strip().lower()
        if not r:
            continue
        if r.startswith("*."):
            suffix = r[2:]
            if h == suffix or h.endswith("." + suffix):
                return True
        elif h == r:
            return True
    return False


def _ip_is_blocked(addr: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    if addr.is_private or addr.is_loopback or addr.is_link_local:
        return True
    if addr.is_multicast or addr.is_reserved:
        return True
    if addr.is_unspecified:
        return True
    # IPv4 documentation / shared address space
    if addr.version == 4:
        if addr in ipaddress.ip_network("100.64.0.0/10"):
            return True
        if addr == ipaddress.ip_address("0.0.0.0"):
            return True
    # Common metadata endpoints (defence in depth; link-local often catches 169.254.)
    if addr.version == 4 and addr == ipaddress.ip_address("169.254.169.254"):
        return True
    return False


def assert_ip_string_allowed(ip_str: str) -> None:
    try:
        parsed = ipaddress.ip_address(ip_str)
    except ValueError as exc:
        raise UnsafeUrlError(f"invalid IP address in URL host: {ip_str!r}") from exc
    if _ip_is_blocked(parsed):
        raise UnsafeUrlError(f"address not allowed for outbound fetch: {ip_str}")


async def assert_hostname_resolves_safely(hostname: str) -> None:
    """Resolve all A/AAAA records and ensure none point to blocked space."""

    def _resolve() -> None:
        infos = socket.getaddrinfo(
            hostname,
            None,
            type=socket.SOCK_STREAM,
        )
        seen: set[str] = set()
        for info in infos:
            sockaddr = info[4]
            ip_str = sockaddr[0]
            if ip_str in seen:
                continue
            seen.add(ip_str)
            assert_ip_string_allowed(ip_str)

    await asyncio.to_thread(_resolve)


def validate_http_fetch_url(
    url: str,
    *,
    block_private_networks: bool,
    host_allowlist: list[str],
) -> str:
    """Return normalized URL string if allowed, else raise UnsafeUrlError."""
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise UnsafeUrlError("only http and https URLs are allowed")
    if not parsed.netloc:
        raise UnsafeUrlError("URL is missing a host")
    host, _port = _parse_host_port(parsed.netloc)
    if not host:
        raise UnsafeUrlError("URL host is empty")

    if not host_matches_allowlist(host, host_allowlist):
        raise UnsafeUrlError(f"host {host!r} is not in fetch allowlist")

    if not block_private_networks:
        return url

    try:
        ipaddress.ip_address(host)
    except ValueError:
        # Hostname: DNS validation happens in validate_http_fetch_url_resolved.
        return url
    assert_ip_string_allowed(host)
    return url


async def validate_http_fetch_url_resolved(
    url: str,
    *,
    block_private_networks: bool,
    host_allowlist: list[str],
) -> str:
    """Validate URL including DNS resolution when blocking private networks."""
    validate_http_fetch_url(
        url,
        block_private_networks=block_private_networks,
        host_allowlist=host_allowlist,
    )
    if not block_private_networks:
        return url
    parsed = urlparse(url)
    host, _ = _parse_host_port(parsed.netloc)
    try:
        ipaddress.ip_address(host)
    except ValueError:
        await assert_hostname_resolves_safely(host)
    return url


def safe_redirect_url(base_url: str, location: str | None) -> str:
    if not location:
        raise UnsafeUrlError("redirect response missing Location header")
    next_url = urljoin(base_url, location.strip())
    parsed = urlparse(next_url)
    if parsed.scheme not in {"http", "https"}:
        raise UnsafeUrlError("redirect to non-http(s) URL rejected")
    return next_url
