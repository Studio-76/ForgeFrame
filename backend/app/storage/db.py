"""Database bootstrap helpers for ForgeFrame storage.

Centralised engine creation with sensible pool defaults for production.

Connection pool sizing
----------------------
There are **8 independent PostgreSQL engines** (one per domain repository).
The default ``pool_size=5`` + ``max_overflow=10`` means each engine can use
up to 15 connections, for a **worst-case 120 connections across all engines**.
Tune ``FORGEFRAME_DB_POOL_*`` env vars for your deployment's ``max_connections``.

Pool env vars are read at engine-creation time (not import time) so tests
that mutate ``os.environ`` work correctly.
"""

from __future__ import annotations

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# NOTE: These values are read inside build_postgres_engine(), not at module
# level, so monkeypatching os.environ in tests works correctly.  The module-
# level constants below are *documentation defaults* — they are only used
# when the env var is not set.
_DEFAULT_POOL_SIZE = 5
_DEFAULT_POOL_OVERFLOW = 10
_DEFAULT_POOL_RECYCLE = 3600
_DEFAULT_POOL_TIMEOUT = 30


def get_pool_config() -> dict[str, int]:
    """Return pool configuration dict read from environment at call time.

    :returns: Pool keyword arguments for ``create_engine``.
    :rtype: dict[str, int]
    """
    return {
        "pool_size": int(os.environ.get("FORGEFRAME_DB_POOL_SIZE", str(_DEFAULT_POOL_SIZE))),
        "max_overflow": int(os.environ.get("FORGEFRAME_DB_POOL_OVERFLOW", str(_DEFAULT_POOL_OVERFLOW))),
        "pool_recycle": int(os.environ.get("FORGEFRAME_DB_POOL_RECYCLE_SECONDS", str(_DEFAULT_POOL_RECYCLE))),
        "pool_timeout": int(os.environ.get("FORGEFRAME_DB_POOL_TIMEOUT_SECONDS", str(_DEFAULT_POOL_TIMEOUT))),
    }


def build_postgres_engine(database_url: str, **kwargs):
    """Build a PostgreSQL engine with tuned connection pool settings.

    Pool configuration is read from environment variables on every call,
    so changes to ``os.environ`` after import are respected.

    :param database_url: PostgreSQL connection URL.
    :type database_url: str
    :param kwargs: Additional ``create_engine`` keyword arguments.
    :returns: Configured SQLAlchemy engine.
    :raises ValueError: When *database_url* is not a PostgreSQL URL.
    """
    if not database_url.startswith("postgresql"):
        raise ValueError("PostgreSQL engine requires a postgresql:// URL.")
    return create_engine(
        database_url,
        pool_pre_ping=True,
        **get_pool_config(),
        **kwargs,
    )


def build_session_factory(engine):
    """Build a session factory with standard ForgeFrame defaults.

    ``autoflush=False`` and ``expire_on_commit=False`` avoid common
    SQLAlchemy ORM performance pitfalls.

    :param engine: Configured SQLAlchemy engine.
    :type engine: Engine
    :returns: ``sessionmaker`` bound to *engine*.
    :rtype: sessionmaker
    """
    return sessionmaker(engine, autoflush=False, expire_on_commit=False)
