"""
SwiftPOS Middleware for Luna Group VIP App
==========================================

Standalone middleware service that bridges SwiftPOS POS terminals
with the Luna loyalty API. Supports all 3 integration methods:

1. Orders API (Cloud REST) — polls for completed sales
2. POS API (Direct Terminal, port 33300) — real-time sale events
3. Order Webhooks — receives push notifications from SwiftPOS

Run: python swiftpos_middleware.py
Config: Set environment variables or edit SWIFTPOS_CONFIG below.

Requirements: pip install requests aiohttp
"""

import os
import time
import json
import hmac
import hashlib
import logging
import asyncio
from datetime import datetime, timezone
from typing import Optional
import requests

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger("swiftpos_middleware")

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION — Set these via environment variables or edit directly
# ═══════════════════════════════════════════════════════════════════════════════

SWIFTPOS_CONFIG = {
    # ── SwiftPOS Credentials (get from your SwiftPOS reseller) ──
    "cloud_client_id": os.environ.get("SWIFTPOS_CLOUD_CLIENT_ID", ""),
    "clerk_id": os.environ.get("SWIFTPOS_CLERK_ID", ""),
    "clerk_password": os.environ.get("SWIFTPOS_CLERK_PASSWORD", ""),
    "location_id": os.environ.get("SWIFTPOS_LOCATION_ID", ""),
    
    # ── SwiftPOS API URLs ──
    "orders_api_url": os.environ.get("SWIFTPOS_ORDERS_API_URL", "https://pos-api.swiftpos.com.au"),
    "pos_api_host": os.environ.get("SWIFTPOS_POS_API_HOST", "localhost"),
    "pos_api_port": int(os.environ.get("SWIFTPOS_POS_API_PORT", "33300")),
    
    # ── Luna API ──
    "luna_api_url": os.environ.get("LUNA_API_URL", "https://your-luna-app.com"),
    "luna_webhook_key": os.environ.get("SWIFTPOS_WEBHOOK_KEY", ""),
    
    # ── Integration Mode ──
    # "orders_api" | "pos_api" | "webhook" | "poll"
    "mode": os.environ.get("SWIFTPOS_MODE", "poll"),
    
    # ── Polling interval (seconds) for poll mode ──
    "poll_interval": int(os.environ.get("SWIFTPOS_POLL_INTERVAL", "30")),
    
    # ── Venue mapping: SwiftPOS Location ID → Luna venue_id ──
    "venue_map": {
        # "1": "eclipse",
        # "2": "after_dark",
        # Add your mappings here
    },
}


# ═══════════════════════════════════════════════════════════════════════════════
# SWIFTPOS API CLIENT
# ═══════════════════════════════════════════════════════════════════════════════

class SwiftPOSClient:
    """Handles authentication and communication with SwiftPOS APIs"""
    
    def __init__(self, config: dict):
        self.config = config
        self.token: Optional[str] = None
        self.token_expiry: float = 0
    
    def authenticate(self) -> bool:
        """Authenticate with SwiftPOS Orders API and get a session token"""
        if self.token and time.time() < self.token_expiry:
            return True
            
        url = f"{self.config['orders_api_url']}/api/authorise"
        payload = {
            "CloudClientId": self.config["cloud_client_id"],
            "ClerkId": self.config["clerk_id"],
            "Password": self.config["clerk_password"],
            "LocationId": self.config["location_id"],
        }
        
        try:
            resp = requests.post(url, json=payload, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                self.token = data.get("Token") or data.get("token")
                self.token_expiry = time.time() + 3500  # ~1hr token
                logger.info("Authenticated with SwiftPOS Orders API")
                return True
            else:
                logger.error(f"SwiftPOS auth failed: {resp.status_code} {resp.text}")
                return False
        except Exception as e:
            logger.error(f"SwiftPOS auth error: {e}")
            return False
    
    def get_headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }
    
    def get_recent_sales(self, since_minutes: int = 5) -> list:
        """Poll SwiftPOS for recent completed sales (Orders API)"""
        if not self.authenticate():
            return []
        
        url = f"{self.config['orders_api_url']}/api/sales"
        try:
            resp = requests.get(url, headers=self.get_headers(), timeout=10)
            if resp.status_code == 200:
                return resp.json() if isinstance(resp.json(), list) else resp.json().get("Sales", [])
            else:
                logger.warning(f"Get sales failed: {resp.status_code}")
                return []
        except Exception as e:
            logger.error(f"Get sales error: {e}")
            return []
    
    def lookup_member(self, member_key: str) -> Optional[dict]:
        """Look up a member by their SwiftPOS member number"""
        if not self.authenticate():
            return None
        
        url = f"{self.config['orders_api_url']}/api/members/{member_key}"
        try:
            resp = requests.get(url, headers=self.get_headers(), timeout=10)
            if resp.status_code == 200:
                return resp.json()
            return None
        except Exception as e:
            logger.error(f"Member lookup error: {e}")
            return None


