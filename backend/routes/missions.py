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
    
    from utils.points_guard import can_earn_points
    if not await can_earn_points(current_user["user_id"]):
        raise HTTPException(status_code=403, detail="This account type cannot earn mission points")
    
    points_reward = mission.get("points_reward", 0)

    # Dispatch via the unified points service — pushes to SwiftPOS (if linked +
    # mapped), falls back to local Mongo counter otherwise. The mission_id on
    # the mission record (e.g. "luna_explorer") must match the PLU map key in
    # config/swiftpos_plu_map.py. If not, points_override keeps legacy math.
    from services.points_service import award_points as _award_points
    award_result = await _award_points(
        user_id=current_user["user_id"],
        event_type="mission",
        event_key=mission_id,
        points_override=points_reward,
        reason=f"Completed mission: {mission.get('name', 'Unknown')}",
    )

    await db.mission_progress.update_one(
        {"user_id": current_user["user_id"], "mission_id": mission_id},
        {"$set": {
            "claimed": True,
            "claimed_at": datetime.now(timezone.utc)
        }}
    )

    return {
        "success": True,
        "message": f"Claimed {award_result['points_awarded']} points!",
        "points_awarded": award_result["points_awarded"],
        "new_balance": award_result["new_balance"],
        "dispatched_to_swiftpos": award_result["dispatched_to_swiftpos"],
        "pending_swiftpos_dispatch": award_result.get("pending_swiftpos_dispatch", False),
    }
