"""
Boosts API endpoints
"""
from fastapi import APIRouter
from typing import Optional
from datetime import datetime, timezone

from database import db
from utils.mongo import clean_mongo_docs

router = APIRouter(prefix="/boosts", tags=["Boosts"])


@router.get("")
async def get_active_boosts(venue_id: Optional[str] = None):
    """Get currently active point boosts"""
    now = datetime.now(timezone.utc)
    query = {
        "start_time": {"$lte": now},
        "end_time": {"$gte": now}
    }
    if venue_id:
        query["$or"] = [
            {"venue_restriction": None},
            {"venue_restriction": venue_id}
        ]
    boosts = await db.boosts.find(query).to_list(10)
    return clean_mongo_docs(boosts)


@router.get("/upcoming")
async def get_upcoming_boosts(venue_id: Optional[str] = None):
    """Get upcoming point boosts"""
    now = datetime.now(timezone.utc)
    query = {"start_time": {"$gt": now}}
    if venue_id:
        query["$or"] = [
            {"venue_restriction": None},
            {"venue_restriction": venue_id}
        ]
    boosts = await db.boosts.find(query).sort("start_time", 1).to_list(10)
    return clean_mongo_docs(boosts)
