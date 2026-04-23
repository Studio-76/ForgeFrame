"""Ingress / TLS operator endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from app.ingress import build_ingress_tls_status, run_tls_renewal
from app.settings.config import get_settings

router = APIRouter(prefix="/ingress", tags=["admin-ingress"])


@router.get("/tls")
def get_ingress_tls_status() -> dict[str, object]:
    status = build_ingress_tls_status(get_settings())
    return {"status": "ok", **status.model_dump()}


@router.post("/tls/renew")
def renew_ingress_tls() -> dict[str, object]:
    result = run_tls_renewal(get_settings())
    return {"status": "ok", "renewal": result}
