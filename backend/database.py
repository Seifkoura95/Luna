"""
Database connection and initialization for Luna Group VIP API

Uses `certifi` CA bundle explicitly for TLS — fixes Atlas TLS handshake
failures on Railway / Nixpacks containers that ship an old/incomplete
system trust store.
"""

import os
import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']

# Only pass tlsCAFile for SRV (Atlas) URLs — local mongodb:// doesn't use TLS.
client_kwargs = {}
if mongo_url.startswith("mongodb+srv://") or "tls=true" in mongo_url.lower():
    client_kwargs["tlsCAFile"] = certifi.where()

client = AsyncIOMotorClient(mongo_url, **client_kwargs)
db = client[os.environ['DB_NAME']]
