"""
Social Feed & Night Builder API
- Activity feed: event interests, likes, public/friends/private visibility
- Night Builder: plan multi-venue nights with friends/crew, polls, gamification
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import logging

from database import db
from utils.auth import get_current_user
from utils.mongo import clean_mongo_doc, clean_mongo_docs

router = APIRouter(prefix="/social", tags=["Social"])
logger = logging.getLogger(__name__)


# ── Models ────────────────────────────────────────────────────────────────────

class EventInterestCreate(BaseModel):
    event_id: str
    visibility: str = "public"  # public, friends, private


class NightPlanCreate(BaseModel):
    title: str
    date: str  # YYYY-MM-DD
    stops: List[dict]  # [{venue_id, event_id?, time, notes}]
    invite_user_ids: Optional[List[str]] = None
    invite_crew_id: Optional[str] = None


class NightPlanUpdate(BaseModel):
    title: Optional[str] = None
    date: Optional[str] = None
    stops: Optional[List[dict]] = None


class PollCreate(BaseModel):
    plan_id: str
    question: str
    options: List[dict]  # [{id, label, venue_id?, event_id?}]


# ── Activity Feed ─────────────────────────────────────────────────────────────

@router.get("/feed")
async def get_social_feed(request: Request, limit: int = 30, offset: int = 0):
    """Get social activity feed — shows public event interests from all users
    and friends-only interests from your friends."""
    auth = request.headers.get("authorization")
    current = get_current_user(auth)

    # Get user's friends list
    friendships = await db.friends.find(
        {"$or": [
            {"user_id": current["user_id"], "status": "accepted"},
            {"friend_id": current["user_id"], "status": "accepted"},
        ]},
        {"_id": 0, "user_id": 1, "friend_id": 1},
    ).to_list(500)

    friend_ids = set()
    for f in friendships:
        friend_ids.add(f["user_id"])
        friend_ids.add(f["friend_id"])
    friend_ids.discard(current["user_id"])

    # Fetch: public posts from anyone + friends-only from friends + all own posts
    feed_items = await db.social_activity.find(
        {"$or": [
            {"visibility": "public"},
            {"visibility": "friends", "user_id": {"$in": list(friend_ids)}},
            {"user_id": current["user_id"]},
        ]},
        {"_id": 0},
    ).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)

    # Enrich with like status
    my_likes = await db.social_likes.find(
        {"user_id": current["user_id"]},
        {"_id": 0, "activity_id": 1},
    ).to_list(500)
    my_liked_ids = {l["activity_id"] for l in my_likes}

    for item in feed_items:
        item["liked_by_me"] = item["id"] in my_liked_ids

    return {"feed": feed_items, "total": len(feed_items)}


@router.post("/interest")
async def express_interest(request: Request, data: EventInterestCreate):
    """Express interest in an event — creates a social activity post."""
    auth = request.headers.get("authorization")
    current = get_current_user(auth)

    if data.visibility not in ["public", "friends", "private"]:
        raise HTTPException(status_code=400, detail="Visibility must be public, friends, or private")

    # Get event info — check cached events first, then events collection
    event = await db.events.find_one({"id": data.event_id}, {"_id": 0})
    if not event:
        event = await db.events.find_one({"event_id": data.event_id}, {"_id": 0})
    if not event:
        event = await db.cached_events.find_one({"id": data.event_id}, {"_id": 0})
    if not event:
        event = await db.cached_events.find_one({"event_id": data.event_id}, {"_id": 0})

    # Get user info
    user = await db.users.find_one({"user_id": current["user_id"]}, {"_id": 0, "name": 1, "tier": 1})

    # Check if already interested
    existing = await db.social_activity.find_one({
        "user_id": current["user_id"],
        "event_id": data.event_id,
        "type": "event_interest",
    })
    if existing:
        # Update visibility
        await db.social_activity.update_one(
            {"id": existing["id"]},
            {"$set": {"visibility": data.visibility, "updated_at": datetime.now(timezone.utc).isoformat()}},
        )
        return {"success": True, "updated": True, "message": f"Visibility updated to {data.visibility}"}

    activity_id = f"act_{uuid.uuid4().hex[:10]}"
    activity = {
        "id": activity_id,
        "type": "event_interest",
        "user_id": current["user_id"],
        "user_name": user.get("name", "Luna Member") if user else "Luna Member",
        "user_tier": user.get("tier", "bronze") if user else "bronze",
        "event_id": data.event_id,
        "event_title": event.get("title", event.get("name", "Event")) if event else "Event",
        "event_venue": event.get("venue_name", event.get("venue_id", "")) if event else "",
        "event_date": event.get("date", event.get("datetime_start", "")) if event else "",
        "event_image": event.get("image_url", event.get("image", "")) if event else "",
        "visibility": data.visibility,
        "likes_count": 0,
        "comments_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.social_activity.insert_one(activity)

    # Cache event so it persists after EventFinda removal
    if event:
        await db.cached_events.update_one(
            {"id": data.event_id},
            {"$set": {**{k: v for k, v in event.items() if k != "_id"}, "cached_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True,
        )

    # Award points for social engagement
    await db.users.update_one(
        {"user_id": current["user_id"]},
        {"$inc": {"points_balance": 5}},
    )

    return {
        "success": True,
        "activity": {k: v for k, v in activity.items() if k != "_id"},
        "points_earned": 5,
        "message": f"You're interested! (+5 pts)",
    }


@router.delete("/interest/{event_id}")
async def remove_interest(request: Request, event_id: str):
    """Remove interest from an event."""
    auth = request.headers.get("authorization")
    current = get_current_user(auth)

    result = await db.social_activity.delete_one({
        "user_id": current["user_id"],
        "event_id": event_id,
        "type": "event_interest",
    })

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Interest not found")

    return {"success": True, "message": "Interest removed"}


@router.post("/like/{activity_id}")
async def like_activity(request: Request, activity_id: str):
    """Like someone's activity."""
    auth = request.headers.get("authorization")
    current = get_current_user(auth)

    activity = await db.social_activity.find_one({"id": activity_id})
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    existing = await db.social_likes.find_one({
        "user_id": current["user_id"],
        "activity_id": activity_id,
    })
    if existing:
        raise HTTPException(status_code=400, detail="Already liked")

    await db.social_likes.insert_one({
        "id": f"like_{uuid.uuid4().hex[:8]}",
        "user_id": current["user_id"],
        "activity_id": activity_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    await db.social_activity.update_one(
        {"id": activity_id},
        {"$inc": {"likes_count": 1}},
    )

    return {"success": True, "message": "Liked!"}


@router.delete("/like/{activity_id}")
async def unlike_activity(request: Request, activity_id: str):
    """Unlike an activity."""
    auth = request.headers.get("authorization")
    current = get_current_user(auth)

    result = await db.social_likes.delete_one({
        "user_id": current["user_id"],
        "activity_id": activity_id,
    })

    if result.deleted_count > 0:
        await db.social_activity.update_one(
            {"id": activity_id},
            {"$inc": {"likes_count": -1}},
        )

    return {"success": True}


@router.get("/interested/{event_id}")
async def get_event_interested(request: Request, event_id: str):
    """Get who's interested in an event (respects visibility)."""
    auth = request.headers.get("authorization")
    current = get_current_user(auth)

    # Get friends
    friendships = await db.friends.find(
        {"$or": [
            {"user_id": current["user_id"], "status": "accepted"},
            {"friend_id": current["user_id"], "status": "accepted"},
        ]},
        {"_id": 0},
    ).to_list(500)
    friend_ids = set()
    for f in friendships:
        friend_ids.add(f["user_id"])
        friend_ids.add(f["friend_id"])
    friend_ids.discard(current["user_id"])

    interests = await db.social_activity.find(
        {"event_id": event_id, "type": "event_interest",
         "$or": [
             {"visibility": "public"},
             {"visibility": "friends", "user_id": {"$in": list(friend_ids)}},
             {"user_id": current["user_id"]},
         ]},
        {"_id": 0, "user_id": 1, "user_name": 1, "user_tier": 1, "visibility": 1},
    ).to_list(200)

    my_interest = await db.social_activity.find_one({
        "user_id": current["user_id"],
        "event_id": event_id,
        "type": "event_interest",
    }, {"_id": 0, "visibility": 1})

    return {
        "interested": interests,
        "total": len(interests),
        "my_interest": my_interest,
    }


# ── Night Builder ─────────────────────────────────────────────────────────────

@router.post("/night-plan")
async def create_night_plan(request: Request, data: NightPlanCreate):
    """Create a night plan with multiple venue stops."""
    auth = request.headers.get("authorization")
    current = get_current_user(auth)

    user = await db.users.find_one({"user_id": current["user_id"]}, {"_id": 0, "name": 1})

    plan_id = f"plan_{uuid.uuid4().hex[:8]}"

    # Enrich stops with venue names
    from luna_venues_config import LUNA_VENUES
    enriched_stops = []
    for i, stop in enumerate(data.stops):
        venue = LUNA_VENUES.get(stop.get("venue_id", ""), {})
        enriched_stops.append({
            "order": i + 1,
            "venue_id": stop.get("venue_id", ""),
            "venue_name": venue.get("name", stop.get("venue_id", "")),
            "venue_type": venue.get("type", ""),
            "event_id": stop.get("event_id"),
            "time": stop.get("time", ""),
            "notes": stop.get("notes", ""),
            "status": "planned",
        })

    plan = {
        "id": plan_id,
        "title": data.title,
        "date": data.date,
        "creator_id": current["user_id"],
        "creator_name": user.get("name", "Luna Member") if user else "Luna Member",
        "stops": enriched_stops,
        "members": [{"user_id": current["user_id"], "name": user.get("name", "") if user else "", "status": "confirmed", "role": "organizer"}],
        "polls": [],
        "is_crew_plan": bool(data.invite_crew_id or (data.invite_user_ids and len(data.invite_user_ids) > 0)),
        "status": "planning",  # planning, locked, active, completed
        "likes": [],
        "likes_count": 0,
        "total_stops": len(enriched_stops),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.night_plans.insert_one(plan)

    # Invite friends
    if data.invite_user_ids:
        for uid in data.invite_user_ids:
            friend = await db.users.find_one({"user_id": uid}, {"_id": 0, "name": 1})
            plan["members"].append({
                "user_id": uid,
                "name": friend.get("name", "") if friend else "",
                "status": "invited",
                "role": "member",
            })
        await db.night_plans.update_one({"id": plan_id}, {"$set": {"members": plan["members"]}})

    # Invite crew
    if data.invite_crew_id:
        crew = await db.crews.find_one({"id": data.invite_crew_id}, {"_id": 0})
        if crew:
            for m in crew.get("members", []):
                if m.get("user_id") != current["user_id"]:
                    member_user = await db.users.find_one({"user_id": m["user_id"]}, {"_id": 0, "name": 1})
                    plan["members"].append({
                        "user_id": m["user_id"],
                        "name": member_user.get("name", "") if member_user else "",
                        "status": "invited",
                        "role": "member",
                    })
            await db.night_plans.update_one({"id": plan_id}, {"$set": {"members": plan["members"]}})

    # Award points for planning
    await db.users.update_one(
        {"user_id": current["user_id"]},
        {"$inc": {"points_balance": 10}},
    )

    return {
        "success": True,
        "plan": {k: v for k, v in plan.items() if k != "_id"},
        "points_earned": 10,
        "message": f"Night plan created! {len(enriched_stops)} stops planned. (+10 pts)",
    }


@router.get("/night-plans")
async def get_my_night_plans(request: Request):
    """Get user's night plans (created or invited to)."""
    auth = request.headers.get("authorization")
    current = get_current_user(auth)

    plans = await db.night_plans.find(
        {"members.user_id": current["user_id"]},
        {"_id": 0},
    ).sort("created_at", -1).to_list(50)

    return {"plans": plans, "total": len(plans)}


@router.get("/night-plan/{plan_id}")
async def get_night_plan(request: Request, plan_id: str):
    """Get a specific night plan with all details."""
    auth = request.headers.get("authorization")
    current = get_current_user(auth)

    plan = await db.night_plans.find_one({"id": plan_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    # Check access
    member_ids = [m["user_id"] for m in plan.get("members", [])]
    if current["user_id"] not in member_ids:
        raise HTTPException(status_code=403, detail="Not a member of this plan")

    return plan


@router.put("/night-plan/{plan_id}")
async def update_night_plan(request: Request, plan_id: str, data: NightPlanUpdate):
    """Update a night plan (title, date, or stops)."""
    auth = request.headers.get("authorization")
    current = get_current_user(auth)

    plan = await db.night_plans.find_one({"id": plan_id})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    update = {}
    if data.title is not None:
        update["title"] = data.title
    if data.date is not None:
        update["date"] = data.date
    if data.stops is not None:
        from luna_venues_config import LUNA_VENUES
        enriched = []
        for i, stop in enumerate(data.stops):
            venue = LUNA_VENUES.get(stop.get("venue_id", ""), {})
            enriched.append({
                "order": i + 1,
                "venue_id": stop.get("venue_id", ""),
                "venue_name": venue.get("name", stop.get("venue_id", "")),
                "venue_type": venue.get("type", ""),
                "event_id": stop.get("event_id"),
                "time": stop.get("time", ""),
                "notes": stop.get("notes", ""),
                "status": stop.get("status", "planned"),
            })
        update["stops"] = enriched
        update["total_stops"] = len(enriched)

    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.night_plans.update_one({"id": plan_id}, {"$set": update})

    updated = await db.night_plans.find_one({"id": plan_id}, {"_id": 0})
    return {"success": True, "plan": updated}


@router.post("/night-plan/{plan_id}/respond")
async def respond_to_invite(request: Request, plan_id: str, accept: bool = True):
    """Accept or decline a night plan invitation."""
    auth = request.headers.get("authorization")
    current = get_current_user(auth)

    plan = await db.night_plans.find_one({"id": plan_id})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    new_status = "confirmed" if accept else "declined"
    members = plan.get("members", [])
    updated = False
    for m in members:
        if m["user_id"] == current["user_id"]:
            m["status"] = new_status
            updated = True

    if not updated:
        raise HTTPException(status_code=404, detail="You're not invited to this plan")

    await db.night_plans.update_one(
        {"id": plan_id},
        {"$set": {"members": members, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )

    if accept:
        await db.users.update_one(
            {"user_id": current["user_id"]},
            {"$inc": {"points_balance": 5}},
        )

    return {
        "success": True,
        "status": new_status,
        "vibe_score": vibe,
        "points_earned": 5 if accept else 0,
        "message": "You're in! (+5 pts)" if accept else "Maybe next time!",
    }


@router.post("/night-plan/{plan_id}/invite")
async def invite_to_plan(request: Request, plan_id: str, user_ids: List[str] = [], crew_id: Optional[str] = None):
    """Invite more friends or a crew to an existing plan."""
    auth = request.headers.get("authorization")
    current = get_current_user(auth)

    plan = await db.night_plans.find_one({"id": plan_id})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    members = plan.get("members", [])
    existing_ids = {m["user_id"] for m in members}
    new_members = []

    for uid in user_ids:
        if uid not in existing_ids:
            u = await db.users.find_one({"user_id": uid}, {"_id": 0, "name": 1})
            new_members.append({"user_id": uid, "name": u.get("name", "") if u else "", "status": "invited", "role": "member"})

    if crew_id:
        crew = await db.crews.find_one({"id": crew_id}, {"_id": 0})
        if crew:
            for m in crew.get("members", []):
                if m.get("user_id") not in existing_ids:
                    u = await db.users.find_one({"user_id": m["user_id"]}, {"_id": 0, "name": 1})
                    new_members.append({"user_id": m["user_id"], "name": u.get("name", "") if u else "", "status": "invited", "role": "member"})

    members.extend(new_members)
    await db.night_plans.update_one({"id": plan_id}, {"$set": {"members": members, "updated_at": datetime.now(timezone.utc).isoformat()}})

    return {"success": True, "invited": len(new_members), "message": f"{len(new_members)} friends invited!"}


# ── Plan Likes (crew plans only) ─────────────────────────────────────────────

@router.post("/night-plan/{plan_id}/like")
async def like_plan(request: Request, plan_id: str):
    """Like a crew night plan — crew members vote on the plan."""
    auth = request.headers.get("authorization")
    current = get_current_user(auth)

    plan = await db.night_plans.find_one({"id": plan_id})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    likes = plan.get("likes", [])
    if current["user_id"] in likes:
        raise HTTPException(status_code=400, detail="Already liked this plan")

    likes.append(current["user_id"])
    await db.night_plans.update_one(
        {"id": plan_id},
        {"$set": {"likes": likes, "likes_count": len(likes), "updated_at": datetime.now(timezone.utc).isoformat()}},
    )

    return {"success": True, "likes_count": len(likes), "message": "Liked!"}


@router.delete("/night-plan/{plan_id}/like")
async def unlike_plan(request: Request, plan_id: str):
    """Unlike a crew night plan."""
    auth = request.headers.get("authorization")
    current = get_current_user(auth)

    plan = await db.night_plans.find_one({"id": plan_id})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    likes = plan.get("likes", [])
    if current["user_id"] not in likes:
        return {"success": True, "likes_count": len(likes)}

    likes.remove(current["user_id"])
    await db.night_plans.update_one(
        {"id": plan_id},
        {"$set": {"likes": likes, "likes_count": len(likes), "updated_at": datetime.now(timezone.utc).isoformat()}},
    )

    return {"success": True, "likes_count": len(likes)}


# ── Update Stop Time ──────────────────────────────────────────────────────────

class StopTimeUpdate(BaseModel):
    stop_index: int
    time: Optional[str] = None
    notes: Optional[str] = None

@router.put("/night-plan/{plan_id}/stop")
async def update_stop_time(request: Request, plan_id: str, data: StopTimeUpdate):
    """Update the time or notes for a specific stop in a plan."""
    auth = request.headers.get("authorization")
    current = get_current_user(auth)

    plan = await db.night_plans.find_one({"id": plan_id})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    stops = plan.get("stops", [])
    if data.stop_index < 0 or data.stop_index >= len(stops):
        raise HTTPException(status_code=400, detail="Invalid stop index")

    if data.time is not None:
        stops[data.stop_index]["time"] = data.time
    if data.notes is not None:
        stops[data.stop_index]["notes"] = data.notes

    await db.night_plans.update_one(
        {"id": plan_id},
        {"$set": {"stops": stops, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )

    return {"success": True, "stop": stops[data.stop_index]}


# ── Polls (crew plans only) ──────────────────────────────────────────────────

@router.post("/poll")
async def create_poll(request: Request, data: PollCreate):
    """Create a poll within a night plan. Only allowed for crew plans (not solo)."""
    auth = request.headers.get("authorization")
    current = get_current_user(auth)

    plan = await db.night_plans.find_one({"id": data.plan_id})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    if not plan.get("is_crew_plan") and len(plan.get("members", [])) <= 1:
        raise HTTPException(status_code=400, detail="Polls are only available for crew/group plans. Invite friends first!")
        raise HTTPException(status_code=404, detail="Plan not found")

    user = await db.users.find_one({"user_id": current["user_id"]}, {"_id": 0, "name": 1})

    poll_id = f"poll_{uuid.uuid4().hex[:8]}"
    options = []
    for opt in data.options:
        options.append({
            "id": opt.get("id", f"opt_{uuid.uuid4().hex[:6]}"),
            "label": opt.get("label", ""),
            "venue_id": opt.get("venue_id"),
            "event_id": opt.get("event_id"),
            "votes": [],
            "vote_count": 0,
        })

    poll = {
        "id": poll_id,
        "plan_id": data.plan_id,
        "creator_id": current["user_id"],
        "creator_name": user.get("name", "") if user else "",
        "question": data.question,
        "options": options,
        "status": "open",
        "total_votes": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.polls.insert_one(poll)

    # Add poll reference to plan
    polls = plan.get("polls", [])
    polls.append(poll_id)
    await db.night_plans.update_one({"id": data.plan_id}, {"$set": {"polls": polls}})

    return {
        "success": True,
        "poll": {k: v for k, v in poll.items() if k != "_id"},
        "message": "Poll created! Let your crew vote.",
    }


@router.post("/poll/{poll_id}/vote")
async def vote_on_poll(request: Request, poll_id: str, option_id: str):
    """Vote on a poll option."""
    auth = request.headers.get("authorization")
    current = get_current_user(auth)

    poll = await db.polls.find_one({"id": poll_id})
    if not poll:
        raise HTTPException(status_code=404, detail="Poll not found")

    if poll.get("status") != "open":
        raise HTTPException(status_code=400, detail="Poll is closed")

    # Remove previous vote if exists
    for opt in poll["options"]:
        opt["votes"] = [v for v in opt["votes"] if v != current["user_id"]]
        opt["vote_count"] = len(opt["votes"])

    # Add new vote
    voted = False
    for opt in poll["options"]:
        if opt["id"] == option_id:
            opt["votes"].append(current["user_id"])
            opt["vote_count"] = len(opt["votes"])
            voted = True

    if not voted:
        raise HTTPException(status_code=404, detail="Option not found")

    total = sum(o["vote_count"] for o in poll["options"])
    await db.polls.update_one(
        {"id": poll_id},
        {"$set": {"options": poll["options"], "total_votes": total}},
    )

    return {"success": True, "total_votes": total, "message": "Vote cast!"}


@router.get("/poll/{poll_id}")
async def get_poll(request: Request, poll_id: str):
    """Get poll details and results."""
    auth = request.headers.get("authorization")
    current = get_current_user(auth)

    poll = await db.polls.find_one({"id": poll_id}, {"_id": 0})
    if not poll:
        raise HTTPException(status_code=404, detail="Poll not found")

    # Find user's vote
    my_vote = None
    for opt in poll.get("options", []):
        if current["user_id"] in opt.get("votes", []):
            my_vote = opt["id"]

    poll["my_vote"] = my_vote
    return poll


@router.post("/poll/{poll_id}/close")
async def close_poll(request: Request, poll_id: str):
    """Close a poll and determine the winner."""
    auth = request.headers.get("authorization")
    current = get_current_user(auth)

    poll = await db.polls.find_one({"id": poll_id})
    if not poll:
        raise HTTPException(status_code=404, detail="Poll not found")

    if poll.get("creator_id") != current["user_id"]:
        raise HTTPException(status_code=403, detail="Only the creator can close the poll")

    # Find winner
    winner = max(poll["options"], key=lambda o: o["vote_count"])

    await db.polls.update_one(
        {"id": poll_id},
        {"$set": {"status": "closed", "winner_id": winner["id"], "winner_label": winner["label"]}},
    )

    return {
        "success": True,
        "winner": winner["label"],
        "votes": winner["vote_count"],
        "message": f"The people have spoken: {winner['label']}!",
    }


@router.delete("/night-plan/{plan_id}")
async def delete_night_plan(request: Request, plan_id: str):
    """Delete a night plan."""
    auth = request.headers.get("authorization")
    current = get_current_user(auth)

    plan = await db.night_plans.find_one({"id": plan_id})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    if plan.get("creator_id") != current["user_id"]:
        raise HTTPException(status_code=403, detail="Only the creator can delete this plan")

    await db.night_plans.delete_one({"id": plan_id})
    await db.polls.delete_many({"plan_id": plan_id})

    return {"success": True, "message": "Plan deleted"}
