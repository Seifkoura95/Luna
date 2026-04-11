"""
Missions API endpoints with progress tracking
"""
from fastapi import APIRouter, HTTPException, Request
from typing import Optional
import uuid
from datetime import datetime, timezone

from database import db
from utils.auth import get_current_user
from utils.mongo import clean_mongo_docs
from models.rewards import MissionProgressRequest

router = APIRouter(prefix="/missions", tags=["Missions"])


@router.get("")
async def get_missions(request: Request, venue_id: Optional[str] = None):
    """Get missions with user progress"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    query = {"is_active": True}
    missions = await db.missions.find(query).to_list(100)
    
    if venue_id:
        missions = [m for m in missions if m.get("venue_requirements") is None or venue_id in m.get("venue_requirements", [])]
    
    # Get user's mission progress
    user_progress = await db.mission_progress.find({
        "user_id": current_user["user_id"]
    }).to_list(100)
    progress_map = {p["mission_id"]: p for p in user_progress}
    
    # Merge progress with missions
    for mission in missions:
        progress = progress_map.get(mission["id"], {})
        mission["completed"] = progress.get("completed", False)
        mission["progress"] = progress.get("progress", 0)
        mission["current_progress"] = progress.get("progress", 0)
        mission["claimed"] = progress.get("claimed", False)
        # Map fields for frontend compatibility
        mission["title"] = mission.get("name", mission.get("title", "Mission"))
        mission["target"] = mission.get("requirement_value", mission.get("target", 1))
    
    return clean_mongo_docs(missions)


@router.post("/progress")
async def update_mission_progress(request: Request, progress_req: MissionProgressRequest):
    """Update progress on a mission"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    mission = await db.missions.find_one({"id": progress_req.mission_id})
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    
    user_progress = await db.mission_progress.find_one({
        "user_id": current_user["user_id"],
        "mission_id": progress_req.mission_id
    })
    
    if user_progress and user_progress.get("completed"):
        return {"message": "Mission already completed", "progress": user_progress}
    
    new_progress = (user_progress.get("progress", 0) if user_progress else 0) + progress_req.progress_increment
    completed = new_progress >= mission.get("target", 1)
    
    await db.mission_progress.update_one(
        {"user_id": current_user["user_id"], "mission_id": progress_req.mission_id},
        {"$set": {
            "user_id": current_user["user_id"],
            "mission_id": progress_req.mission_id,
            "progress": new_progress,
            "completed": completed,
            "claimed": False,
            "updated_at": datetime.now(timezone.utc)
        }},
        upsert=True
    )
    
    return {
        "message": "Progress updated",
        "progress": new_progress,
        "target": mission.get("target", 1),
        "completed": completed
    }


@router.post("/{mission_id}/claim")
async def claim_mission_reward(request: Request, mission_id: str):
    """Claim reward for completed mission - one time only"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    mission = await db.missions.find_one({"id": mission_id})
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    
    user_progress = await db.mission_progress.find_one({
        "user_id": current_user["user_id"],
        "mission_id": mission_id
    })
    
    if not user_progress or not user_progress.get("completed"):
        raise HTTPException(status_code=400, detail="Mission not completed")
    
    if user_progress.get("claimed"):
        raise HTTPException(status_code=400, detail="Reward already claimed for this mission")
    
    points_reward = mission.get("points_reward", 0)
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$inc": {"points_balance": points_reward}}
    )
    
    await db.mission_progress.update_one(
        {"user_id": current_user["user_id"], "mission_id": mission_id},
        {"$set": {
            "claimed": True,
            "claimed_at": datetime.now(timezone.utc)
        }}
    )
    
    await db.points_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": current_user["user_id"],
        "amount": points_reward,
        "type": "mission_reward",
        "description": f"Completed mission: {mission.get('name', 'Unknown')}",
        "mission_id": mission_id,
        "created_at": datetime.now(timezone.utc)
    })
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    
    return {
        "success": True,
        "message": f"Claimed {points_reward} points!",
        "points_awarded": points_reward,
        "new_balance": user["points_balance"]
    }
