#!/usr/bin/env python3
"""Static file server for the exploded-view page.

Caching is disabled so that edits show up on a plain reload. Binds to
127.0.0.1 by default; reach it from another machine through an SSH tunnel.
"""

import argparse
import functools
import http.server
from pathlib import Path


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8642)
    parser.add_argument("--bind", default="127.0.0.1")
    parser.add_argument(
        "--directory",
        default=str(Path(__file__).resolve().parent / "exploded-views"),
    )
    args = parser.parse_args()

    handler = functools.partial(NoCacheHandler, directory=args.directory)
    with http.server.ThreadingHTTPServer((args.bind, args.port), handler) as httpd:
        print(
            f"Serving {args.directory} on http://{args.bind}:{httpd.server_address[1]}/",
            flush=True,
        )
        httpd.serve_forever()


if __name__ == "__main__":
    main()