# ═══════════════════════════════════════════════════════════════════════════════
# LUNA API CLIENT
# ═══════════════════════════════════════════════════════════════════════════════

class LunaAPIClient:
    """Sends sale data to the Luna loyalty webhook"""
    
    def __init__(self, config: dict):
        self.api_url = config["luna_api_url"]
        self.webhook_key = config["luna_webhook_key"]
    
    def send_sale(self, sale: dict) -> dict:
        """Send a completed sale to the Luna /api/perks/swiftpos/sale endpoint"""
        url = f"{self.api_url}/api/perks/swiftpos/sale"
        headers = {
            "Content-Type": "application/json",
            "X-SwiftPOS-Key": self.webhook_key,
        }
        
        try:
            resp = requests.post(url, json=sale, headers=headers, timeout=10)
            result = resp.json()
            
            if result.get("success") and result.get("matched"):
                logger.info(
                    f"Points awarded: {result['total_points']}pts to {result.get('member_name', '?')} "
                    f"(${sale['total_amount']:.2f}, receipt {sale['receipt_number']})"
                )
            elif not result.get("matched"):
                logger.warning(
                    f"Unmatched sale: receipt {sale['receipt_number']} — "
                    f"member_key={sale.get('member_key')}, email={sale.get('member_email')}"
                )
            
            return result
        except Exception as e:
            logger.error(f"Failed to send sale to Luna: {e}")
            return {"success": False, "error": str(e)}


# ═══════════════════════════════════════════════════════════════════════════════
# SALE PROCESSOR
# ═══════════════════════════════════════════════════════════════════════════════

class SaleProcessor:
    """Converts SwiftPOS sale data into Luna webhook format"""
    
    def __init__(self, config: dict):
        self.venue_map = config.get("venue_map", {})
        self.processed_receipts: set = set()
    
    def convert_sale(self, swiftpos_sale: dict) -> Optional[dict]:
        """Convert a SwiftPOS sale object to Luna webhook format"""
        receipt = str(swiftpos_sale.get("ReceiptNo") or swiftpos_sale.get("receipt_no") or "")
        
        # Skip already-processed sales
        if receipt in self.processed_receipts:
            return None
        
        # Extract fields (SwiftPOS uses PascalCase)
        location_id = str(swiftpos_sale.get("LocationId") or swiftpos_sale.get("location_id") or "")
        member_key = swiftpos_sale.get("MemberKey") or swiftpos_sale.get("member_key")
        member_email = swiftpos_sale.get("MemberEmail") or swiftpos_sale.get("member_email")
        terminal_id = str(swiftpos_sale.get("TerminalId") or swiftpos_sale.get("terminal_id") or "POS")
        total = float(swiftpos_sale.get("Total") or swiftpos_sale.get("total") or 0)
        payment_method = swiftpos_sale.get("PaymentMethod") or swiftpos_sale.get("payment_method") or "card"
        
        # Skip zero/negative sales
        if total <= 0:
            return None
        
        # Map SwiftPOS location to Luna venue
        venue_id = self.venue_map.get(location_id, f"unknown_{location_id}")
        
        # Extract line items if available
        items = []
        for item in (swiftpos_sale.get("Items") or swiftpos_sale.get("items") or []):
            items.append({
                "name": item.get("Description") or item.get("name") or "",
                "qty": item.get("Quantity") or item.get("qty") or 1,
                "price": float(item.get("Amount") or item.get("price") or 0),
                "category": item.get("Category") or item.get("category") or "",
            })
        
        luna_sale = {
            "terminal_id": terminal_id,
            "receipt_number": receipt,
            "member_key": member_key,
            "member_email": member_email,
            "venue_id": venue_id,
            "total_amount": total,
            "items": items if items else None,
            "payment_method": payment_method,
            "timestamp": swiftpos_sale.get("Timestamp") or datetime.now(timezone.utc).isoformat(),
        }
        
        self.processed_receipts.add(receipt)
        
        # Keep set from growing unbounded
        if len(self.processed_receipts) > 10000:
            self.processed_receipts = set(list(self.processed_receipts)[-5000:])
        
        return luna_sale


# ═══════════════════════════════════════════════════════════════════════════════
# MIDDLEWARE MODES
# ═══════════════════════════════════════════════════════════════════════════════

def run_poll_mode(config: dict):
    """Poll SwiftPOS Orders API for new sales at regular intervals"""
    logger.info(f"Starting POLL mode (interval: {config['poll_interval']}s)")
    
    swiftpos = SwiftPOSClient(config)
    luna = LunaAPIClient(config)
    processor = SaleProcessor(config)
    
    while True:
        try:
            sales = swiftpos.get_recent_sales()
            for sale in sales:
                luna_sale = processor.convert_sale(sale)
                if luna_sale:
                    luna.send_sale(luna_sale)
        except Exception as e:
            logger.error(f"Poll cycle error: {e}")
        
        time.sleep(config["poll_interval"])


