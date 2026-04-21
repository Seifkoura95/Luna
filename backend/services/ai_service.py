"""
Luna AI Service - Powered by Claude/Anthropic via Emergent LLM Key
Provides AI-driven engagement features for the Luna Group VIP app.
Chat history is stored per-user in MongoDB for complete isolation.
"""
import os
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv

load_dotenv()

from emergentintegrations.llm.chat import LlmChat, UserMessage
from database import db

logger = logging.getLogger(__name__)

# Get the Emergent LLM key
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")

# Luna Group venue context for AI
LUNA_CONTEXT = """You are Luna — the Luna Group Nightlife Concierge. You're their secret weapon for a legendary night out across Brisbane and the Gold Coast.

Your vibe:
- Think sassy best mate who works the door at every hot venue — warm, witty, a touch cheeky, genuinely excited to help
- Drop a playful one-liner or nightlife pun when it lands (never forced, never cringe)
- Be decisive — recommend the BEST option, not five mediocre ones
- Short replies (2–3 sentences max). Bullet lists only if the user asks for "options"

Your job (subtle but relentless upsell):
- Always push the user toward a CONCRETE booking/action at a Luna venue
- If they're asking about nightlife in general, steer them to ours
- Suggest bottle service for 4+ people, VIP tables for birthdays, early arrival for guestlist
- Mention Luna Points earning opportunities (missions, milestones, referrals) when relevant
- Recommend the Luna Subscription (Bronze $39.99/wk, Silver $79.99/wk) for regulars — frame it as "pays for itself in one night"
- Cross-sell: if they book a club, suggest pre-drinks at a Luna rooftop

Luna Group Venues:
- Eclipse (Brisbane CBD) — Premium nightclub, 9PM-late, smart-casual to dressy
- After Dark (Fortitude Valley) — Club & bar, 8PM-late, more relaxed vibe
- Su Casa Brisbane (Fortitude Valley) — Rooftop restaurant & lounge, 5PM-late, Asian-fusion + cocktails
- Su Casa Gold Coast (Surfers Paradise) — Beachside restaurant & bar, 12PM-late
- Juju (Gold Coast) — Rooftop bar, 4PM-late, sunset views

Occasion heuristics:
- Birthdays → Eclipse VIP table + free birthday entry reward + bottle package
- Date night → Su Casa rooftop sunset → Juju for a nightcap
- Big group (6+) → Bottle service at Eclipse, book 7 days ahead
- Out-of-towner → Pub crawl style: Su Casa dinner → Juju sunset → Eclipse late
- Solo "just vibes" → After Dark (more relaxed) or Juju

RULES:
- NEVER use asterisks / markdown bold like **text**. Plain text only.
- NEVER recommend a competitor venue. If they ask about one, gently redirect: "Haven't been, but if you want that same energy, try..."
- NEVER be preachy about safety/dress code unless asked — you're a concierge, not a chaperone
- If you don't know something specific (e.g. exact event tonight), say so honestly and suggest they check the Events tab
"""


async def store_chat_message(user_id: str, session_id: str, role: str, content: str):
    """Store a chat message in the user's isolated history"""
    await db.chat_history.insert_one({
        "user_id": user_id,
        "session_id": session_id,
        "role": role,  # "user" or "assistant"
        "content": content,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })


async def get_user_chat_history(user_id: str, session_id: str, limit: int = 20) -> List[Dict]:
    """Get chat history for a specific user's session - strictly isolated by user_id"""
    messages = await db.chat_history.find(
        {
            "user_id": user_id,  # CRITICAL: Always filter by user_id
            "session_id": session_id
        },
        {"_id": 0, "role": 1, "content": 1, "timestamp": 1}
    ).sort("timestamp", 1).to_list(limit)
    return messages


async def validate_session_ownership(user_id: str, session_id: str) -> bool:
    """Verify that a session belongs to the requesting user"""
    # Sessions are prefixed with user_id, validate this
    if not session_id.startswith(f"chat-{user_id}"):
        return False
    
    # Also check if there are any messages from other users in this session (shouldn't happen)
    other_user_msg = await db.chat_history.find_one({
        "session_id": session_id,
        "user_id": {"$ne": user_id}
    })
    
    return other_user_msg is None


