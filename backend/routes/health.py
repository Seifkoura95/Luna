"""
Health check endpoints

- GET /api/health         — shallow liveness check (no downstream calls)
- GET /api/health/deep    — pings MongoDB, CherryHub OAuth, Resend. Use this to
                            confirm prod is fully wired after each deploy.
- GET /api/health/version — git commit SHA + build/boot time + marker endpoints.
                            Hit this after every Railway redeploy to confirm
                            new code is actually live.
"""
import os
import time
import asyncio
import logging
import subprocess
from datetime import datetime, timezone

import aiohttp
from fastapi import APIRouter

from database import db

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Health"])

# Capture boot time once at import. This tells you when the container started
# (i.e. when the current deploy went live) regardless of what git thinks.
_BOOT_TIME_UTC = datetime.now(timezone.utc)


def _git_sha() -> dict:
    """Resolve the currently-deployed git commit.

    Railway injects RAILWAY_GIT_COMMIT_SHA automatically on every deploy — that
    is the source of truth in production. Locally we fall back to `git rev-parse`.
    """
    sha = (
        os.environ.get("RAILWAY_GIT_COMMIT_SHA")
        or os.environ.get("GIT_COMMIT_SHA")
        or os.environ.get("SOURCE_COMMIT")
        or ""
    )
    source = "railway_env" if os.environ.get("RAILWAY_GIT_COMMIT_SHA") else None

    if not sha:
        try:
            sha = subprocess.check_output(
                ["git", "rev-parse", "HEAD"],
                cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                stderr=subprocess.DEVNULL,
                timeout=2,
            ).decode().strip()
            source = "git_command"
        except Exception:
            sha = ""

    short = sha[:7] if sha else None

    commit_message = os.environ.get("RAILWAY_GIT_COMMIT_MESSAGE")
    if not commit_message and sha:
        try:
            commit_message = subprocess.check_output(
                ["git", "log", "-1", "--pretty=%s", sha],
                cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                stderr=subprocess.DEVNULL,
                timeout=2,
            ).decode().strip()
        except Exception:
            commit_message = None

    return {
        "sha_short": short,
        "sha_full": sha or None,
        "source": source or "unknown",
        "commit_message": (commit_message[:120] if commit_message else None),
        "branch": os.environ.get("RAILWAY_GIT_BRANCH"),
        "author": os.environ.get("RAILWAY_GIT_AUTHOR"),
    }


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



@router.get("/health/version")
async def health_version():
    """Deploy-verification endpoint.

    Returns the git SHA of the currently-running code, boot time, uptime, and
    a list of **marker endpoints** that were added in this session (session 18).
    Hit this after every Railway redeploy — if any marker shows `available: false`,
    the deploy is still stale.
    """
    now = datetime.now(timezone.utc)
    uptime_seconds = int((now - _BOOT_TIME_UTC).total_seconds())

    # Marker endpoints — routes that only exist on "session 18 or later" code.
    # We resolve by asking FastAPI's own router (via Request is tricky in a GET
    # handler; simpler to hard-code the list and confirm each one via import).
    markers = {
        "safety_admin": _route_exists("/api/admin/safety/summary"),
        "push_broadcasts_audience_preview": _route_exists("/api/admin/push-broadcasts/audience-preview"),
        "push_broadcasts_users_search": _route_exists("/api/admin/push-broadcasts/users-search"),
        "auction_image_upload": _route_exists("/api/venue-admin/auctions/upload-image"),
        "leaderboard_daily_prize": _route_exists("/api/leaderboard/daily-prize"),
        "leaderboard_award_now": _route_exists("/api/leaderboard/admin/award-now"),
        "cherryhub_probe": _route_exists("/api/cherryhub/admin/probe"),
    }

    def _fmt_uptime(s: int) -> str:
        d, s = divmod(s, 86400)
        h, s = divmod(s, 3600)
        m, s = divmod(s, 60)
        parts = []
        if d: parts.append(f"{d}d")
        if h: parts.append(f"{h}h")
        if m: parts.append(f"{m}m")
        parts.append(f"{s}s")
        return " ".join(parts)

    return {
        "service": "Luna Group VIP API",
        "git": _git_sha(),
        "boot_time_utc": _BOOT_TIME_UTC.isoformat(),
        "server_time_utc": now.isoformat(),
        "uptime_seconds": uptime_seconds,
        "uptime_human": _fmt_uptime(uptime_seconds),
        "platform": {
            "environment": os.environ.get("RAILWAY_ENVIRONMENT") or os.environ.get("ENV") or "local",
            "deployment_id": os.environ.get("RAILWAY_DEPLOYMENT_ID"),
            "service_name": os.environ.get("RAILWAY_SERVICE_NAME"),
            "python_version": os.environ.get("PYTHON_VERSION") or _python_version(),
        },
        "markers": markers,
        "all_markers_available": all(m["available"] for m in markers.values()),
    }


def _python_version() -> str:
    import sys
    return f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"


def _route_exists(path: str) -> dict:
    """Return whether a given route path is registered in the running app.

    We reach the FastAPI app via the `server` module's global `app` reference.
    Done lazily to avoid a circular import at module load.
    """
    try:
        from server import app  # lazy
        for route in app.routes:
            if getattr(route, "path", None) == path:
                return {"available": True, "methods": sorted(list(getattr(route, "methods", []) or []))}
        return {"available": False, "methods": []}
    except Exception as e:
        return {"available": False, "error": str(e)[:100]}
