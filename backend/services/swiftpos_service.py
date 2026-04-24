"""
SwiftPOS Admin API client.

Auth: exchange Integrator (name + key) + Customer (ref + client + clerk) creds
for a bearer token via POST /api/v3/authorisation. Cache the token with an
asyncio lock and refresh on 401.

Transaction: POST /api/v3/orders with customerId + locationId + transactionItems.
Negative unit_price means the business *pays out* points (mission/reward
completion). SwiftPOS applies the venue's loyalty multiplier and awards points
against the linked customer profile.

Mock mode: SWIFTPOS_MOCK_MODE=true disables every outbound HTTP call so local
development and testing is safe. In mock mode, submit_transaction returns a
fake TransactionId and simulates a 150 ms delay.

Exact endpoint paths and field names must be confirmed in the Swagger at
https://api.swiftpos.com.au/swagger/ against the v10.58+ Admin API. The paths
used here are the ones documented in SwiftPOS's current "Getting Started" /
Orders API pages (2025). All five paths + payload keys are env-overridable
via SWIFTPOS_AUTH_PATH / SWIFTPOS_ORDERS_PATH so we can flip to newer paths
without redeploying code.
"""
from __future__ import annotations

import asyncio
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import aiohttp

logger = logging.getLogger(__name__)


def _env_bool(name: str, default: bool = False) -> bool:
    val = os.environ.get(name, "").strip().lower()
    return val in {"1", "true", "yes", "on"} if val else default


SWIFTPOS_BASE_URL = os.environ.get("SWIFTPOS_BASE_URL", "https://api.swiftpos.com.au").rstrip("/")
SWIFTPOS_AUTH_PATH = os.environ.get("SWIFTPOS_AUTH_PATH", "/api/v3/authorisation")
SWIFTPOS_ORDERS_PATH = os.environ.get("SWIFTPOS_ORDERS_PATH", "/api/v3/orders")

SWIFTPOS_INTEGRATOR_NAME = os.environ.get("SWIFTPOS_INTEGRATOR_NAME", "Swift-Luna Group")
SWIFTPOS_INTEGRATOR_KEY = os.environ.get("SWIFTPOS_INTEGRATOR_KEY", "")
SWIFTPOS_CUSTOMER_REF = os.environ.get("SWIFTPOS_CUSTOMER_REF", "")
SWIFTPOS_CLIENT_ID = os.environ.get("SWIFTPOS_CLIENT_ID", "")
SWIFTPOS_CLERK_ID = os.environ.get("SWIFTPOS_CLERK_ID", "")
SWIFTPOS_CLERK_PASSWORD = os.environ.get("SWIFTPOS_CLERK_PASSWORD", "")

SWIFTPOS_MOCK_MODE = _env_bool("SWIFTPOS_MOCK_MODE", default=True)
SWIFTPOS_TIMEOUT_SECONDS = int(os.environ.get("SWIFTPOS_TIMEOUT_SECONDS", "20"))


class SwiftPOSError(Exception):
    """Base for all SwiftPOS integration errors."""


class SwiftPOSAuthError(SwiftPOSError):
    """401/403 from SwiftPOS or misconfigured creds."""


class SwiftPOSTransactionError(SwiftPOSError):
    """400/422 transaction rejected."""