def run_webhook_server(config: dict):
    """
    Run a local HTTP server that receives SwiftPOS Order Webhooks.
    Configure SwiftPOS Back Office > Loyalty System > Order Webhooks
    to POST to this server's URL.
    """
    from http.server import HTTPServer, BaseHTTPRequestHandler
    
    luna = LunaAPIClient(config)
    processor = SaleProcessor(config)
    
    class WebhookHandler(BaseHTTPRequestHandler):
        def do_POST(self):
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            
            try:
                sale_data = json.loads(body)
                luna_sale = processor.convert_sale(sale_data)
                
                if luna_sale:
                    result = luna.send_sale(luna_sale)
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps(result).encode())
                else:
                    self.send_response(200)
                    self.end_headers()
                    self.wfile.write(b'{"status":"skipped"}')
            except Exception as e:
                logger.error(f"Webhook error: {e}")
                self.send_response(500)
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
        
        def log_message(self, *args):
            pass  # Suppress default logging
    
    port = int(os.environ.get("WEBHOOK_PORT", "8099"))
    server = HTTPServer(("0.0.0.0", port), WebhookHandler)
    logger.info(f"Starting WEBHOOK server on port {port}")
    logger.info(f"Configure SwiftPOS to POST to: http://<this-server>:{port}/")
    server.serve_forever()


# ═══════════════════════════════════════════════════════════════════════════════
# TEST SIMULATOR — Use this to verify your Luna integration works
# ═══════════════════════════════════════════════════════════════════════════════

def run_test_simulator(config: dict):
    """Simulate SwiftPOS sales to test the Luna integration end-to-end"""
    luna = LunaAPIClient(config)
    
    test_sales = [
        {
            "terminal_id": "POS-TEST-01",
            "receipt_number": f"TEST-{int(time.time())}",
            "member_email": "luna@test.com",
            "venue_id": "eclipse",
            "total_amount": 85.50,
            "payment_method": "card",
            "items": [
                {"name": "Espresso Martini x2", "qty": 2, "price": 40.00, "category": "drinks"},
                {"name": "Wagyu Sliders", "qty": 1, "price": 25.50, "category": "food"},
                {"name": "Moet Glass", "qty": 1, "price": 20.00, "category": "drinks"},
            ],
        },
        {
            "terminal_id": "POS-TEST-02",
            "receipt_number": f"TEST-{int(time.time()) + 1}",
            "member_key": "SPOS-12345",
            "venue_id": "after_dark",
            "total_amount": 150.00,
            "payment_method": "card",
        },
        {
            "terminal_id": "POS-TEST-03",
            "receipt_number": f"TEST-{int(time.time()) + 2}",
            "member_email": "unknown@nobody.com",
            "venue_id": "su_casa_brisbane",
            "total_amount": 45.00,
            "payment_method": "cash",
        },
    ]
    
    logger.info("=" * 60)
    logger.info("SWIFTPOS → LUNA TEST SIMULATOR")
    logger.info("=" * 60)
    
    for i, sale in enumerate(test_sales, 1):
        logger.info(f"\n--- Test {i}/{len(test_sales)} ---")
        logger.info(f"Receipt: {sale['receipt_number']}")
        logger.info(f"Amount: ${sale['total_amount']:.2f} at {sale['venue_id']}")
        logger.info(f"Member: key={sale.get('member_key', 'N/A')}, email={sale.get('member_email', 'N/A')}")
        
        result = luna.send_sale(sale)
        
        if result.get("success") and result.get("matched"):
            logger.info(f"RESULT: {result['total_points']}pts awarded to {result.get('member_name', '?')}")
            logger.info(f"New balance: {result.get('new_balance', '?')}")
        elif result.get("matched") is False:
            logger.info(f"RESULT: Sale logged as unmatched (member not found in Luna)")
        else:
            logger.info(f"RESULT: {result}")
    
    logger.info("\n" + "=" * 60)
    logger.info("Test complete! Check Luna admin panel for results.")
    logger.info("=" * 60)


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import sys
    
    mode = sys.argv[1] if len(sys.argv) > 1 else SWIFTPOS_CONFIG["mode"]
    
    if mode == "test":
        run_test_simulator(SWIFTPOS_CONFIG)
    elif mode == "poll":
        run_poll_mode(SWIFTPOS_CONFIG)
    elif mode == "webhook":
        run_webhook_server(SWIFTPOS_CONFIG)
    else:
        print("""
SwiftPOS Middleware for Luna Group
Usage: python swiftpos_middleware.py [mode]

Modes:
  test      Run test simulator (sends fake sales to Luna API)
  poll      Poll SwiftPOS Orders API for new sales
  webhook   Start webhook server for SwiftPOS Order Webhooks

Environment variables: See SWIFTPOS_CONFIG in this file.
        """)
