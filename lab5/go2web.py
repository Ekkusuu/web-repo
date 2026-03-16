#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import socket
import ssl
import sys
from html import unescape
from html.parser import HTMLParser
from typing import Iterable
from urllib.parse import parse_qs, quote_plus, unquote, urljoin, urlsplit


USER_AGENT = "go2web/1.0"
DEFAULT_TIMEOUT = 10
MAX_REDIRECTS = 5
SEARCH_ENDPOINT = "https://html.duckduckgo.com/html/?q={query}"


class SearchResultsParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.results: list[tuple[str, str]] = []
        self._capture_href: str | None = None
        self._capture_text: list[str] = []
        self._seen_urls: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "a":
            return
        attr_map = {key.lower(): (value or "") for key, value in attrs}
        href = attr_map.get("href", "").strip()
        if not href:
            return
        normalized_href = normalize_result_url(href)
        if not normalized_href.startswith(("http://", "https://")):
            return
        if normalized_href in self._seen_urls:
            return
        self._capture_href = normalized_href
        self._capture_text = []

    def handle_data(self, data: str) -> None:
        if self._capture_href is not None:
            text = normalize_whitespace(unescape(data))
            if text.strip():
                self._capture_text.append(text)

    def handle_endtag(self, tag: str) -> None:
        if tag != "a" or self._capture_href is None:
            return
        title = normalize_whitespace(" ".join(self._capture_text))
        if title:
            self._seen_urls.add(self._capture_href)
            self.results.append((title, self._capture_href))
        self._capture_href = None
        self._capture_text = []


def normalize_result_url(url: str) -> str:
    if url.startswith("//"):
        url = f"https:{url}"
    parsed = urlsplit(url)
    if parsed.netloc.endswith("duckduckgo.com"):
        query = parse_qs(parsed.query)
        target = query.get("uddg")
        if target:
            return unquote(target[0])
        return ""
    return url


def fetch_search_results(query_terms: Iterable[str]) -> list[tuple[str, str]]:
    query = " ".join(query_terms).strip()
    if not query:
        raise ValueError("Search term cannot be empty")
    search_url = SEARCH_ENDPOINT.format(query=quote_plus(query))
    _, headers, body = fetch_url(search_url)
    html = body.decode("utf-8", errors="replace")
    parser = SearchResultsParser()
    parser.feed(html)
    return parser.results[:10]


def format_search_results(query_terms: Iterable[str], results: list[tuple[str, str]]) -> str:
    query = " ".join(query_terms).strip()
    if not results:
        return f'No results found for "{query}".'
    lines = [f'Top {len(results)} results for "{query}":']
    for index, (title, url) in enumerate(results, start=1):
        lines.append(f"{index}. {title}")
        lines.append(f"   {url}")
    return "\n".join(lines)


class VisibleTextExtractor(HTMLParser):
    BLOCK_TAGS = {
        "address", "article", "aside", "blockquote", "br", "div", "dl",
        "fieldset", "figcaption", "figure", "footer", "form",
        "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "li",
        "main", "nav", "ol", "p", "pre", "section", "table", "tr", "ul",
    }
    HIDDEN_TAGS = {"head", "noscript", "script", "style", "svg", "title"}

    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []
        self.hidden_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in self.HIDDEN_TAGS:
            self.hidden_depth += 1
        elif tag in self.BLOCK_TAGS:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in self.HIDDEN_TAGS and self.hidden_depth:
            self.hidden_depth -= 1
        elif tag in self.BLOCK_TAGS:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if self.hidden_depth:
            return
        text = normalize_whitespace(unescape(data))
        if text.strip():
            self.parts.append(text)

    def get_text(self) -> str:
        merged = "".join(self.parts)
        lines = [normalize_whitespace(line) for line in merged.splitlines()]
        return "\n".join(line for line in lines if line.strip())


def normalize_whitespace(value: str) -> str:
    return " ".join(value.split())


def render_html(body: str) -> str:
    parser = VisibleTextExtractor()
    parser.feed(body)
    text = parser.get_text()
    return text or "[No visible text content found]"


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
        "Accept: text/html, application/json;q=0.9, text/plain;q=0.8, */*;q=0.5",
        "Accept-Language: en-US,en;q=0.8",
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


def render_json(body: str) -> str:
    data = json.loads(body)
    return json.dumps(data, indent=2, ensure_ascii=True)


def format_response(headers: dict[str, str], body: bytes) -> str:
    text_body = body.decode("utf-8", errors="replace")
    content_type = headers.get("content-type", "").split(";", 1)[0].strip().lower()

    if content_type == "application/json" or text_body.lstrip().startswith(("{", "[")):
        try:
            return render_json(text_body)
        except json.JSONDecodeError:
            pass

    if content_type in {"text/html", "application/xhtml+xml"} or "<html" in text_body.lower():
        return render_html(text_body)

    if content_type.startswith("text/") or not content_type:
        return text_body.strip()

    return f"Binary response: {content_type or 'unknown content type'} ({len(body)} bytes)"


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

        results = fetch_search_results(args.s)
        print(format_search_results(args.s, results))
        return 0

    except (OSError, socket.timeout, ValueError, RuntimeError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