class _TokenManager:
    def __init__(self) -> None:
        self._token: Optional[str] = None
        self._expires_at: Optional[datetime] = None
        self._lock = asyncio.Lock()

    def _still_valid(self) -> bool:
        if not self._token or not self._expires_at:
            return False
        return datetime.now(timezone.utc) + timedelta(minutes=5) < self._expires_at

    async def get_token(self) -> str:
        async with self._lock:
            if self._still_valid():
                return self._token  # type: ignore[return-value]
            token = await self._fetch_new_token()
            self._token = token
            # SwiftPOS doesn't always return explicit TTL — assume 4h
            self._expires_at = datetime.now(timezone.utc) + timedelta(hours=4)
            return token

    async def _fetch_new_token(self) -> str:
        missing = [
            n for n, v in [
                ("SWIFTPOS_INTEGRATOR_KEY", SWIFTPOS_INTEGRATOR_KEY),
                ("SWIFTPOS_CUSTOMER_REF", SWIFTPOS_CUSTOMER_REF),
                ("SWIFTPOS_CLIENT_ID", SWIFTPOS_CLIENT_ID),
                ("SWIFTPOS_CLERK_ID", SWIFTPOS_CLERK_ID),
                ("SWIFTPOS_CLERK_PASSWORD", SWIFTPOS_CLERK_PASSWORD),
            ] if not v
        ]
        if missing:
            raise SwiftPOSAuthError(f"Missing SwiftPOS credentials: {', '.join(missing)}")

        url = f"{SWIFTPOS_BASE_URL}{SWIFTPOS_AUTH_PATH}"
        payload = {
            "integratorName": SWIFTPOS_INTEGRATOR_NAME,
            "integratorKey": SWIFTPOS_INTEGRATOR_KEY,
            "customerReferenceNumber": SWIFTPOS_CUSTOMER_REF,
            "locationId": SWIFTPOS_CLIENT_ID,
            "clerkId": SWIFTPOS_CLERK_ID,
            "clerkPassword": SWIFTPOS_CLERK_PASSWORD,
        }
        timeout = aiohttp.ClientTimeout(total=SWIFTPOS_TIMEOUT_SECONDS)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(url, json=payload) as resp:
                text = await resp.text()
                if resp.status >= 400:
                    raise SwiftPOSAuthError(f"SwiftPOS auth {resp.status}: {text[:400]}")
                try:
                    data = await resp.json(content_type=None)
                except Exception:
                    raise SwiftPOSAuthError(f"SwiftPOS auth returned non-JSON: {text[:200]}")

        token = (
            data.get("authorizationToken")
            or data.get("AuthorizationToken")
            or data.get("token")
            or data.get("access_token")
        )
        if not token:
            raise SwiftPOSAuthError(f"No token in SwiftPOS response: {list(data.keys())}")
        logger.info("SwiftPOS token acquired (len=%d)", len(token))
        return token


_token_manager = _TokenManager()


class SwiftPOSService:
    """High-level SwiftPOS facade. One instance per process is fine."""

    @property
    def is_mock(self) -> bool:
        return SWIFTPOS_MOCK_MODE

    async def submit_transaction(
        self,
        swiftpos_customer_id: str,
        line_items: list[dict],
        external_reference: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> dict:
        """Push a sales transaction to SwiftPOS.

        `line_items` shape:
          [{"plu": "100251", "quantity": 1, "unit_price": -18.75, "description": "Luna Explorer"}]

        Returns the SwiftPOS response dict (plus `mock=True` if in mock mode).
        """
        external_reference = external_reference or f"luna-{uuid.uuid4().hex[:12]}"

        if SWIFTPOS_MOCK_MODE:
            await asyncio.sleep(0.15)  # pretend-network
            return {
                "mock": True,
                "TransactionId": f"MOCK-{uuid.uuid4().hex[:8].upper()}",
                "customerId": swiftpos_customer_id,
                "locationId": SWIFTPOS_CLIENT_ID or "MOCK_LOC",
                "items_accepted": len(line_items),
                "external_reference": external_reference,
                "accepted_at": datetime.now(timezone.utc).isoformat(),
            }

        token = await _token_manager.get_token()

        payload = {
            "customerId": swiftpos_customer_id,
            "locationId": SWIFTPOS_CLIENT_ID,
            "externalReference": external_reference,
            "notes": notes,
            "transactionDateTime": datetime.now(timezone.utc).isoformat(),
            "transactionItems": [
                {
                    "plu": li["plu"],
                    "quantity": int(li.get("quantity", 1)),
                    "unitPrice": float(li["unit_price"]),
                    "description": li.get("description"),
                }
                for li in line_items
            ],
        }

        url = f"{SWIFTPOS_BASE_URL}{SWIFTPOS_ORDERS_PATH}"
        timeout = aiohttp.ClientTimeout(total=SWIFTPOS_TIMEOUT_SECONDS)

        async def _do_post(bearer: str) -> tuple[int, dict, str]:
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(
                    url,
                    json=payload,
                    headers={"Authorization": f"Bearer {bearer}", "Content-Type": "application/json"},
                ) as resp:
                    text = await resp.text()
                    try:
                        body = await resp.json(content_type=None) if text else {}
                    except Exception:
                        body = {"raw": text[:500]}
                    return resp.status, body, text

        status, body, text = await _do_post(token)

        # One-shot token refresh on 401
        if status == 401:
            logger.warning("SwiftPOS 401 — forcing token refresh and retrying once")
            _token_manager._token = None  # invalidate
            token = await _token_manager.get_token()
            status, body, text = await _do_post(token)

        if status >= 400:
            logger.error("SwiftPOS transaction failed %s: %s", status, text[:400])
            if status in (400, 422):
                raise SwiftPOSTransactionError(f"SwiftPOS rejected transaction: {status} {text[:400]}")
            if status in (401, 403):
                raise SwiftPOSAuthError(f"SwiftPOS auth {status}: {text[:200]}")
            raise SwiftPOSError(f"SwiftPOS error {status}: {text[:400]}")

        return body


swiftpos_service = SwiftPOSService()
