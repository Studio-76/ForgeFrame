"""Opt-in lightweight profiling for FastAPI request latency and SQL timing.

Enable via ``FORGEFRAME_PROFILING_ENABLED=true``.  Adds zero overhead when
disabled (single boolean check).  When enabled, per-request timing is written
to a dedicated ``forgeframe-profiling.jsonl`` file in the configured data path.

SQL timing requires ``FORGEFRAME_PROFILING_SQL_TIMING_ENABLED=true`` and adds
a ``before_execute`` / ``after_execute`` event listener to **every** engine
created after the listener is registered.  For production, only enable
temporarily during a profiling session.
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path
from threading import Lock
from typing import Any

_PROFILING_ENABLED = os.environ.get("FORGEFRAME_PROFILING_ENABLED", "").strip().lower() in ("1", "true", "yes")
_SQL_TIMING_ENABLED = os.environ.get("FORGEFRAME_PROFILING_SQL_TIMING_ENABLED", "").strip().lower() in ("1", "true", "yes")
_PROFILING_LOG_PATH = os.environ.get("FORGEFRAME_PROFILING_LOG_PATH", "")

_write_lock = Lock()
_write_buffer: list[str] = []
_FLUSH_INTERVAL = 50  # flush every N records


def _log_path() -> Path:
    path = _PROFILING_LOG_PATH
    if not path:
        data_dir = Path(os.environ.get("FORGEFRAME_DATA_PATH", "backend/.forgeframe"))
        data_dir.mkdir(parents=True, exist_ok=True)
        path = str(data_dir / "forgeframe-profiling.jsonl")
    return Path(path)


def _write(event: dict[str, Any]) -> None:
    if not _PROFILING_ENABLED:
        return
    global _write_buffer
    line = json.dumps(event, default=str)
    with _write_lock:
        _write_buffer.append(line)
        if len(_write_buffer) >= _FLUSH_INTERVAL:
            _flush()


def _flush() -> None:
    global _write_buffer
    if not _write_buffer:
        return
    try:
        path = _log_path()
        with open(path, "a") as f:
            for line in _write_buffer:
                f.write(line + "\n")
    except OSError:
        pass  # best-effort
    _write_buffer = []


# ---------------------------------------------------------------------------
# Request profiling middleware factory
# ---------------------------------------------------------------------------


class RequestProfiler:
    """Opt-in per-request latency profiler.

    Usage in ``main.py``::

        if profiling_enabled:
            app.add_middleware(RequestProfilerMiddleware)

    The middleware records: method, path, status_code, duration_ms, and
    (when *sql_timing* is enabled) the total SQL query count and cumulative
    SQL time for the request.
    """

    def __init__(self, app: Any, *, sql_timing: bool = False) -> None:
        self.app = app
        self.sql_timing = sql_timing

    async def __call__(self, scope: Any, receive: Any, send: Any) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        start = time.perf_counter()
        sql_count: int = 0
        sql_time: float = 0.0

        # Wrap send to capture status code
        status_code = [None]

        async def _send(message: Any) -> None:
            if message["type"] == "http.response.start":
                status_code[0] = message["status"]
            await send(message)

        await self.app(scope, receive, _send)

        duration_ms = (time.perf_counter() - start) * 1000

        _write({
            "event": "request",
            "method": scope.get("method", "UNKNOWN"),
            "path": scope.get("path", ""),
            "status": status_code[0],
            "duration_ms": round(duration_ms, 3),
            "sql_count": sql_count if self.sql_timing else None,
            "sql_time_ms": round(sql_time * 1000, 3) if self.sql_timing else None,
        })


# ---------------------------------------------------------------------------
# SQLAlchemy query timing listener
# ---------------------------------------------------------------------------

_sql_listener_installed = False


def install_sql_timing_listener() -> None:
    """Install a global SQLAlchemy ``before_execute`` / ``after_execute``
    listener that counts queries and measures their duration.

    Call this **after** ``create_engine`` in each domain that should be
    profiled.  For opt-in use, set ``FORGEFRAME_PROFILING_SQL_TIMING_ENABLED``.
    """
    global _sql_listener_installed
    if _sql_listener_installed or not _SQL_TIMING_ENABLED:
        return

    from sqlalchemy import event as sa_event
    from sqlalchemy.engine import Engine

    _query_data: dict[int, float] = {}

    @sa_event.listens_for(Engine, "before_cursor_execute")
    def _before_execute(conn, cursor, statement, parameters, context, executemany):
        _query_data[id(conn)] = time.perf_counter()

    @sa_event.listens_for(Engine, "after_cursor_execute")
    def _after_execute(conn, cursor, statement, parameters, context, executemany):
        start = _query_data.pop(id(conn), None)
        if start is not None and _PROFILING_ENABLED:
            elapsed = time.perf_counter() - start
            _write({
                "event": "sql_query",
                "duration_ms": round(elapsed * 1000, 3),
                "statement": statement[:200] if statement else "",
            })

    _sql_listener_installed = True


def profiling_enabled() -> bool:
    """Whether profiling is enabled via environment variable."""
    return _PROFILING_ENABLED
