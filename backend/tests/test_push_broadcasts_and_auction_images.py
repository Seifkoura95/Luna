"""
Iteration 38 — Luna VIP backend tests for:
  1) Push broadcasts admin routes (audience-preview, users-search, send-test, CRUD, scheduled dispatcher)
  2) Venue admin auction image upload + serve (multipart / base64 / path traversal)

Cleans up every artifact it creates (broadcasts, notifications, auctions, uploaded image files).
"""
import io
import os
import time
import base64
import asyncio
import sys
from pathlib import Path

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "https://luna-mobile-stage.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip("/")

ADMIN_EMAIL = "admin@lunagroup.com.au"
ADMIN_PASSWORD = "Trent69!"
USER_EMAIL = "luna@test.com"
USER_PASSWORD = "test123"

# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text[:200]}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_user(admin_token):
    r = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
    assert r.status_code == 200
    return r.json()


@pytest.fixture(scope="session")
def user_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": USER_EMAIL, "password": USER_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"user login failed: {r.status_code} {r.text[:200]}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def user_headers(user_token):
    return {"Authorization": f"Bearer {user_token}"}


# Track artifacts we create so we can delete them at the end
_created_broadcast_ids: list[str] = []
_created_auction_ids: list[str] = []
_uploaded_filenames: list[str] = []


@pytest.fixture(scope="session", autouse=True)
def _cleanup(admin_headers):
    yield
    # Broadcast cleanup
    for bid in _created_broadcast_ids:
        try:
            requests.delete(f"{BASE_URL}/api/admin/push-broadcasts/{bid}", headers=admin_headers, timeout=15)
        except Exception:
            pass
    # Auction cleanup (direct mongo would be ideal but DELETE endpoint suffices)
    for aid in _created_auction_ids:
        try:
            requests.delete(f"{BASE_URL}/api/venue-admin/auctions/{aid}", headers=admin_headers, timeout=15)
        except Exception:
            pass
    # Uploaded image files
    upload_dir = Path("/app/backend/uploads/auctions")
    for fname in _uploaded_filenames:
        try:
            (upload_dir / fname).unlink(missing_ok=True)
        except Exception:
            pass


# ── Push Broadcasts: audience-preview ────────────────────────────────────────

