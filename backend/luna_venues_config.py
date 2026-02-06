"""Luna Group Venues Configuration - Real venue data"""

# Venue logos (uploaded by client)
VENUE_LOGOS = {
    "eclipse": "https://customer-assets.emergentagent.com/job_celestial-app-5/artifacts/pr03f9wj_Eclipse.webp",
    "juju": "https://customer-assets.emergentagent.com/job_celestial-app-5/artifacts/wzf6k0km_Juju.webp",
    "su_casa_brisbane": "https://customer-assets.emergentagent.com/job_celestial-app-5/artifacts/fb4gjnlf_Sucasa2.webp",
    "su_casa_gold_coast": "https://customer-assets.emergentagent.com/job_celestial-app-5/artifacts/w4lbm1ea_Sucasa1.webp",
    "night_market": "https://customer-assets.emergentagent.com/job_celestial-app-5/artifacts/9rmm0g7d_Night%20market.webp",
    "ember_and_ash": "https://customer-assets.emergentagent.com/job_celestial-app-5/artifacts/c1fkz73x_Ember%20and%20ash.webp",
    "after_dark": "https://customer-assets.emergentagent.com/job_celestial-app-5/artifacts/2f51mmzf_After%20dark.webp",
}

LUNA_VENUES = {
    "eclipse": {
        "id": "eclipse",
        "name": "Eclipse",
        "type": "nightclub",
        "region": "brisbane",
        "location": "Fortitude Valley, Brisbane",
        "address": "247 Brunswick St, Fortitude Valley QLD 4006",
        "coordinates": {"lat": -27.4572, "lng": 153.0347},
        "accent_color": "#E31837",
        "tagline": "Discover New Nightlife",
        "logo_url": "https://customer-assets.emergentagent.com/job_celestial-app-5/artifacts/pr03f9wj_Eclipse.webp",
        "description": "Brisbane's transformative super club with international and domestic headliners across a range of genres. A new phase for the Brisbane entertainment scene unlike anything the city has experienced before.",
        "long_description": "Eclipse is Brisbane's premier destination for world-class nightlife. Featuring state-of-the-art sound systems, immersive lighting installations, and hosting international and domestic headliners across hip hop, RnB, house, and electronic genres. Experience the transformation of Brisbane's entertainment scene in the heart of Fortitude Valley.",
        "features": ["booth_booking", "fast_lane", "auctions", "photos", "vip_tables"],
        "points_rate": 1.0,
        "image_url": "https://images.unsplash.com/photo-1640287336286-e47879e1ff9c?w=800",
        "hero_image": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200",
        "gallery": [
            "https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=800",
            "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800",
            "https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?w=800"
        ],
        "operating_hours": {
            "friday": "9:00 PM - 3:00 AM",
            "saturday": "9:00 PM - 3:00 AM"
        },
        "contact": {
            "email": "hello@eclipsebrisbane.com.au",
            "website": "https://eclipsebrisbane.com.au"
        },
        "social": {
            "instagram": "@eclipsebrisbane",
            "facebook": "eclipsebrisbane"
        },
        "music_genres": ["Hip Hop", "RnB", "House", "Electronic"],
        "dress_code": "Smart casual to upscale. No sportswear, thongs, or offensive clothing.",
        "age_restriction": "18+"
    },
    "after_dark": {
        "id": "after_dark",
        "name": "After Dark",
        "type": "nightclub",
        "region": "brisbane",
        "location": "Fortitude Valley, Brisbane",
        "address": "247 Brunswick St, Fortitude Valley QLD 4006",
        "coordinates": {"lat": -27.4572, "lng": 153.0347},
        "accent_color": "#8B00FF",
        "tagline": "R&B, Hip Hop & Afrobeats",
        "logo_url": "https://customer-assets.emergentagent.com/job_celestial-app-5/artifacts/2f51mmzf_After%20dark.webp",
        "description": "Brisbane's biggest multi-room super club. Specialising in hip hop, RnB, Afrobeats and Global Sounds with premium sound and lighting.",
        "long_description": "After Dark transforms the Eclipse space into Brisbane's ultimate destination for urban music. Every Saturday night, experience the best in hip hop, RnB, Afrobeats, and global sounds across multiple rooms. Premium bottle service, VIP booths, and an incredible atmosphere await. The best crowd, best sound, and best vibes in Brisbane.",
        "features": ["booth_booking", "fast_lane", "auctions", "photos", "bottle_service"],
        "points_rate": 1.0,
        "image_url": "https://images.unsplash.com/photo-1640287328467-972983417090?w=800",
        "hero_image": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200",
        "gallery": [
            "https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=800",
            "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800",
            "https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=800"
        ],
        "operating_hours": {
            "friday": "9:00 PM - 3:00 AM",
            "saturday": "9:00 PM - 3:00 AM"
        },
        "contact": {
            "email": "hello@eclipsebrisbane.com.au",
            "website": "https://eclipsebrisbane.com.au/after-dark"
        },
        "social": {
            "instagram": "@afterdarkbrisbane",
            "facebook": "afterdarkbrisbane"
        },
        "music_genres": ["Hip Hop", "RnB", "Afrobeats", "Global Sounds"],
        "dress_code": "Smart casual. No sportswear or offensive clothing.",
        "age_restriction": "18+"
    },
    "su_casa_brisbane": {
        "id": "su_casa_brisbane",
        "name": "Su Casa Brisbane",
        "type": "bar",
        "region": "brisbane",
        "location": "Fortitude Valley, Brisbane",
        "address": "648 Ann St, Fortitude Valley QLD 4006",
        "coordinates": {"lat": -27.4575, "lng": 153.0350},
        "accent_color": "#FFB800",
        "tagline": "Rooftop Bar & Nightlife",
        "logo_url": "https://customer-assets.emergentagent.com/job_celestial-app-5/artifacts/fb4gjnlf_Sucasa2.webp",
        "description": "Vibrant rooftop bar and nightclub offering tapas, cocktails, and DJ vibes above the main nightclub in Fortitude Valley.",
        "long_description": "Su Casa Brisbane is your ultimate rooftop escape in the heart of Fortitude Valley. Enjoy stunning city views, signature cocktails, and shareable tapas as the sun sets. As night falls, the vibe transforms with resident DJs spinning the best house, disco, and party anthems. Available for private events and VIP experiences.",
        "features": ["booth_booking", "fast_lane", "auctions", "rooftop_terrace"],
        "points_rate": 1.0,
        "image_url": "https://images.unsplash.com/photo-1736230991313-ebf59110ea8c?w=800",
        "hero_image": "https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=1200",
        "gallery": [
            "https://images.unsplash.com/photo-1613066697301-d7dccfc86bb5?w=800",
            "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800",
            "https://images.unsplash.com/photo-1525268323446-0505b6fe7778?w=800"
        ],
        "operating_hours": {
            "wednesday": "5:00 PM - 3:00 AM",
            "thursday": "5:00 PM - 3:00 AM",
            "friday": "3:00 PM - 3:00 AM",
            "saturday": "3:00 PM - 3:00 AM",
            "sunday": "4:00 PM - 3:00 AM"
        },
        "contact": {
            "website": "https://sucasabrisbane.com"
        },
        "social": {
            "instagram": "@sucasabrisbane"
        },
        "music_genres": ["House", "Disco", "Party"],
        "dress_code": "Smart casual. Upscale attire recommended.",
        "age_restriction": "18+"
    },
    "su_casa_gold_coast": {
        "id": "su_casa_gold_coast",
        "name": "Su Casa Gold Coast",
        "type": "nightclub",
        "region": "gold_coast",
        "location": "Surfers Paradise, Gold Coast",
        "address": "19 Orchid Ave, Surfers Paradise QLD 4217",
        "coordinates": {"lat": -28.0023, "lng": 153.4295},
        "accent_color": "#FF6B35",
        "tagline": "Gold Coast's Premier Late-Night Destination",
        "logo_url": "https://customer-assets.emergentagent.com/job_celestial-app-5/artifacts/w4lbm1ea_Sucasa1.webp",
        "description": "Late-night club in the heart of Surfers Paradise focusing on Hip Hop and R&B. The Gold Coast's ultimate party destination.",
        "long_description": "Su Casa Gold Coast brings the renowned Su Casa experience to Surfers Paradise. Open Thursday through Sunday, experience the best in Hip Hop, R&B, and party anthems. Premium bottle service, VIP booths, and the Gold Coast's most electric atmosphere await you in the heart of the action on Orchid Avenue.",
        "features": ["booth_booking", "fast_lane", "auctions", "bottle_service"],
        "points_rate": 1.0,
        "image_url": "https://images.unsplash.com/photo-1613066697301-d7dccfc86bb5?w=800",
        "hero_image": "https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=1200",
        "gallery": [
            "https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?w=800",
            "https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=800",
            "https://images.unsplash.com/photo-1545128485-c400ce7b23d5?w=800"
        ],
        "operating_hours": {
            "thursday": "9:00 PM - 3:00 AM",
            "friday": "9:00 PM - 3:00 AM",
            "saturday": "9:00 PM - 3:00 AM",
            "sunday": "9:00 PM - 3:00 AM"
        },
        "contact": {
            "email": "hello@sucasagoldcoast.com.au"
        },
        "social": {
            "instagram": "@sucasagoldcoast"
        },
        "music_genres": ["Hip Hop", "R&B", "Party"],
        "dress_code": "Smart casual. No thongs or beachwear.",
        "age_restriction": "18+"
    },
    "juju": {
        "id": "juju",
        "name": "Juju Mermaid Beach",
        "type": "restaurant",
        "region": "gold_coast",
        "location": "Mermaid Beach, Gold Coast",
        "address": "2235 Gold Coast Hwy, Mermaid Beach QLD 4218",
        "coordinates": {"lat": -28.0450, "lng": 153.4380},
        "accent_color": "#00D4AA",
        "tagline": "Modern Australian Rooftop Dining",
        "logo_url": "https://customer-assets.emergentagent.com/job_celestial-app-5/artifacts/wzf6k0km_Juju.webp",
        "description": "Restaurant & rooftop bar with panoramic coastal views, modern Australian cuisine, and cocktails on the Gold Coast.",
        "long_description": "Juju Mermaid Beach offers an elevated dining experience with stunning panoramic coastal views. The open-air rooftop terrace features a retractable roof, signature cocktails, and modern Australian bar fare. Downstairs, enjoy refined modern Australian cuisine in an intimate setting. Perfect for sunset sessions, boozy Sunday brunch, or special occasions.",
        "features": ["table_booking", "rooftop_terrace", "private_dining"],
        "points_rate": 0.5,
        "image_url": "https://images.unsplash.com/photo-1613066697157-e8345495b665?w=800",
        "hero_image": "https://images.unsplash.com/photo-1551218808-94e220e084d2?w=1200",
        "gallery": [
            "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800",
            "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800",
            "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800"
        ],
        "operating_hours": {
            "wednesday": "12:00 PM - 12:00 AM",
            "thursday": "12:00 PM - 12:00 AM",
            "friday": "12:00 PM - 12:00 AM",
            "saturday": "12:00 PM - 12:00 AM",
            "sunday": "11:00 AM - 12:00 AM"
        },
        "contact": {
            "website": "https://jujumermaidbeach.com.au"
        },
        "social": {
            "instagram": "@jujumermaidbeach"
        },
        "cuisine": "Modern Australian",
        "price_range": "$$$",
        "dietary_options": ["Vegetarian", "Vegan", "Gluten-Free"]
    },
    "night_market": {
        "id": "night_market",
        "name": "Night Market",
        "type": "restaurant",
        "region": "brisbane",
        "location": "Fortitude Valley, Brisbane",
        "address": "1/247 Brunswick St, Fortitude Valley QLD 4006",
        "coordinates": {"lat": -27.4580, "lng": 153.0345},
        "accent_color": "#FF4757",
        "tagline": "Pan-Asian Street Food & Cocktails",
        "logo_url": "https://customer-assets.emergentagent.com/job_celestial-app-5/artifacts/9rmm0g7d_Night%20market.webp",
        "description": "Pan-Asian themed bar and restaurant inspired by Asia's street markets, serving shareable small plates in a neon-lit atmosphere.",
        "long_description": "Night Market brings the vibrant energy of Asia's street markets to Fortitude Valley. Experience shareable small plates like wagyu tartare and miso caramel popcorn chicken, alongside innovative cocktails in a neon-lit, lively atmosphere. Perfect for groups, date nights, and those seeking authentic Asian-fusion flavors with a modern twist.",
        "features": ["table_booking", "group_dining", "cocktail_bar"],
        "points_rate": 0.5,
        "image_url": "https://images.unsplash.com/photo-1672172505672-babacdc28071?w=800",
        "hero_image": "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200",
        "gallery": [
            "https://images.unsplash.com/photo-1504544750208-dc0358e63f7f?w=800",
            "https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=800",
            "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800"
        ],
        "operating_hours": {
            "wednesday": "6:00 PM - 10:30 PM",
            "thursday": "6:00 PM - 11:00 PM",
            "friday": "6:00 PM - 11:00 PM",
            "saturday": "6:00 PM - 11:00 PM"
        },
        "contact": {
            "phone": "07 3213 0011",
            "website": "https://nightmarketbrisbane.com.au"
        },
        "social": {
            "instagram": "@nightmarketbrisbane"
        },
        "cuisine": "Pan-Asian, Japanese Fusion",
        "price_range": "$$",
        "dietary_options": ["Vegetarian", "Vegan", "Gluten-Free", "Dairy-Free"]
    },
    "ember_and_ash": {
        "id": "ember_and_ash",
        "name": "Ember & Ash",
        "type": "restaurant",
        "region": "brisbane",
        "location": "Brisbane CBD",
        "address": "Brisbane CBD QLD 4000",
        "coordinates": {"lat": -27.4698, "lng": 153.0251},
        "accent_color": "#FFA502",
        "tagline": "Good Food, Great Drinks, Better Company",
        "logo_url": "https://customer-assets.emergentagent.com/job_celestial-app-5/artifacts/c1fkz73x_Ember%20and%20ash.webp",
        "description": "Restaurant, cafe & bar coming soon to Brisbane CBD. Good food, great drinks, and better company.",
        "long_description": "Ember & Ash is Brisbane's upcoming destination for refined casual dining. Combining the warmth of a neighborhood cafe with the sophistication of a cocktail bar, we're creating a space where good food meets great drinks and even better company. Opening soon in Brisbane CBD.",
        "features": ["table_booking", "cocktail_bar", "cafe"],
        "points_rate": 0.5,
        "image_url": "https://images.unsplash.com/photo-1689239719024-8f0866438b46?w=800",
        "hero_image": "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200",
        "gallery": [
            "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800",
            "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800",
            "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800"
        ],
        "operating_hours": {
            "status": "Coming Soon"
        },
        "contact": {
            "website": "https://emberandashbrisbane.com.au"
        },
        "social": {
            "instagram": "@emberandashbrisbane"
        },
        "cuisine": "Modern Australian",
        "price_range": "$$"
    }
}
