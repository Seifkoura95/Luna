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
    
    # Live auctions - with extended end times for testing
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
            "end_time": now + timedelta(hours=3, minutes=45),
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
            "end_time": now + timedelta(hours=4, minutes=20),
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
            "end_time": now + timedelta(hours=2, minutes=35),
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
            "current_bid": 225,
            "min_increment": 15,
            "deposit_required": 75,
            "deposit_rules": "75% deposit required. Cancellation fee applies within 24 hours.",
            "max_bid_limit": 800,
            "winner_id": None,
            "winner_name": None,
            "start_time": now - timedelta(minutes=10),
            "end_time": now + timedelta(hours=5),
            "status": "active",
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
            "end_time": now + timedelta(hours=1, minutes=50),
            "status": "active",
            "image_url": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600",
            "features": ["DJ Shout-Out", "Premium Bottle", "Photo Op", "VIP Treatment"]
        },
        {
            "id": "auction_" + str(uuid.uuid4())[:8],
            "venue_id": "juju",
            "venue_name": "Juju Mermaid Beach",
            "title": "Sunset Booth Experience",
            "description": "Premium rooftop booth for Sundown Social. Includes a bottle of Veuve Clicquot and seafood platter.",
            "auction_type": "booth_upgrade",
            "starting_bid": 180,
            "current_bid": 210,
            "min_increment": 15,
            "deposit_required": 60,
            "deposit_rules": "Full deposit required. Includes $100 F&B credit.",
            "max_bid_limit": 700,
            "winner_id": None,
            "winner_name": None,
            "start_time": now - timedelta(minutes=20),
            "end_time": now + timedelta(hours=6),
            "status": "active",
            "image_url": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600",
            "features": ["Sunset Views", "Champagne", "Seafood Platter", "6 Guests"]
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
    
    # Real Events from venues - Using latest Eclipse Brisbane events
    events = [
        # Eclipse Events - Real upcoming events
        {
            "id": str(uuid.uuid4()),
            "venue_id": "eclipse",
            "venue_name": "Eclipse",
            "title": "SPACE 92",
            "description": "International techno sensation SPACE 92 brings his thunderous beats to Brisbane. Expect a high-energy night of pure techno.",
            "event_date": now + timedelta(days=14),
            "event_end_date": now + timedelta(days=14, hours=6),
            "ticket_url": "https://eclipsebrisbane.com.au/tickets",
            "ticket_price": 55.00,
            "image_url": "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800",
            "category": "concert",
            "featured": True,
            "featured_artist": {
                "name": "SPACE 92",
                "image": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400",
                "bio": "French techno DJ & producer known for high-energy sets"
            }
        },
        {
            "id": str(uuid.uuid4()),
            "venue_id": "eclipse",
            "venue_name": "Eclipse",
            "title": "LEE ANN ROBERTS + JULIET FOX",
            "description": "Two powerhouse female DJs taking over Eclipse for an unforgettable night of house and techno.",
            "event_date": now + timedelta(days=1),
            "event_end_date": now + timedelta(days=1, hours=6),
            "ticket_url": "https://eclipsebrisbane.com.au/tickets",
            "ticket_price": 40.00,
            "image_url": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800",
            "category": "concert",
            "featured": True,
            "featured_artist": {
                "name": "Lee Ann Roberts & Juliet Fox",
                "image": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400",
                "bio": "International DJ duo"
            }
        },
        {
            "id": str(uuid.uuid4()),
            "venue_id": "eclipse",
            "venue_name": "Eclipse",
            "title": "S2O PRE PARTY ft. ELI OAKS",
            "description": "Get warmed up for S2O Festival with Eli Oaks at the official pre-party. Electronic music all night.",
            "event_date": now + timedelta(days=7),
            "event_end_date": now + timedelta(days=7, hours=6),
            "ticket_url": "https://eclipsebrisbane.com.au/tickets",
            "ticket_price": 35.00,
            "image_url": "https://images.unsplash.com/photo-1680416124175-f70a22323763?w=800",
            "category": "club_night",
            "featured": True,
            "featured_artist": {
                "name": "Eli Oaks",
                "image": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400",
                "bio": "Rising electronic music producer"
            }
        },
        {
            "id": str(uuid.uuid4()),
            "venue_id": "eclipse",
            "venue_name": "Eclipse",
            "title": "UNI-VERSE O-WEEK PARTY",
            "description": "Brisbane's biggest O-Week party! Student specials all night. Hip Hop, House & Electronic.",
            "event_date": now + timedelta(days=15),
            "event_end_date": now + timedelta(days=15, hours=6),
            "ticket_url": "https://eclipsebrisbane.com.au/tickets",
            "ticket_price": 15.00,
            "image_url": "https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=800",
            "category": "club_night",
            "featured": False,
            "featured_artist": None
        },
        {
            "id": str(uuid.uuid4()),
            "venue_id": "eclipse",
            "venue_name": "Eclipse",
            "title": "MPH + CASEY CLUB",
            "description": "Local legends MPH and Casey Club take control of the decks. Underground house and techno.",
            "event_date": now + timedelta(days=29),
            "event_end_date": now + timedelta(days=29, hours=6),
            "ticket_url": "https://eclipsebrisbane.com.au/tickets",
            "ticket_price": 30.00,
            "image_url": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800",
            "category": "club_night",
            "featured": False,
            "featured_artist": None
        },
        {
            "id": str(uuid.uuid4()),
            "venue_id": "eclipse",
            "venue_name": "Eclipse",
            "title": "VIKKSTAR",
            "description": "Internet sensation and gaming legend Vikkstar makes his Brisbane DJ debut!",
            "event_date": now + timedelta(days=35),
            "event_end_date": now + timedelta(days=35, hours=5),
            "ticket_url": "https://eclipsebrisbane.com.au/tickets",
            "ticket_price": 45.00,
            "image_url": "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800",
            "category": "concert",
            "featured": True,
            "featured_artist": {
                "name": "Vikkstar",
                "image": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400",
                "bio": "Gaming legend turned DJ"
            }
        },
        {
            "id": str(uuid.uuid4()),
            "venue_id": "eclipse",
            "venue_name": "Eclipse",
            "title": "BLACK:CELL ft. BIIANCO",
            "description": "Electronic music experience featuring international DJ BIIANCO. Immersive audiovisual production.",
            "event_date": now + timedelta(days=56),
            "event_end_date": now + timedelta(days=56, hours=6),
            "ticket_url": "https://eclipsebrisbane.com.au/tickets",
            "ticket_price": 50.00,
            "image_url": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800",
            "category": "concert",
            "featured": True,
            "featured_artist": {
                "name": "BIIANCO",
                "image": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400",
                "bio": "International electronic DJ and producer"
            }
        },
        {
            "id": str(uuid.uuid4()),
            "venue_id": "eclipse",
            "venue_name": "Eclipse",
            "title": "Saturday Night Takeover",
            "description": "Brisbane's biggest Saturday night with resident DJs spinning Hip Hop, RnB, Afrobeats & House.",
            "event_date": now + timedelta(days=2),
            "event_end_date": now + timedelta(days=2, hours=6),
            "ticket_url": None,
            "ticket_price": 20.00,
            "image_url": "https://images.unsplash.com/photo-1713885462557-12b5c41f22cd?w=800",
            "category": "club_night",
            "featured": False,
            "featured_artist": None
        },
        
        # After Dark Events - Real recurring events
        {
            "id": str(uuid.uuid4()),
            "venue_id": "after_dark",
            "venue_name": "After Dark",
            "title": "R&B & Hip-Hop Fridays",
            "description": "The best in R&B, Hip-Hop, and Afrobeats every Friday from 9PM. Premium sound, VIP booths, bottle service available.",
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
            "title": "RESON8 Saturdays",
            "description": "Every Saturday night featuring RESON8 spinning Afrobeats, Amapiano & global sounds. 9PM-3AM.",
            "event_date": now + timedelta(days=2),
            "event_end_date": now + timedelta(days=2, hours=6),
            "ticket_url": "https://eclipsebrisbane.com.au/after-dark",
            "ticket_price": 15.00,
            "image_url": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800",
            "category": "club_night",
            "featured": True,
            "featured_artist": {
                "name": "RESON8",
                "image": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400",
                "bio": "Resident DJ - Afrobeats & Global Sounds"
            }
        },
        {
            "id": str(uuid.uuid4()),
            "venue_id": "after_dark",
            "venue_name": "After Dark",
            "title": "Slow Jams & Throwbacks",
            "description": "R&B classics and slow jams all night. Perfect for those late night vibes. VIP sections available.",
            "event_date": now + timedelta(days=8),
            "event_end_date": now + timedelta(days=8, hours=6),
            "ticket_url": "https://eclipsebrisbane.com.au/after-dark",
            "ticket_price": 10.00,
            "image_url": "https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=800",
            "category": "club_night",
            "featured": False,
            "featured_artist": None
        },
        {
            "id": str(uuid.uuid4()),
            "venue_id": "after_dark",
            "venue_name": "After Dark",
            "title": "Amapiano Nights",
            "description": "South African house music takeover. Amapiano, Deep House & Afro Tech all night.",
            "event_date": now + timedelta(days=16),
            "event_end_date": now + timedelta(days=16, hours=6),
            "ticket_url": "https://eclipsebrisbane.com.au/after-dark",
            "ticket_price": 20.00,
            "image_url": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800",
            "category": "special_event",
            "featured": True,
            "featured_artist": None
        },
        
        # Su Casa Brisbane Events - Real recurring events
        {
            "id": str(uuid.uuid4()),
            "venue_id": "su_casa_brisbane",
            "venue_name": "Su Casa Brisbane",
            "title": "Trivia Thursdays",
            "description": "High-stakes trivia on the rooftop! Food & drink specials, chance to win a free booth. Brisbane skyline views.",
            "event_date": now + timedelta(days=5),
            "event_end_date": now + timedelta(days=5, hours=4),
            "ticket_url": "https://sucasabrisbane.com/whats-on-rooftop",
            "ticket_price": 0,
            "image_url": "https://images.unsplash.com/photo-1613066697301-d7dccfc86bb5?w=800",
            "category": "rooftop",
            "featured": False,
            "featured_artist": None
        },
        {
            "id": str(uuid.uuid4()),
            "venue_id": "su_casa_brisbane",
            "venue_name": "Su Casa Brisbane",
            "title": "Bao & Sip Thursdays",
            "description": "$25 deal - Three premium Bao Buns + Margarita or beer. 6-9PM with sunset vibes and RnB beats.",
            "event_date": now + timedelta(days=5),
            "event_end_date": now + timedelta(days=5, hours=3),
            "ticket_url": "https://sucasabrisbane.com/whats-on-rooftop",
            "ticket_price": 25.00,
            "image_url": "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800",
            "category": "dining",
            "featured": True,
            "featured_artist": None
        },
        {
            "id": str(uuid.uuid4()),
            "venue_id": "su_casa_brisbane",
            "venue_name": "Su Casa Brisbane",
            "title": "Sunset Session",
            "description": "$49/person 2-hour rooftop package with curated cocktails and skyline views. Friday-Sunday 5-7PM.",
            "event_date": now + timedelta(days=1),
            "event_end_date": now + timedelta(days=1, hours=2),
            "ticket_url": "https://sucasabrisbane.com/whats-on-rooftop",
            "ticket_price": 49.00,
            "image_url": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800",
            "category": "rooftop",
            "featured": True,
            "featured_artist": None
        },
        {
            "id": str(uuid.uuid4()),
            "venue_id": "su_casa_brisbane",
            "venue_name": "Su Casa Brisbane",
            "title": "Afrobeats Fridays",
            "description": "Rooftop transitions to nightclub from 9PM. Afrobeats, RnB, and slow jams all night.",
            "event_date": now + timedelta(days=1),
            "event_end_date": now + timedelta(days=1, hours=6),
            "ticket_url": "https://sucasabrisbane.com/whats-on-nightclub",
            "ticket_price": 15.00,
            "image_url": "https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=800",
            "category": "club_night",
            "featured": True,
            "featured_artist": None
        },
        {
            "id": str(uuid.uuid4()),
            "venue_id": "su_casa_brisbane",
            "venue_name": "Su Casa Brisbane",
            "title": "New Age RnB Saturdays",
            "description": "New-age RnB and classic Hip-Hop. Guest list and booth bookings essential. Brisbane's premium Saturday.",
            "event_date": now + timedelta(days=2),
            "event_end_date": now + timedelta(days=2, hours=6),
            "ticket_url": "https://sucasabrisbane.com/whats-on-nightclub",
            "ticket_price": 20.00,
            "image_url": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800",
            "category": "club_night",
            "featured": True,
            "featured_artist": None
        },
        {
            "id": str(uuid.uuid4()),
            "venue_id": "su_casa_brisbane",
            "venue_name": "Su Casa Brisbane",
            "title": "Sunday Sesh & Hospo Night",
            "description": "Industry night with golden wristbands for hospitality workers. Rooftop from 4PM, nightclub from 9PM.",
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
        
        # Juju Mermaid Beach Events - Real events from website
        {
            "id": str(uuid.uuid4()),
            "venue_id": "juju",
            "venue_name": "Juju Mermaid Beach",
            "title": "Sundown Social",
            "description": "Every Sunday from golden hour. Live DJs, sultry saxophone performances, sunset views. Luxe booth packages available.",
            "event_date": now + timedelta(days=4),
            "event_end_date": now + timedelta(days=4, hours=5),
            "ticket_url": "https://jujumermaidbeach.com.au/whats-on",
            "ticket_price": 0,
            "image_url": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800",
            "category": "rooftop",
            "featured": True,
            "featured_artist": {
                "name": "Live Saxophone & DJs",
                "image": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400",
                "bio": "Rooftop sundowner vibes"
            }
        },
        {
            "id": str(uuid.uuid4()),
            "venue_id": "juju",
            "venue_name": "Juju Mermaid Beach",
            "title": "Acoustic Thursdays",
            "description": "Live soloists from 6PM. Chilled cocktails, coastal views, and nibbles like steak tartare, fresh oysters & fish tacos.",
            "event_date": now + timedelta(days=5),
            "event_end_date": now + timedelta(days=5, hours=4),
            "ticket_url": "https://jujumermaidbeach.com.au/whats-on",
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
            "description": "Global house, deep melodic & afro grooves, live percussion by Ethereal Groove Music. Ocean views rooftop experience.",
            "event_date": now + timedelta(days=11),
            "event_end_date": now + timedelta(days=11, hours=7),
            "ticket_url": "https://eventbrite.com.au",
            "ticket_price": 35.00,
            "image_url": "https://images.unsplash.com/photo-1551218808-94e220e084d2?w=800",
            "category": "special_event",
            "featured": True,
            "featured_artist": {
                "name": "Ethereal Groove Music",
                "image": "https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=400",
                "bio": "Global house DJs and live percussionists"
            }
        },
        {
            "id": str(uuid.uuid4()),
            "venue_id": "juju",
            "venue_name": "Juju Mermaid Beach",
            "title": "Friday Sunset Sessions",
            "description": "Start the weekend with ocean sunset views, signature cocktails, and resident DJs on the rooftop.",
            "event_date": now + timedelta(days=1),
            "event_end_date": now + timedelta(days=1, hours=5),
            "ticket_url": "https://jujumermaidbeach.com.au/whats-on",
            "ticket_price": 0,
            "image_url": "https://images.unsplash.com/photo-1540541338287-41700207dee6?w=800",
            "category": "rooftop",
            "featured": False,
            "featured_artist": None
        },
        {
            "id": str(uuid.uuid4()),
            "venue_id": "juju",
            "venue_name": "Juju Mermaid Beach",
            "title": "New Year's Eve 2025",
            "description": "Rooftop party 7-11PM. General admission $49, Rooftop Package $229 (premium drinks & canapes), VIP booths available.",
            "event_date": now + timedelta(days=328),
            "event_end_date": now + timedelta(days=328, hours=5),
            "ticket_url": "https://jujumermaidbeach.com.au",
            "ticket_price": 49.00,
            "image_url": "https://images.unsplash.com/photo-1467810563316-b5476525c0f9?w=800",
            "category": "special_event",
            "featured": True,
            "featured_artist": None
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
