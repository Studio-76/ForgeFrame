#!/usr/bin/env python3
"""Minimal HTTP helper for ACME HTTP-01 and HTTPS redirects."""

from __future__ import annotations

import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit


WEBROOT = Path(os.environ.get("FORGEFRAME_PUBLIC_TLS_WEBROOT_PATH", "/var/lib/forgeframe/acme-webroot"))
FQDN = os.environ.get("FORGEFRAME_PUBLIC_FQDN", "").strip()
HOST = os.environ.get("FORGEFRAME_PUBLIC_HTTP_HELPER_HOST", "0.0.0.0")
PORT = int(os.environ.get("FORGEFRAME_PUBLIC_HTTP_HELPER_PORT", "80"))


class AcmeHelperHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802
        parsed = urlsplit(self.path)
        if parsed.path.startswith("/.well-known/acme-challenge/"):
            relative = parsed.path.removeprefix("/.well-known/acme-challenge/")
            target = WEBROOT / ".well-known" / "acme-challenge" / relative
            if target.exists() and target.is_file():
                payload = target.read_bytes()
                self.send_response(200)
                self.send_header("Content-Type", "text/plain; charset=utf-8")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
                return
            self.send_error(404, "challenge_not_found")
            return

        redirect_host = FQDN or (self.headers.get("Host") or "")
        redirect_target = f"https://{redirect_host}{self.path}" if redirect_host else self.path
        self.send_response(301)
        self.send_header("Location", redirect_target)
        self.end_headers()

    def log_message(self, format: str, *args) -> None:  # noqa: A003
        return


def main() -> int:
    WEBROOT.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer((HOST, PORT), AcmeHelperHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        return 0
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
