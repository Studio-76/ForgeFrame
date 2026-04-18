"""Database bootstrap helpers for ForgeGate storage."""

from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


def build_postgres_engine(database_url: str):
    if not database_url.startswith("postgresql"):
        raise ValueError("PostgreSQL engine requires a postgresql:// URL.")
    return create_engine(database_url, pool_pre_ping=True)


def build_session_factory(engine):
    return sessionmaker(engine, autoflush=False, expire_on_commit=False)
