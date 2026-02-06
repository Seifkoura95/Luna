"""Comprehensive seed data for Luna Group with real events"""
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
            "venue_name": "Eclipse",
            "title": "Eclipse Premium VIP Booth",
            "description": "Exclusive premium booth with champagne service for tonight. Includes dedicated host, bottle service, and priority seating.",
            "auction_type": "booth_upgrade",
            "starting_bid": 150,
            "current_bid": 180,
            "min_increment": 10,
            "deposit_required": 50,
            "deposit_rules": "50% deposit required within 30 minutes of winning. Non-refundable if cancelled within 2 hours of event.",
            "max_bid_limit": 1000,
            "winner_id": None,
            "winner_name": None,
            "start_time": now - timedelta(minutes=15),
            "end_time": now + timedelta(minutes=45),
            "status": "active",
            "image_url": "https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?w=600",
            "features": ["Premium Booth", "Bottle Service", "Dedicated Host", "VIP Entry"]
        },
        {
            "id": "auction_" + str(uuid.uuid4())[:8],
            "venue_id": "eclipse",
            "venue_name": "Eclipse",
            "title": "Meet the DJ - Backstage Access",
            "description": "Meet tonight's headliner DJ with exclusive backstage access for you + 2 guests. Photo opportunity included.",
            "auction_type": "experience",
            "starting_bid": 100,
            "current_bid": 120,
            "min_increment": 10,
            "deposit_required": 30,
            "deposit_rules": "Full payment required within 15 minutes of winning.",
            "max_bid_limit": 500,
            "winner_id": None,
            "winner_name": None,
            "start_time": now - timedelta(minutes=5),
            "end_time": now + timedelta(hours=1, minutes=20),
            "status": "active",
            "image_url": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600",
            "features": ["Backstage Access", "Photo Op", "2 Guest Passes", "Exclusive"]
        },
        {
            "id": "auction_" + str(uuid.uuid4())[:8],
            "venue_id": "after_dark",
            "venue_name": "After Dark",
            "title": "Fast Lane + Bottle Package",
            "description": "Skip the line and get premium bottle service at After Dark. Includes Grey Goose or Hennessy.",
            "auction_type": "package",
            "starting_bid": 80,
            "current_bid": 95,
            "min_increment": 5,
            "deposit_required": 25,
            "deposit_rules": "Deposit required. Balance due on arrival.",
            "max_bid_limit": 400,
            "winner_id": None,
            "winner_name": None,
            "start_time": now - timedelta(minutes=25),
            "end_time": now + timedelta(minutes=35),
            "status": "active",
            "image_url": "https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=600",
            "features": ["Fast Lane Entry", "Premium Bottle", "VIP Area", "4 Guests"]
        },
        {
            "id": "auction_" + str(uuid.uuid4())[:8],
            "venue_id": "su_casa_brisbane",
            "venue_name": "Su Casa Brisbane",
            "title": "Rooftop VIP Section - 8 People",
            "description": "Exclusive rooftop VIP section with premium bottle selection and city views for you and 7 guests.",
            "auction_type": "vip_section",
            "starting_bid": 200,
            "current_bid": 0,
            "min_increment": 15,
            "deposit_required": 75,
            "deposit_rules": "75% deposit required. Cancellation fee applies within 24 hours.",
            "max_bid_limit": 800,
            "winner_id": None,
            "winner_name": None,
            "start_time": now + timedelta(minutes=5),
            "end_time": now + timedelta(hours=2),
            "status": "upcoming",
            "image_url": "https://images.unsplash.com/photo-1613066697301-d7dccfc86bb5?w=600",
            "features": ["Rooftop Access", "8 Guests", "Premium Bottles", "City Views"]
        },
        {
            "id": "auction_" + str(uuid.uuid4())[:8],
            "venue_id": "eclipse",
            "venue_name": "Eclipse",
            "title": "DJ Shout-Out + Bottle",
            "description": "Get a personalized DJ shout-out plus premium bottle service. Perfect for birthdays!",
            "auction_type": "experience",
            "starting_bid": 120,
            "current_bid": 145,
            "min_increment": 10,
            "deposit_required": 40,
            "deposit_rules": "Payment required within 20 minutes of winning.",
            "max_bid_limit": 600,
            "winner_id": None,
            "winner_name": None,
            "start_time": now - timedelta(minutes=10),
            "end_time": now + timedelta(minutes=50),
            "status": "active",
            "image_url": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600",
            "features": ["DJ Shout-Out", "Premium Bottle", "Photo Op", "VIP Treatment"]
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
            "is_active": True,
            "icon": "moon"
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
            "is_active": True,
            "icon": "planet"
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
            "is_active": True,
            "icon": "stars"
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
            "is_active": True,
            "icon": "rocket"
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
            "is_active": True,
            "icon": "galaxy"
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
            "is_active": True,
            "icon": "constellation"
        },
    ]
    
    # Real Events from venues - combining scraped data with mock data
    events = [
        # Eclipse Events
        {
            "id": str(uuid.uuid4()),
            "venue_id": "eclipse",
            "venue_name": "Eclipse",
            "title": "BLACK:CELL ft. BIIANCO",
            "description": "Electronic music experience featuring international DJ BIIANCO. Immersive audiovisual production with state-of-the-art sound.",
            "event_date": now + timedelta(days=3),
            "event_end_date": now + timedelta(days=3, hours=6),
            "ticket_url": "https://eclipsebrisbane.com.au/tickets",
            "ticket_price": 35.00,
            "image_url": "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800",
            "category": "club_night",
            "featured": True,
            "featured_artist": {
                "name": "BIIANCO",
                "image": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400",
                "bio": "International electronic DJ and producer"
            }
        },
        {
            "id": str(uuid.uuid4()),
            "venue_id": "eclipse",
            "venue_name": "Eclipse",
            "title": "WINDOW KID",
            "description": "UK Grime sensation Window Kid brings his high-energy performance to Brisbane. Support acts all night.",
            "event_date": now + timedelta(days=7),
            "event_end_date": now + timedelta(days=7, hours=5),
            "ticket_url": "https://eclipsebrisbane.com.au/tickets",
            "ticket_price": 45.00,
            "image_url": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800",
            "category": "concert",
            "featured": True,
            "featured_artist": {
                "name": "Window Kid",
                "image": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400",
                "bio": "UK Grime artist with millions of streams"
            }
        },
        {
            "id": str(uuid.uuid4()),
            "venue_id": "eclipse",
            "venue_name": "Eclipse",
            "title": "Saturday Night Takeover",
            "description": "Brisbane's biggest Saturday night with resident DJs spinning Hip Hop, House & Electronic.",
            "event_date": now + timedelta(days=2),
            "event_end_date": now + timedelta(days=2, hours=6),
            "ticket_url": None,
            "ticket_price": 20.00,
            "image_url": "https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=800",
            "category": "club_night",
            "featured": False,
            "featured_artist": None
        },
        
        # After Dark Events
        {
            "id": str(uuid.uuid4()),
            "venue_id": "after_dark",
            "venue_name": "After Dark",
            "title": "R&B & Hip-Hop Fridays",
            "description": "The best in R&B, Hip-Hop, and Afrobeats every Friday. Premium sound, premium vibes.",
            "event_date": now + timedelta(days=1),
            "event_end_date": now + timedelta(days=1, hours=6),
            "ticket_url": "https://eclipsebrisbane.com.au/after-dark",
            "ticket_price": 15.00,
            "image_url": "https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=800",
            "category": "club_night",
            "featured": True,
            "featured_artist": None
        },
        {
            "id": str(uuid.uuid4()),
            "venue_id": "after_dark",
            "venue_name": "After Dark",
            "title": "Afrobeats Saturdays",
            "description": "Global sounds featuring the best Afrobeats, Amapiano, and African diaspora music.",
            "event_date": now + timedelta(days=2),
            "event_end_date": now + timedelta(days=2, hours=6),
            "ticket_url": None,
            "ticket_price": 15.00,
            "image_url": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800",
            "category": "club_night",
            "featured": False,
            "featured_artist": None
        },
        
        # Su Casa Brisbane Events
        {
            "id": str(uuid.uuid4()),
            "venue_id": "su_casa_brisbane",
            "venue_name": "Su Casa Brisbane",
            "title": "Rooftop Fridays",
            "description": "Start your weekend early with sunset cocktails, live DJs, and city views. House & Disco vibes.",
            "event_date": now + timedelta(days=1),
            "event_end_date": now + timedelta(days=1, hours=8),
            "ticket_url": "https://sucasabrisbane.com",
            "ticket_price": 0,
            "image_url": "https://images.unsplash.com/photo-1613066697301-d7dccfc86bb5?w=800",
            "category": "rooftop",
            "featured": True,
            "featured_artist": None
        },
        {
            "id": str(uuid.uuid4()),
            "venue_id": "su_casa_brisbane",
            "venue_name": "Su Casa Brisbane",
            "title": "Sunday Sesh & Hospo Night",
            "description": "Industry night with golden wristbands for hospitality workers. Hip-Hop, R&B, Afrobeats from 9PM.",
            "event_date": now + timedelta(days=4),
            "event_end_date": now + timedelta(days=4, hours=6),
            "ticket_url": None,
            "ticket_price": 0,
            "image_url": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800",
            "category": "club_night",
            "featured": False,
            "featured_artist": None
        },
        
        # Su Casa Gold Coast Events
        {
            "id": str(uuid.uuid4()),
            "venue_id": "su_casa_gold_coast",
            "venue_name": "Su Casa Gold Coast",
            "title": "Gold Coast Saturdays",
            "description": "The Gold Coast's premier Saturday night destination. R&B, Hip-Hop and party anthems.",
            "event_date": now + timedelta(days=2),
            "event_end_date": now + timedelta(days=2, hours=6),
            "ticket_url": "https://sucasagc.com.au",
            "ticket_price": 15.00,
            "image_url": "https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?w=800",
            "category": "club_night",
            "featured": True,
            "featured_artist": None
        },
        
        # Juju Mermaid Beach Events
        {
            "id": str(uuid.uuid4()),
            "venue_id": "juju",
            "venue_name": "Juju Mermaid Beach",
            "title": "Sundown Social",
            "description": "Every Sunday on the rooftop. Live DJs, sultry saxophone, sunset views, and booth packages with cocktails.",
            "event_date": now + timedelta(days=4),
            "event_end_date": now + timedelta(days=4, hours=5),
            "ticket_url": "https://jujumermaidbeach.com.au/whats-on",
            "ticket_price": 0,
            "image_url": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800",
            "category": "rooftop",
            "featured": True,
            "featured_artist": None
        },
        {
            "id": str(uuid.uuid4()),
            "venue_id": "juju",
            "venue_name": "Juju Mermaid Beach",
            "title": "Acoustic Thursdays",
            "description": "Weekly from 6PM - live soloists, chilled cocktails, coastal views, and nibbles like steak tartare and oysters.",
            "event_date": now + timedelta(days=5),
            "event_end_date": now + timedelta(days=5, hours=4),
            "ticket_url": None,
            "ticket_price": 0,
            "image_url": "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800",
            "category": "live_music",
            "featured": False,
            "featured_artist": None
        },
        {
            "id": str(uuid.uuid4()),
            "venue_id": "juju",
            "venue_name": "Juju Mermaid Beach",
            "title": "ETHEREAL SUNDAYS Vol 10",
            "description": "Global house, deep melodic & afro grooves, live percussion. A rooftop music journey with ocean views.",
            "event_date": now + timedelta(days=11),
            "event_end_date": now + timedelta(days=11, hours=7),
            "ticket_url": "https://eventbrite.com.au",
            "ticket_price": 0,
            "image_url": "https://images.unsplash.com/photo-1551218808-94e220e084d2?w=800",
            "category": "special_event",
            "featured": True,
            "featured_artist": {
                "name": "Various Artists",
                "image": "https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=400",
                "bio": "Global house DJs and live percussionists"
            }
        },
        
        # Night Market Events
        {
            "id": str(uuid.uuid4()),
            "venue_id": "night_market",
            "venue_name": "Night Market",
            "title": "Late Night Dining",
            "description": "Pan-Asian street food experience every Friday and Saturday until late. Neon-lit atmosphere.",
            "event_date": now + timedelta(days=1),
            "event_end_date": now + timedelta(days=1, hours=5),
            "ticket_url": None,
            "ticket_price": 0,
            "image_url": "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800",
            "category": "dining",
            "featured": False,
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
