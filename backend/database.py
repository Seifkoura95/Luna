"""
Database connection for Luna Group VIP API.

TLS workarounds for Atlas M0 + Railway Nixpacks (OpenSSL 3.x):
- tlsCAFile: use certifi's up-to-date CA bundle instead of OS trust store.
- tlsDisableOCSPEndpointCheck: Atlas's OCSP responder sometimes times out
  behind Railway's egress, which OpenSSL 3.x interprets as a handshake
  failure (alert 80). Disabling the OCSP check sidesteps this.
- serverSelectionTimeoutMS: fail fast on connection issues.
"""

import os
import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']

client_kwargs = {
    "serverSelectionTimeoutMS": 10000,
}
if mongo_url.startswith("mongodb+srv://") or "tls=true" in mongo_url.lower():
    client_kwargs.update({
        "tls": True,
        "tlsCAFile": certifi.where(),
        "tlsDisableOCSPEndpointCheck": True,
        "retryWrites": True,
    })

client = AsyncIOMotorClient(mongo_url, **client_kwargs)
db = client[os.environ['DB_NAME']]
