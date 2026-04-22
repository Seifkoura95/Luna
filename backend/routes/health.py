"""
Health check endpoints

- GET /api/health       — shallow liveness check (no downstream calls)
- GET /api/health/deep  — pings MongoDB, CherryHub OAuth, Resend. Use this to
                          confirm prod is fully wired after each deploy.
"""
import os
import time
import asyncio
import logging
from datetime import datetime, timezone

import aiohttp
from fastapi import APIRouter

from database import db

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_check():
    """Shallow liveness check — just confirms the process is up."""
    return {
        "status": "healthy",
        "service": "Luna Group VIP API",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ─── Deep health ──────────────────────────────────────────────────────────────

async def _check_mongo() -> dict:
    started = time.perf_counter()
    try:
        await db.command("ping")
        return {"ok": True, "latency_ms": round((time.perf_counter() - started) * 1000, 1)}
    except Exception as e:
        return {"ok": False, "error": str(e)[:200]}


async def _check_cherryhub() -> dict:
    """Try to obtain a CherryHub access token via client_credentials."""
    client_id = os.environ.get("CHERRYHUB_CLIENT_ID", "")
    client_secret = os.environ.get("CHERRYHUB_CLIENT_SECRET", "")
    base_url = os.environ.get("CHERRYHUB_API_URL", "https://api.cherryhub.com.au")
    mock_mode = os.environ.get("CHERRYHUB_MOCK_MODE", "false").lower() == "true"

    if mock_mode:
        return {"ok": True, "mode": "mock", "note": "CHERRYHUB_MOCK_MODE=true"}

    if not client_id or not client_secret:
        return {"ok": False, "error": "CHERRYHUB_CLIENT_ID or CHERRYHUB_CLIENT_SECRET missing"}

    started = time.perf_counter()
    try:
        timeout = aiohttp.ClientTimeout(total=10)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(
                f"{base_url}/oauth2/v2.0/token",
                data={
                    "grant_type": "client_credentials",
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "scope": "Members-Points.Manage Members-Points.Read Members.Read",
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            ) as resp:
                latency = round((time.perf_counter() - started) * 1000, 1)
                if resp.status == 200:
                    data = await resp.json()
                    return {
                        "ok": True,
                        "mode": "live",
                        "latency_ms": latency,
                        "token_expires_in": data.get("expires_in"),
                    }
                text = (await resp.text())[:200]
                return {"ok": False, "mode": "live", "status": resp.status, "latency_ms": latency, "error": text}
    except Exception as e:
        return {"ok": False, "mode": "live", "error": str(e)[:200]}


async def _check_resend() -> dict:
    """Hit Resend's GET /domains to validate the API key (doesn't send any email)."""
    api_key = os.environ.get("RESEND_API_KEY", "")
    if not api_key:
        return {"ok": False, "error": "RESEND_API_KEY missing"}

    started = time.perf_counter()
    try:
        timeout = aiohttp.ClientTimeout(total=10)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(
                "https://api.resend.com/domains",
                headers={"Authorization": f"Bearer {api_key}"},
            ) as resp:
                latency = round((time.perf_counter() - started) * 1000, 1)
                if resp.status == 200:
                    data = await resp.json()
                    domains = data.get("data", []) if isinstance(data, dict) else []
                    return {
                        "ok": True,
                        "latency_ms": latency,
                        "verified_domains": [d.get("name") for d in domains if d.get("status") == "verified"],
                    }
                return {"ok": False, "status": resp.status, "latency_ms": latency}
    except Exception as e:
        return {"ok": False, "error": str(e)[:200]}


@router.get("/health/deep")
async def health_deep():
    """Deep health check — pings MongoDB, CherryHub OAuth, Resend in parallel.

    Returns 200 regardless of individual check status — caller should inspect
    the `ok` field on each sub-check and the overall `status`.
    """
    mongo, cherryhub, resend = await asyncio.gather(
        _check_mongo(),
        _check_cherryhub(),
        _check_resend(),
    )

    all_ok = bool(mongo.get("ok") and cherryhub.get("ok") and resend.get("ok"))

    return {
        "status": "healthy" if all_ok else "degraded",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "checks": {
            "mongo": mongo,
            "cherryhub": cherryhub,
            "resend": resend,
        },
    }