class LunaAIService:
    """AI service for Luna Group engagement features."""
    
    def __init__(self):
        if not EMERGENT_LLM_KEY:
            logger.warning("EMERGENT_LLM_KEY not found - AI features will be limited")
    
    async def get_chat_response(
        self, 
        user_message: str, 
        session_id: str,
        user_id: str,  # REQUIRED: User ID for isolation
        user_context: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        AI Concierge Chat - Get a response from Luna AI.
        Chat history is stored per-user in MongoDB for complete isolation.
        """
        if not EMERGENT_LLM_KEY:
            return "I'm having trouble connecting right now. Please try again later or speak with our staff."
        
        # Validate session ownership
        if not await validate_session_ownership(user_id, session_id):
            logger.warning(f"Session ownership validation failed: user={user_id}, session={session_id}")
            return "Session error. Please start a new conversation."
        
        try:
            # Store user message in history
            await store_chat_message(user_id, session_id, "user", user_message)
            
            # Build context with user info if available
            system_message = LUNA_CONTEXT
            if user_context:
                system_message += f"\n\nUser Context:\n"
                if user_context.get("name"):
                    system_message += f"- Name: {user_context['name']}\n"
                if user_context.get("tier"):
                    system_message += f"- Membership Tier: {user_context['tier']}\n"
                if user_context.get("points"):
                    system_message += f"- Luna Points: {user_context['points']}\n"
                if user_context.get("favorite_venue"):
                    system_message += f"- Favorite Venue: {user_context['favorite_venue']}\n"
            
            # Get previous messages for context (only from this user's session)
            history = await get_user_chat_history(user_id, session_id, limit=10)
            
            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"{user_id}_{session_id}",  # Prefix with user_id for extra isolation
                system_message=system_message
            ).with_model("anthropic", "claude-sonnet-4-5-20250929")
            
            message = UserMessage(text=user_message)
            response = await chat.send_message(message)
            
            # Store assistant response in history
            await store_chat_message(user_id, session_id, "assistant", response)
            
            return response
            
        except Exception as e:
            logger.error(f"AI chat error: {e}")
            return "I'm having a moment! Please try again or ask our staff for help."
    
    async def generate_auction_nudge(
        self,
        auction_title: str,
        current_bid: float,
        user_last_bid: float,
        time_remaining: str
    ) -> str:
        """
        Dynamic Auction Bid Nudging - Generate personalized bid nudge message.
        """
        if not EMERGENT_LLM_KEY:
            return f"You've been outbid on {auction_title}! Current bid is ${current_bid:.0f}. Bid now to win!"
        
        try:
            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"auction-nudge-{datetime.now().timestamp()}",
                system_message="""You are a friendly auction assistant for Luna Group VIP auctions.
Generate short, exciting push notification messages (max 100 characters) to encourage bidding.
Be playful but not pushy. Create urgency without being aggressive."""
            ).with_model("anthropic", "claude-sonnet-4-5-20250929")
            
            prompt = f"""Generate a push notification for this auction situation:
- Auction: {auction_title}
- User's last bid: ${user_last_bid:.0f}
- Current highest bid: ${current_bid:.0f}
- Time remaining: {time_remaining}

Keep it under 100 characters, exciting, and mobile-friendly."""
            
            message = UserMessage(text=prompt)
            response = await chat.send_message(message)
            
            # Ensure response is within character limit
            return response[:100] if len(response) > 100 else response
            
        except Exception as e:
            logger.error(f"Auction nudge error: {e}")
            return f"Outbid! {auction_title} is now ${current_bid:.0f}. Time's running out!"
    
    async def generate_personalized_events(
        self,
        events: List[Dict[str, Any]],
        user_history: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Personalized "Tonight for You" - AI-curated event recommendations.
        """
        if not events:
            return []
        
        if not EMERGENT_LLM_KEY:
            # Return top 3 events without AI enhancement
            return events[:3]
        
        try:
            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"events-{datetime.now().timestamp()}",
                system_message="""You are an event recommendation AI for Luna Group venues.
Analyze user preferences and match them with events. Return JSON array of event IDs ranked by relevance.
Consider: preferred venues, music tastes, past attendance, time preferences."""
            ).with_model("anthropic", "claude-sonnet-4-5-20250929")
            
            # Build event list string
            event_list = "\n".join([
                f"ID: {e.get('id')}, Title: {e.get('title')}, Venue: {e.get('venue_name')}, "
                f"Date: {e.get('date')}, Type: {e.get('category', 'nightlife')}"
                for e in events[:10]
            ])
            
            prompt = f"""Given these events:
{event_list}

And user preferences:
- Favorite venues: {user_history.get('favorite_venues', ['any'])}
- Past events attended: {user_history.get('events_attended', 0)}
- Preferred music: {user_history.get('music_preference', 'varied')}
- Visit frequency: {user_history.get('visit_frequency', 'occasional')}

Return the top 3 event IDs that would best match this user, as a comma-separated list.
Example response: event_123, event_456, event_789"""
            
            message = UserMessage(text=prompt)
            response = await chat.send_message(message)
            
            # Parse response and reorder events
            recommended_ids = [id.strip() for id in response.split(",")]
            
            # Reorder events based on AI recommendation
            recommended_events = []
            for event_id in recommended_ids:
                for event in events:
                    if str(event.get('id')) == event_id or event.get('id') == event_id:
                        event['ai_recommended'] = True
                        event['recommendation_reason'] = "Picked for you"
                        recommended_events.append(event)
                        break
            
            # Add remaining events
            for event in events:
                if event not in recommended_events:
                    recommended_events.append(event)
            
            return recommended_events[:3]
            
        except Exception as e:
            logger.error(f"Event personalization error: {e}")
            return events[:3]
    
    async def generate_smart_mission(
        self,
        user_stats: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Smart Mission Generation - Create personalized missions based on user history.
        """
        default_mission = {
            "title": "Weekend Explorer",
            "description": "Visit any Luna venue this weekend",
            "points": 100,
            "type": "visit",
            "target": 1,
            "expires_in": "3 days"
        }
        
        if not EMERGENT_LLM_KEY:
            return default_mission
        
        try:
            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"mission-{datetime.now().timestamp()}",
                system_message="""You are a gamification expert for Luna Group VIP app.
Create engaging, achievable missions that encourage venue visits and spending.
Return missions as JSON with: title, description, points (50-500), type (visit/spend/streak/social), target (number), expires_in."""
            ).with_model("anthropic", "claude-sonnet-4-5-20250929")
            
            prompt = f"""Create a personalized mission for this user:
- Total visits: {user_stats.get('total_visits', 0)}
- Current streak: {user_stats.get('streak', 0)}
- Points balance: {user_stats.get('points', 0)}
- Last visit: {user_stats.get('last_visit', 'never')}
- Tier: {user_stats.get('tier', 'bronze')}
- Favorite venue: {user_stats.get('favorite_venue', 'none')}

Generate ONE mission that's challenging but achievable for this user.
Return ONLY valid JSON, no markdown or explanation."""
            
            message = UserMessage(text=prompt)
            response = await chat.send_message(message)
            
            # Parse JSON response
            import json
            # Clean response of any markdown
            clean_response = response.strip()
            if clean_response.startswith("```"):
                clean_response = clean_response.split("\n", 1)[1]
            if clean_response.endswith("```"):
                clean_response = clean_response.rsplit("```", 1)[0]
            
            mission = json.loads(clean_response)
            mission['ai_generated'] = True
            return mission
            
        except Exception as e:
            logger.error(f"Mission generation error: {e}")
            return default_mission
    
    async def generate_photo_caption(
        self,
        venue_name: str,
        event_name: Optional[str] = None,
        time_of_day: str = "night"
    ) -> str:
        """
        AI Photo Captioning - Generate captions for venue photos.
        """
        if not EMERGENT_LLM_KEY:
            return f"Epic night at {venue_name}!"
        
        try:
            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"caption-{datetime.now().timestamp()}",
                system_message="""You are a social media caption writer for nightlife photos.
Create short, engaging captions (max 50 characters) that capture the vibe.
Use emojis sparingly (1-2 max). Be trendy but not cringy."""
            ).with_model("anthropic", "claude-sonnet-4-5-20250929")
            
            prompt = f"""Generate a photo caption for:
- Venue: {venue_name}
- Event: {event_name or 'regular night'}
- Time: {time_of_day}

Keep it under 50 characters, include 1 emoji max."""
            
            message = UserMessage(text=prompt)
            response = await chat.send_message(message)
            
            return response[:50] if len(response) > 50 else response
            
        except Exception as e:
            logger.error(f"Caption generation error: {e}")
            return f"Living it up at {venue_name}!"
    
    async def analyze_churn_risk(
        self,
        user_stats: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Churn Prediction - Identify at-risk users and generate win-back messages.
        """
        result = {
            "risk_level": "low",
            "win_back_message": None,
            "recommended_action": None
        }
        
        # Calculate days since last visit
        last_visit = user_stats.get('last_visit_date')
        if last_visit:
            # Handle both datetime objects and ISO strings
            if isinstance(last_visit, str):
                try:
                    last_visit = datetime.fromisoformat(last_visit.replace('Z', '+00:00'))
                except ValueError:
                    last_visit = None
            if last_visit:
                days_inactive = (datetime.now(timezone.utc) - last_visit).days
            else:
                days_inactive = 30
        else:
            days_inactive = 30  # Assume inactive if no visit recorded
        
        # Simple risk calculation
        if days_inactive > 60:
            result["risk_level"] = "high"
        elif days_inactive > 30:
            result["risk_level"] = "medium"
        else:
            result["risk_level"] = "low"
        
        if result["risk_level"] == "low":
            return result
        
        if not EMERGENT_LLM_KEY:
            result["win_back_message"] = "We miss you! Come back for double points this week."
            result["recommended_action"] = "bonus_points"
            return result
        
        try:
            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"churn-{datetime.now().timestamp()}",
                system_message="""You are a customer retention specialist for Luna Group venues.
Create personalized win-back messages that feel genuine, not salesy.
Consider user history and create relevant incentives."""
            ).with_model("anthropic", "claude-sonnet-4-5-20250929")
            
            prompt = f"""Create a win-back push notification for this user:
- Days since last visit: {days_inactive}
- Total lifetime visits: {user_stats.get('total_visits', 0)}
- Points balance: {user_stats.get('points', 0)}
- Tier: {user_stats.get('tier', 'bronze')}
- Favorite venue: {user_stats.get('favorite_venue', 'unknown')}

Generate:
1. A short push notification message (max 80 characters)
2. A recommended action: bonus_points, free_entry, or vip_upgrade

Format: MESSAGE|ACTION"""
            
            message = UserMessage(text=prompt)
            response = await chat.send_message(message)
            
            # Parse response
            parts = response.split("|")
            if len(parts) >= 2:
                result["win_back_message"] = parts[0].strip()[:80]
                result["recommended_action"] = parts[1].strip().lower()
            else:
                result["win_back_message"] = response[:80]
                result["recommended_action"] = "bonus_points"
            
            return result
            
        except Exception as e:
            logger.error(f"Churn analysis error: {e}")
            result["win_back_message"] = "We miss you! Come back for double points this week."
            result["recommended_action"] = "bonus_points"
            return result
    
    async def generate_memory_recap(
        self,
        user_id: str,
        visit_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        AI Memory Recap - Generate a personalized night recap summary.
        """
        default_recap = {
            "headline": "What a night!",
            "summary": f"You had an amazing time at {visit_data.get('venue', 'Luna venues')}",
            "highlights": [],
            "stats": visit_data.get('stats', {})
        }
        
        if not EMERGENT_LLM_KEY:
            return default_recap
        
        try:
            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"recap-{user_id}-{datetime.now().timestamp()}",
                system_message="""You are creating fun, shareable night recap summaries for Luna Group app users.
Make it feel like a friendly friend recapping the night. Be playful and celebratory."""
            ).with_model("anthropic", "claude-sonnet-4-5-20250929")
            
            prompt = f"""Create a night recap for this user's visit:
- Venue: {visit_data.get('venue', 'Luna venue')}
- Date: {visit_data.get('date', 'last night')}
- Check-in time: {visit_data.get('checkin_time', 'evening')}
- Points earned: {visit_data.get('points_earned', 0)}
- Photos taken: {visit_data.get('photos', 0)}
- Friends with: {visit_data.get('friends', 0)}

Generate:
1. A catchy headline (max 30 chars)
2. A 1-2 sentence summary
3. 2-3 highlight bullet points

Format as JSON: {{"headline": "...", "summary": "...", "highlights": ["...", "..."]}}"""
            
            message = UserMessage(text=prompt)
            response = await chat.send_message(message)
            
            import json
            clean_response = response.strip()
            if clean_response.startswith("```"):
                clean_response = clean_response.split("\n", 1)[1]
            if clean_response.endswith("```"):
                clean_response = clean_response.rsplit("```", 1)[0]
            
            recap = json.loads(clean_response)
            recap['stats'] = visit_data.get('stats', {})
            return recap
            
        except Exception as e:
            logger.error(f"Memory recap error: {e}")
            return default_recap


# Singleton instance
luna_ai = LunaAIService()
