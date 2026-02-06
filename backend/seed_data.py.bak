"""Comprehensive seed data for Luna Group"""
from datetime import datetime, timezone, timedelta
import uuid

def get_seed_data():
    """Return comprehensive mock data for all Luna venues"""
    
    # Rich rewards catalog
    rewards = [
        # Universal Rewards
        {
            "id": str(uuid.uuid4()),
            "name": "Complimentary Premium Cocktail",
            "description": "Choose from our signature cocktail menu at any Luna venue",
            "points_cost": 200,
            "category": "drinks",
            "venue_restriction": None,
            "image_url": "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400",
            "is_active": True
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Fast Lane Access - Any Venue",
            "description": "Skip the queue at any Luna nightclub this weekend",
            "points_cost": 300,
            "category": "vip",
            "venue_restriction": None,
            "image_url": "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400",
            "is_active": True
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Luna Credits - $50",
            "description": "Spend at any Luna Group venue on anything you want",
            "points_cost": 600,
            "category": "vip",
            "venue_restriction": None,
            "image_url": "https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=400",
            "is_active": True
        },
        
        # Eclipse Rewards
        {
            "id": str(uuid.uuid4()),
            "name": "Eclipse VIP Booth - 4 Hours",
            "description": "Premium booth with bottle service for you and 6 guests",
            "points_cost": 1500,
            "category": "vip",
            "venue_restriction": "eclipse",
            "image_url": "https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?w=400",
            "is_active": True
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Premium Bottle Service",
            "description": "Choose from Grey Goose, Belvedere, or Patron at Eclipse",
            "points_cost": 800,
            "category": "bottles",
            "venue_restriction": "eclipse",
            "image_url": "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=400",
            "is_active": True
        },
        
        # After Dark Rewards
        {
            "id": str(uuid.uuid4()),
            "name": "After Dark Party Package",
            "description": "Entry + 2 drinks + VIP area access for 4 people",
            "points_cost": 500,
            "category": "vip",
            "venue_restriction": "after_dark",
            "image_url": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400",
            "is_active": True
        },
        
        # Restaurant Rewards
        {
            "id": str(uuid.uuid4()),
            "name": "Night Market Dining Credit - $100",
            "description": "Enjoy authentic Asian cuisine with this dining voucher",
            "points_cost": 1200,
            "category": "dining",
            "venue_restriction": "night_market",
            "image_url": "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400",
            "is_active": True
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Juju Rooftop Experience",
            "description": "3-course dinner for 2 with ocean views",
            "points_cost": 2000,
            "category": "dining",
            "venue_restriction": "juju",
            "image_url": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400",
            "is_active": True
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Complimentary Drinks - Pack of 4",
            "description": "4 standard drinks valid at any Luna nightclub",
            "points_cost": 350,
            "category": "drinks",
            "venue_restriction": None,
            "image_url": "https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=400",
            "is_active": True
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Luna Group Merch Pack",
            "description": "Exclusive Luna Group t-shirt and cap",
            "points_cost": 450,
            "category": "merch",
            "venue_restriction": None,
            "image_url": "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400",
            "is_active": True
        },
    ]
    
    # Live auctions
    now = datetime.now(timezone.utc)
    auctions = [
        {
            "id": "auction_" + str(uuid.uuid4())[:8],
            "venue_id": "eclipse",
            "title": "Eclipse Premium VIP Booth Upgrade",
            "description": "Upgrade to our exclusive premium booth with champagne service tonight",
            "auction_type": "booth_upgrade",
            "reserve_price": 150,
            "instant_win_price": 400,
            "current_bid": 180,
            "winner_id": None,
            "winner_name": None,
            "start_time": now - timedelta(minutes=15),
            "end_time": now + timedelta(minutes=45),
            "status": "active",
            "bid_increment": 10.0
        },
        {
            "id": "auction_" + str(uuid.uuid4())[:8],
            "venue_id": "eclipse",
            "title": "Meet the DJ - Exclusive Access",
            "description": "Meet tonight's headliner DJ with backstage access for you + 2 guests",
            "auction_type": "experience",
            "reserve_price": 100,
            "instant_win_price": 300,
            "current_bid": 120,
            "winner_id": None,
            "winner_name": None,
            "start_time": now - timedelta(minutes=5),
            "end_time": now + timedelta(hours=1, minutes=20),
            "status": "active",
            "bid_increment": 10.0
        },
        {
            "id": "auction_" + str(uuid.uuid4())[:8],
            "venue_id": "after_dark",
            "title": "Fast Lane + Bottle Service",
            "description": "Skip the line and get premium bottle service at After Dark",
            "auction_type": "package",
            "reserve_price": 80,
            "instant_win_price": 200,
            "current_bid": 95,
            "winner_id": None,
            "winner_name": None,
            "start_time": now - timedelta(minutes=25),
            "end_time": now + timedelta(minutes=35),
            "status": "active",
            "bid_increment": 5.0
        },
        {
            "id": "auction_" + str(uuid.uuid4())[:8],
            "venue_id": "su_casa_brisbane",
            "title": "Rooftop VIP Section - 8 People",
            "description": "Exclusive rooftop VIP section with premium bottle selection",
            "auction_type": "vip_section",
            "reserve_price": 200,
            "instant_win_price": 500,
            "current_bid": 0,
            "winner_id": None,
            "winner_name": None,
            "start_time": now + timedelta(minutes=5),
            "end_time": now + timedelta(hours=2),
            "status": "upcoming",
            "bid_increment": 15.0
        },
        {
            "id": "auction_" + str(uuid.uuid4())[:8],
            "venue_id": "eclipse",
            "title": "DJ Shout-Out + Bottle",
            "description": "Get a DJ shout-out plus premium bottle service",
            "auction_type": "experience",
            "reserve_price": 120,
            "instant_win_price": 350,
            "current_bid": 145,
            "winner_id": None,
            "winner_name": None,
            "start_time": now - timedelta(minutes=10),
            "end_time": now + timedelta(minutes=50),
            "status": "active",
            "bid_increment": 10.0
        },
    ]
    
    # Enhanced missions
    missions = [
        {
            "id": str(uuid.uuid4()),
            "name": "Early Bird Special",
            "description": "Check in before 10:30pm at any Luna nightclub tonight",
            "mission_type": "early_bird",
            "requirement_value": 1,
            "points_reward": 150,
            "venue_requirements": None,
            "cross_venue_flag": False,
            "is_active": True
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Luna Explorer",
            "description": "Visit 3 different Luna venues this month",
            "mission_type": "cross_venue",
            "requirement_value": 3,
            "points_reward": 750,
            "venue_requirements": None,
            "cross_venue_flag": True,
            "is_active": True
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Dine & Dance",
            "description": "Have dinner at a Luna restaurant then hit the club same night",
            "mission_type": "cross_venue",
            "requirement_value": 2,
            "points_reward": 400,
            "venue_requirements": None,
            "cross_venue_flag": True,
            "is_active": True
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Eclipse Loyalist",
            "description": "Check in at Eclipse 3 times this month",
            "mission_type": "venue_specific",
            "requirement_value": 3,
            "points_reward": 500,
            "venue_requirements": ["eclipse"],
            "cross_venue_flag": False,
            "is_active": True
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Weekend Warrior",
            "description": "Visit any Luna venue every weekend this month",
            "mission_type": "consistency",
            "requirement_value": 4,
            "points_reward": 600,
            "venue_requirements": None,
            "cross_venue_flag": False,
            "is_active": True
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Social Butterfly",
            "description": "Bring 5 friends who check in with you",
            "mission_type": "social",
            "requirement_value": 5,
            "points_reward": 800,
            "venue_requirements": None,
            "cross_venue_flag": False,
            "is_active": True
        },
    ]
    
    # Enhanced events
    events = [
        {
            "id": str(uuid.uuid4()),
            "venue_id": "eclipse",
            "title": "DJ SODA - International Showcase",
            "description": "World-renowned K-Pop DJ bringing the heat to Eclipse. EDM, K-Pop, and Hip-Hop all night.",
            "event_date": now + timedelta(days=7),
            "ticket_url": "https://eclipse.com/tickets",
            "image_url": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800",
            "featured_artist": {
                "name": "DJ SODA",
                "image": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400",
                "bio": "International sensation with 5M+ followers"
            }
        },
        {
            "id": str(uuid.uuid4()),
            "venue_id": "after_dark",
            "title": "R&B & Hip-Hop Night",
            "description": "The best in R&B, Hip-Hop, and Afrobeats with resident DJs",
            "event_date": now + timedelta(days=2),
            "ticket_url": None,
            "image_url": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800",
            "featured_artist": None
        },
        {
            "id": str(uuid.uuid4()),
            "venue_id": "juju",
            "title": "Sunset Rooftop Sessions",
            "description": "Live acoustic music with ocean views and craft cocktails",
            "event_date": now + timedelta(days=5),
            "ticket_url": None,
            "image_url": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800",
            "featured_artist": None
        },
        {
            "id": str(uuid.uuid4()),
            "venue_id": "su_casa_brisbane",
            "title": "Latin Night",
            "description": "Reggaeton, Salsa, and Bachata all night long",
            "event_date": now + timedelta(days=4),
            "ticket_url": None,
            "image_url": "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800",
            "featured_artist": None
        },
    ]
    
    # Active boosts
    boosts = [
        {
            "id": str(uuid.uuid4()),
            "name": "Weekend Happy Hour",
            "description": "2x points on all purchases before 11pm Friday & Saturday",
            "multiplier": 2.0,
            "start_time": now - timedelta(hours=2),
            "end_time": now + timedelta(hours=6),
            "venue_restriction": None,
            "eligibility": "all"
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Eclipse Grand Opening Anniversary",
            "description": "3x points all night at Eclipse!",
            "multiplier": 3.0,
            "start_time": now - timedelta(hours=1),
            "end_time": now + timedelta(hours=8),
            "venue_restriction": "eclipse",
            "eligibility": "all"
        },
    ]
    
    return {
        "rewards": rewards,
        "auctions": auctions,
        "missions": missions,
        "events": events,
        "boosts": boosts
    }

if __name__ == "__main__":
    import json
    data = get_seed_data()
    print(json.dumps(data, indent=2, default=str))
