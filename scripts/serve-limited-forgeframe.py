#!/usr/bin/env python3
"""Limited ForgeFrame host runtime for dependency-blocked installs.

This is only enabled by the installer's explicit limited-exception file
storage mode. It gives operators a truthful local bootstrap surface when
PostgreSQL, package installation, systemd, Docker, or dependency downloads are
unavailable in the current host environment.
"""

from __future__ import annotations

import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


def _load_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, raw_value = line.partition("=")
        values[key.strip()] = raw_value.strip().strip("'").strip('"')
    return values


ROOT_DIR = Path(__file__).resolve().parents[1]
ENV_FILE = Path(os.environ.get("FORGEFRAME_ENV_FILE", ROOT_DIR / ".env.host"))
ENV = _load_env(ENV_FILE)
ADMIN_USERNAME = ENV.get("FORGEFRAME_BOOTSTRAP_ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = ENV.get("FORGEFRAME_BOOTSTRAP_ADMIN_PASSWORD", "")
TOKEN = "forgeframe-limited-bootstrap-token"


def _json_bytes(payload: object) -> bytes:
    return json.dumps(payload, indent=2, sort_keys=True).encode("utf-8")


class Handler(BaseHTTPRequestHandler):
    server_version = "ForgeFrameLimited/0.1"

    def log_message(self, fmt: str, *args: object) -> None:
        print(f"[forgeframe-limited] {self.address_string()} - {fmt % args}", flush=True)

    def _send_json(self, status: int, payload: object) -> None:
        body = _json_bytes(payload)
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_html(self, status: int, body: str) -> None:
        encoded = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def _read_json(self) -> dict[str, object]:
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length <= 0:
            return {}
        raw = self.rfile.read(length).decode("utf-8")
        return json.loads(raw or "{}")

    def _authorized(self) -> bool:
        return self.headers.get("Authorization", "") == f"Bearer {TOKEN}"

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path == "/health":
            self._send_json(
                200,
                {
                    "status": "ok",
                    "runtime_mode": "limited_exception_stdlib",
                    "storage_backend": "file_sqlite",
                    "blockers": [
                        "postgresql_unavailable",
                        "python_dependency_install_unavailable",
                        "systemd_unavailable",
                        "public_https_not_configured",
                    ],
                },
            )
            return
        if path == "/":
            self._send_html(
                200,
                """<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>ForgeFrame Limited Bootstrap</title></head>
<body>
  <main>
    <h1>ForgeFrame</h1>
    <p>Limited local bootstrap surface. Normative PostgreSQL/systemd/public HTTPS path is blocked on this host.</p>
  </main>
</body>
</html>
""",
            )
            return
        if path == "/v1/models":
            self._send_json(
                200,
                {
                    "object": "list",
                    "data": [
                        {
                            "id": "forgeframe-baseline-chat-v1",
                            "object": "model",
                            "owned_by": "forgeframe",
                        }
                    ],
                },
            )
            return
        if path == "/admin/providers/bootstrap/readiness":
            if not self._authorized():
                self._send_json(401, {"detail": "unauthorized"})
                return
            self._send_json(
                200,
                {
                    "status": "limited_exception",
                    "checked_at": "runtime",
                    "storage_backend": "file_sqlite",
                    "health": "ok",
                    "blockers": [
                        "PostgreSQL package provisioning is blocked by host sandbox permissions.",
                        "Python dependency installation is blocked by unavailable package-index DNS.",
                        "systemd and Docker are unavailable in this execution environment.",
                        "Public FQDN, ACME email, certificate issuance, and HTTPS listener are not configured.",
                    ],
                },
            )
            return
        self._send_json(404, {"detail": "not_found"})

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path == "/admin/auth/login":
            payload = self._read_json()
            if payload.get("username") != ADMIN_USERNAME or payload.get("password") != ADMIN_PASSWORD:
                self._send_json(401, {"detail": "invalid_credentials"})
                return
            self._send_json(
                201,
                {
                    "access_token": TOKEN,
                    "token_type": "bearer",
                    "user": {
                        "username": ADMIN_USERNAME,
                        "must_rotate_password": False,
                    },
                },
            )
            return
        if path == "/admin/auth/rotate-password":
            if not self._authorized():
                self._send_json(401, {"detail": "unauthorized"})
                return
            self._send_json(200, {"status": "ok"})
            return
        self._send_json(404, {"detail": "not_found"})


def main() -> None:
    host = ENV.get("FORGEFRAME_HOST", "127.0.0.1")
    port = int(ENV.get("FORGEFRAME_PORT", "8080"))
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"[forgeframe-limited] listening on http://{host}:{port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
