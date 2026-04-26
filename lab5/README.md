# Go2web — Lab 5: Raw Socket CLI Browser

`go2web` is a terminal-based mini browser and search client built for Lab 5. The application sends HTTP and HTTPS requests manually through TCP sockets and prints readable output directly in the console.

## What's New in Lab 5

- **Low-level HTTP client** — requests are made with `socket` and `ssl` instead of standard HTTP libraries
- **CLI interface** — supports fetching URLs, searching the web, and printing usage help
- **Readable output** — HTML pages are converted into visible text and JSON responses are formatted for the terminal
- **Search integration** — DuckDuckGo HTML search is parsed and displayed as the top 10 results
- **Bonus features** — redirect support, local response caching, and opening a selected search result from the CLI

## CLI

```bash
go2web -u <URL>         # make an HTTP request to the specified URL and print the response
go2web -s <search-term> # search the term and print top 10 results
go2web -h               # show this help
```

Bonus option implemented:

```bash
go2web -s <search-term> --open <N>
```

## How It Works

1. Parse command-line arguments with `argparse`
2. Open a raw TCP connection to the target server with `socket`
3. Wrap the socket in TLS using `ssl` for HTTPS requests
4. Send a handcrafted HTTP `GET` request
5. Read the raw response bytes and parse headers/body manually
6. Follow redirects and reuse cached responses when available
7. Render HTML, JSON, or plain text into a terminal-friendly format

## Tech Stack

- **Python 3** — application runtime
- **socket** — TCP client implementation
- **ssl** — HTTPS support
- **html.parser** — HTML text extraction and search result parsing
- **json** — JSON formatting and cache metadata storage

## Project Structure

```text
lab5/
├── WEB-LAB5.md
├── README.md
├── go2web
├── go2web.cmd
├── go2web.py
└── assets/
    └── go2web-demo.gif
```

## Running

From `lab5/`:

```bash
./go2web -h
./go2web -u https://example.com
./go2web -s raw sockets python
./go2web -s raw sockets python --open 1
```

On Windows Command Prompt:

```bat
go2web.cmd -h
go2web.cmd -u https://example.com
```

## Notes

- Cache files are stored in `lab5/.go2web_cache/`
- Search uses DuckDuckGo's HTML endpoint so results can be parsed without a browser
- The executable entry point is named `go2web`, matching the lab requirement
