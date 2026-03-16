#!/usr/bin/env python3

from __future__ import annotations

import argparse
import socket
import ssl
import sys
from urllib.parse import urljoin, urlsplit


USER_AGENT = "go2web/1.0"
DEFAULT_TIMEOUT = 10
MAX_REDIRECTS = 5


def decode_chunked(body: bytes) -> bytes:
    chunks: list[bytes] = []
    index = 0
    while True:
        line_end = body.find(b"\r\n", index)
        if line_end == -1:
            raise ValueError("Malformed chunked body")
        size_line = body[index:line_end].split(b";", 1)[0]
        size = int(size_line, 16)
        index = line_end + 2
        if size == 0:
            return b"".join(chunks)
        chunk = body[index:index + size]
        if len(chunk) != size:
            raise ValueError("Truncated chunked body")
        chunks.append(chunk)
        index += size + 2


def recv_all(stream: socket.socket) -> bytes:
    chunks: list[bytes] = []
    while True:
        data = stream.recv(65536)
        if not data:
            break
        chunks.append(data)
    return b"".join(chunks)


def build_request(host: str, path: str) -> bytes:
    headers = [
        f"GET {path} HTTP/1.1",
        f"Host: {host}",
        f"User-Agent: {USER_AGENT}",
        "Accept: text/html, text/plain, */*",
        "Accept-Encoding: identity",
        "Connection: close",
        "",
        "",
    ]
    return "\r\n".join(headers).encode("ascii")


def parse_response(raw_response: bytes) -> tuple[dict[str, str], bytes]:
    header_blob, separator, body = raw_response.partition(b"\r\n\r\n")
    if not separator:
        raise ValueError("Received an invalid HTTP response")

    header_lines = header_blob.split(b"\r\n")
    headers: dict[str, str] = {}

    for raw_line in header_lines[1:]:
        line = raw_line.decode("iso-8859-1")
        key, _, value = line.partition(":")
        headers[key.strip().lower()] = value.strip()

    if headers.get("transfer-encoding", "").lower() == "chunked":
        body = decode_chunked(body)

    return headers, body


def ensure_url_scheme(url: str) -> str:
    if "://" not in url:
        return f"https://{url}"
    return url


def fetch_url(url: str, *, redirect_limit: int = MAX_REDIRECTS) -> tuple[str, dict[str, str], bytes]:
    normalized_url = ensure_url_scheme(url)
    parsed = urlsplit(normalized_url)

    if parsed.scheme not in {"http", "https"}:
        raise ValueError(f"Unsupported scheme: {parsed.scheme}")
    if not parsed.hostname:
        raise ValueError("URL must include a hostname")

    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    path = parsed.path or "/"
    if parsed.query:
        path = f"{path}?{parsed.query}"

    with socket.create_connection((parsed.hostname, port), timeout=DEFAULT_TIMEOUT) as sock:
        sock.settimeout(DEFAULT_TIMEOUT)
        stream: socket.socket | ssl.SSLSocket
        if parsed.scheme == "https":
            context = ssl.create_default_context()
            stream = context.wrap_socket(sock, server_hostname=parsed.hostname)
        else:
            stream = sock
        with stream:
            host_header = parsed.hostname if parsed.port is None else parsed.netloc
            stream.sendall(build_request(host_header, path))
            raw_response = recv_all(stream)

    headers, body = parse_response(raw_response)
    status_line = raw_response.split(b"\r\n", 1)[0].decode("iso-8859-1")
    _, status_code_text, _ = status_line.split(" ", 2)
    status_code = int(status_code_text)

    if status_code in {301, 302, 303, 307, 308}:
        if redirect_limit <= 0:
            raise RuntimeError("Too many redirects")
        location = headers.get("location")
        if not location:
            raise RuntimeError("Redirect response did not include a Location header")
        redirect_url = urljoin(normalized_url, location)
        return fetch_url(redirect_url, redirect_limit=redirect_limit - 1)

    return normalized_url, headers, body


def format_response(headers: dict[str, str], body: bytes) -> str:
    try:
        return body.decode("utf-8", errors="replace").strip()
    except Exception:
        return f"Binary response ({len(body)} bytes)"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="go2web",
        description="Fetch a URL or search the web without using HTTP client libraries.",
        add_help=False,
        formatter_class=argparse.RawTextHelpFormatter,
    )
    actions = parser.add_mutually_exclusive_group(required=False)
    actions.add_argument("-u", metavar="URL", help="make an HTTP request to the specified URL and print the response")
    actions.add_argument(
        "-s",
        metavar="SEARCH",
        nargs="+",
        help="search the term and print top 10 results",
    )
    parser.add_argument("-h", "--help", action="help", help="show this help")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.u is None and args.s is None:
        parser.print_help(sys.stderr)
        return 1

    try:
        if args.u is not None:
            url, headers, body = fetch_url(args.u)
            print(format_response(headers, body))
            return 0

        print("Search is not yet implemented.")
        return 1

    except (OSError, socket.timeout, ValueError, RuntimeError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
