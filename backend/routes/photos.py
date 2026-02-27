"""
Photos and Media API endpoints
"""
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse
from typing import Optional
from pathlib import Path

from database import db
from utils.auth import get_current_user
from utils.mongo import clean_mongo_docs
from luna_venues_config import LUNA_VENUES

router = APIRouter(tags=["Photos"])

ROOT_DIR = Path(__file__).parent.parent

VENUE_PHOTO_FOLDERS = {
    "eclipse": "eclipse",
    "after_dark": "afterdark",
    "su_casa_brisbane": "sucasa-brisbane",
    "su_casa_gold_coast": "sucasa-goldcoast",
}


@router.get("/photos")
async def get_user_photos(request: Request, venue_id: Optional[str] = None):
    """Get photos user is tagged in"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    query = {"tagged_users": current_user["user_id"]}
    if venue_id:
        query["venue_id"] = venue_id
    photos = await db.photos.find(query).sort("created_at", -1).to_list(100)
    return clean_mongo_docs(photos)


@router.get("/photos/venues")
async def get_venue_galleries():
    """Get list of all venue photo galleries with counts"""
    galleries = []
    photos_dir = ROOT_DIR / "static" / "photos"
    
    for venue_id, folder_name in VENUE_PHOTO_FOLDERS.items():
        folder_path = photos_dir / folder_name
        if folder_path.exists():
            photos = list(folder_path.glob("*.jpg")) + list(folder_path.glob("*.jpeg")) + list(folder_path.glob("*.png"))
            
            venue = LUNA_VENUES.get(venue_id, {})
            
            galleries.append({
                "venue_id": venue_id,
                "venue_name": venue.get("name", venue_id),
                "folder": folder_name,
                "photo_count": len(photos),
                "cover_image": f"/api/photos/image/{folder_name}/{photos[0].name}" if photos else None,
                "accent_color": venue.get("accent_color", "#E31837"),
            })
    
    return galleries


@router.get("/photos/venue/{venue_id}")
async def get_venue_photos(venue_id: str):
    """Get all photos for a specific venue"""
    folder_name = VENUE_PHOTO_FOLDERS.get(venue_id)
    if not folder_name:
        raise HTTPException(status_code=404, detail="Venue gallery not found")
    
    photos_dir = ROOT_DIR / "static" / "photos" / folder_name
    if not photos_dir.exists():
        return []
    
    photos = []
    for ext in ["*.jpg", "*.jpeg", "*.png"]:
        for photo_path in photos_dir.glob(ext):
            photos.append({
                "id": photo_path.stem,
                "filename": photo_path.name,
                "url": f"/api/photos/image/{folder_name}/{photo_path.name}",
                "venue_id": venue_id,
                "likes": 0,
                "tagged": [],
            })
    
    return photos


@router.get("/photos/image/{folder}/{filename}")
async def serve_photo(folder: str, filename: str):
    """Serve a photo file"""
    valid_folders = list(VENUE_PHOTO_FOLDERS.values())
    if folder not in valid_folders:
        raise HTTPException(status_code=404, detail="Invalid folder")
    
    photo_path = ROOT_DIR / "static" / "photos" / folder / filename
    if not photo_path.exists():
        raise HTTPException(status_code=404, detail="Photo not found")
    
    return FileResponse(
        photo_path,
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=86400"}
    )


@router.get("/video/background")
async def serve_background_video():
    """Serve the background video file"""
    video_path = ROOT_DIR / "static" / "video" / "background.mp4"
    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Video not found")
    
    return FileResponse(
        video_path,
        media_type="video/mp4",
        headers={
            "Cache-Control": "public, max-age=86400",
            "Accept-Ranges": "bytes"
        }
    )
