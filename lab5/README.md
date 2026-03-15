# Go2web — Lab 5: Raw Socket CLI Browser

`go2web` is a small command-line web client for Lab 5. It performs HTTP and HTTPS requests using raw sockets, then prints the result in a readable terminal format.

## What It Does

- `go2web -u <URL>` fetches a page and prints its readable content
- `go2web -s <search term>` searches DuckDuckGo HTML and prints the top 10 results
- `go2web -h` shows the CLI help

## How It Works

1. Parse the CLI arguments
2. Open a TCP connection with `socket`
3. Wrap the socket with `ssl` for HTTPS
4. Send a handcrafted HTTP `GET` request
5. Read the raw response from the server
6. Convert HTML into visible text with `html.parser`

## CLI

```bash
go2web -u <URL>         # make an HTTP request to the specified URL and print the response
go2web -s <search-term> # search the term and print top 10 results
go2web -h               # show this help
```

## Tech Stack

- **Python 3** — application runtime
- **socket** — raw TCP communication
- **ssl** — TLS for HTTPS requests
- **html.parser** — readable HTML-to-text conversion

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

```bash
./go2web -h
./go2web -u https://example.com
./go2web -s raw sockets python
```

On Windows:

```bat
go2web.cmd -h
go2web.cmd -u https://example.com
```