class TestAudiencePreview:
    def test_preview_all_excludes_sample_users(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/push-broadcasts/audience-preview?audience=all", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "user_count" in data and "with_push_token_count" in data and "sample_names" in data
        assert isinstance(data["user_count"], int)
        assert isinstance(data["with_push_token_count"], int)
        assert isinstance(data["sample_names"], list)
        assert data["with_push_token_count"] <= data["user_count"]
        # sample_users must be excluded — verify by checking none of the sample_names look like sample seed users
        for n in data["sample_names"]:
            assert "sample_user_" not in (n or "")

    def test_preview_user_luna(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/push-broadcasts/audience-preview?audience=user:{USER_EMAIL}", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["user_count"] == 1, f"Expected 1, got {data}"
        assert data["with_push_token_count"] == 1, f"Luna should have a test token: {data}"

    def test_preview_users_list(self, admin_headers):
        # Get luna's user_id first
        r1 = requests.post(f"{BASE_URL}/api/auth/login", json={"email": USER_EMAIL, "password": USER_PASSWORD}, timeout=30)
        uid = r1.json()["user"]["user_id"]
        r = requests.get(f"{BASE_URL}/api/admin/push-broadcasts/audience-preview?audience=users:{uid}", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["user_count"] == 1, data
        assert data["with_push_token_count"] == 1, data

    def test_preview_tier_gold(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/push-broadcasts/audience-preview?audience=tier:gold", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "user_count" in data
        # Tier:gold should match only gold-tier users — bounded count
        assert data["user_count"] >= 0
        assert data["with_push_token_count"] <= data["user_count"]

    def test_preview_non_admin_denied(self, user_headers):
        r = requests.get(f"{BASE_URL}/api/admin/push-broadcasts/audience-preview?audience=all", headers=user_headers, timeout=30)
        assert r.status_code in (401, 403), f"non-admin got {r.status_code}: {r.text[:200]}"


# ── Push Broadcasts: users-search ────────────────────────────────────────────

class TestUsersSearch:
    def test_search_short_query_returns_empty(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/push-broadcasts/users-search?q=l", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        assert r.json().get("users") == []

    def test_search_lun(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/push-broadcasts/users-search?q=lun", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data.get("users"), list)
        # at least luna should show up (has push token)
        emails = [u.get("email", "").lower() for u in data["users"]]
        assert any("lun" in e for e in emails), f"Expected 'lun' match, got: {emails}"

    def test_search_non_admin_denied(self, user_headers):
        r = requests.get(f"{BASE_URL}/api/admin/push-broadcasts/users-search?q=lun", headers=user_headers, timeout=30)
        assert r.status_code in (401, 403)


# ── Push Broadcasts: CRUD + send-test ────────────────────────────────────────

class TestBroadcastCrudAndTest:
    def test_create_broadcast_literal_audience(self, admin_headers):
        payload = {
            "title": "TEST_user_audience",
            "body": "testing user:email literal audience",
            "deep_link": "home",
            "audience": f"user:{USER_EMAIL}",
            "status": "draft",
        }
        r = requests.post(f"{BASE_URL}/api/admin/push-broadcasts", json=payload, headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["audience"] == f"user:{USER_EMAIL}", f"Audience normalized! got: {data['audience']}"
        assert data["status"] == "draft"
        assert "id" in data
        _created_broadcast_ids.append(data["id"])

        # Verify via GET /{id}
        g = requests.get(f"{BASE_URL}/api/admin/push-broadcasts/{data['id']}", headers=admin_headers, timeout=30)
        assert g.status_code == 200
        assert g.json()["audience"] == f"user:{USER_EMAIL}"

    def test_list_broadcasts(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/push-broadcasts", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        assert "broadcasts" in r.json()

    def test_update_broadcast(self, admin_headers):
        # create a fresh draft first
        r = requests.post(f"{BASE_URL}/api/admin/push-broadcasts",
                          json={"title": "TEST_upd", "body": "b", "audience": "all", "status": "draft"},
                          headers=admin_headers, timeout=30)
        bid = r.json()["id"]
        _created_broadcast_ids.append(bid)

        u = requests.put(f"{BASE_URL}/api/admin/push-broadcasts/{bid}",
                         json={"title": "TEST_upd_v2"}, headers=admin_headers, timeout=30)
        assert u.status_code == 200, u.text
        assert u.json()["broadcast"]["title"] == "TEST_upd_v2"

    def test_send_test_to_admin_only(self, admin_headers):
        # Create a draft
        r = requests.post(f"{BASE_URL}/api/admin/push-broadcasts",
                          json={"title": "TEST_preview", "body": "preview body", "audience": "all", "status": "draft"},
                          headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        bid = r.json()["id"]
        _created_broadcast_ids.append(bid)

        t = requests.post(f"{BASE_URL}/api/admin/push-broadcasts/{bid}/test", headers=admin_headers, timeout=30)
        # Admin may not have a push token in test env — accept either success or the explicit 400 "no push token" branch
        if t.status_code == 400 and "no push token" in t.text.lower():
            pytest.skip("Admin has no push token registered — /test endpoint correctly returned 400")
        assert t.status_code == 200, t.text
        body = t.json()
        assert body.get("success") is True
        assert "tokens_used" in body
        assert "tokens_accepted_by_expo" in body

        # Must NOT flip status to sent
        g = requests.get(f"{BASE_URL}/api/admin/push-broadcasts/{bid}", headers=admin_headers, timeout=30)
        assert g.json()["status"] == "draft", f"send-test flipped status! {g.json()}"

    def test_send_test_non_admin_denied(self, admin_headers, user_headers):
        r = requests.post(f"{BASE_URL}/api/admin/push-broadcasts",
                          json={"title": "TEST_deny", "body": "b", "audience": "all", "status": "draft"},
                          headers=admin_headers, timeout=30)
        bid = r.json()["id"]
        _created_broadcast_ids.append(bid)

        t = requests.post(f"{BASE_URL}/api/admin/push-broadcasts/{bid}/test", headers=user_headers, timeout=30)
        assert t.status_code in (401, 403), t.text

    def test_route_order_static_paths_not_treated_as_id(self, admin_headers):
        # Ensure /audience-preview & /users-search don't accidentally hit /{id}
        r1 = requests.get(f"{BASE_URL}/api/admin/push-broadcasts/audience-preview?audience=all", headers=admin_headers, timeout=30)
        assert r1.status_code == 200
        r2 = requests.get(f"{BASE_URL}/api/admin/push-broadcasts/users-search?q=lun", headers=admin_headers, timeout=30)
        assert r2.status_code == 200


# ── Scheduled dispatcher ─────────────────────────────────────────────────────

class TestScheduledDispatcher:
    def test_scheduled_broadcast_dispatches(self, admin_headers):
        from datetime import datetime, timezone, timedelta
        sched_time = (datetime.now(timezone.utc) + timedelta(seconds=2)).isoformat()
        payload = {
            "title": "TEST_sched",
            "body": "scheduled body",
            "audience": f"user:{USER_EMAIL}",
            "status": "scheduled",
            "scheduled_for": sched_time,
        }
        r = requests.post(f"{BASE_URL}/api/admin/push-broadcasts", json=payload, headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        bid = r.json()["id"]
        _created_broadcast_ids.append(bid)

        # wait until scheduled_for has passed
        time.sleep(4)

        # Invoke dispatcher directly
        sys.path.insert(0, "/app/backend")
        from services.push_broadcast_dispatcher import dispatch_due_push_broadcasts  # type: ignore
        summary = asyncio.run(dispatch_due_push_broadcasts())
        assert summary["fired"] >= 1, f"dispatcher fired 0 broadcasts: {summary}"

        # Verify broadcast status flipped to sent
        g = requests.get(f"{BASE_URL}/api/admin/push-broadcasts/{bid}", headers=admin_headers, timeout=30)
        assert g.status_code == 200
        got = g.json()
        assert got["status"] == "sent", f"expected sent, got {got['status']}"
        assert got.get("sent_at"), "sent_at missing"
        assert got.get("audience_size") == 1, f"audience_size wrong: {got.get('audience_size')}"

        # Verify a user_notifications row was inserted — fetch via luna's notifications endpoint or direct mongo-ish check.
        # We'll reuse the admin's list + cross-check in Mongo via a small helper: call list notifications endpoint if present.
        # If not, query via the admin mongo collection indirectly by decrementing broadcast `audience_size` check above.
        # (Direct mongo check below)
        from pymongo import MongoClient
        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        dbname = os.environ.get("DB_NAME", "test_database")
        client = MongoClient(mongo_url)
        count = client[dbname]["user_notifications"].count_documents({"broadcast_id": bid})
        client.close()
        assert count == 1, f"expected 1 user_notifications row, got {count}"


# ── Auction image upload ─────────────────────────────────────────────────────

# minimal 1×1 PNG
_PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO0Kv70AAAAASUVORK5CYII="
)


class TestAuctionImageUpload:
    def test_multipart_upload_then_serve(self, admin_headers):
        files = {"file": ("test.png", io.BytesIO(_PNG_BYTES), "image/png")}
        r = requests.post(f"{BASE_URL}/api/venue-admin/auctions/upload-image", files=files, headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        for key in ("image_id", "filename", "image_url", "relative_url", "size_bytes", "mime_type"):
            assert key in data, f"missing {key} in {data}"
        assert data["mime_type"] == "image/png"
        assert data["size_bytes"] == len(_PNG_BYTES)
        assert data["filename"].endswith(".png")
        _uploaded_filenames.append(data["filename"])

        # Fetch via GET (no auth)
        fetch_url = f"{BASE_URL}{data['relative_url']}"
        g = requests.get(fetch_url, timeout=30)
        assert g.status_code == 200, f"image fetch {fetch_url} failed: {g.status_code}"
        assert g.headers.get("content-type", "").startswith("image/png")
        assert g.content == _PNG_BYTES

    def test_json_base64_upload(self, admin_headers):
        data_url = "data:image/png;base64," + base64.b64encode(_PNG_BYTES).decode()
        r = requests.post(f"{BASE_URL}/api/venue-admin/auctions/upload-image",
                          json={"image": data_url}, headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        fname = r.json()["filename"]
        _uploaded_filenames.append(fname)

    def test_reject_non_image_mime(self, admin_headers):
        files = {"file": ("test.txt", io.BytesIO(b"hello world"), "text/plain")}
        r = requests.post(f"{BASE_URL}/api/venue-admin/auctions/upload-image", files=files, headers=admin_headers, timeout=30)
        assert r.status_code == 400, f"expected 400 for text/plain, got {r.status_code}: {r.text}"

    def test_upload_non_admin_denied(self, user_headers):
        files = {"file": ("test.png", io.BytesIO(_PNG_BYTES), "image/png")}
        r = requests.post(f"{BASE_URL}/api/venue-admin/auctions/upload-image", files=files, headers=user_headers, timeout=30)
        assert r.status_code in (401, 403), r.text

    def test_path_traversal_guard(self):
        # URL-encoded ../../etc/passwd
        r = requests.get(f"{BASE_URL}/api/venue-admin/auctions/image/..%2F..%2Fetc%2Fpasswd", timeout=30)
        assert r.status_code in (400, 404), f"path traversal not blocked: {r.status_code}"
        assert b"root:" not in r.content

    def test_put_auction_preserves_other_fields_on_image_only_update(self, admin_headers):
        # create an auction first
        c = requests.post(f"{BASE_URL}/api/venue-admin/auctions",
                          json={"title": "TEST_auc", "description": "orig desc", "starting_bid": 50,
                                "min_increment": 5, "duration_hours": 24, "venue_id": "eclipse",
                                "category": "vip_experience"},
                          headers=admin_headers, timeout=30)
        assert c.status_code == 200, c.text
        aid = c.json()["auction"]["id"]
        _created_auction_ids.append(aid)

        # upload image
        files = {"file": ("test.png", io.BytesIO(_PNG_BYTES), "image/png")}
        up = requests.post(f"{BASE_URL}/api/venue-admin/auctions/upload-image", files=files, headers=admin_headers, timeout=30)
        assert up.status_code == 200
        new_url = up.json()["image_url"]
        _uploaded_filenames.append(up.json()["filename"])

        # PUT only image_url
        p = requests.put(f"{BASE_URL}/api/venue-admin/auctions/{aid}",
                         json={"image_url": new_url}, headers=admin_headers, timeout=30)
        assert p.status_code == 200, p.text
        updated = p.json()["auction"]
        assert updated["image_url"] == new_url
        assert updated["title"] == "TEST_auc", "title was wiped by image-only PUT!"
        assert updated["description"] == "orig desc"
