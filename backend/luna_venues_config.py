"""Luna Group Venues Configuration - Real venue data"""
import os

# Get base URL for API (for photo URLs)
API_BASE_URL = os.environ.get('API_BASE_URL', 'https://birthday-rewards-1.preview.emergentagent.com')

# Venue logos (uploaded by client)
VENUE_LOGOS = {
    "eclipse": "https://customer-assets.emergentagent.com/job_celestial-app-5/artifacts/pr03f9wj_Eclipse.webp",
    "juju": "https://customer-assets.emergentagent.com/job_celestial-app-5/artifacts/wzf6k0km_Juju.webp",
    "su_casa_brisbane": "https://customer-assets.emergentagent.com/job_celestial-app-5/artifacts/fb4gjnlf_Sucasa2.webp",
    "su_casa_gold_coast": "https://customer-assets.emergentagent.com/job_celestial-app-5/artifacts/w4lbm1ea_Sucasa1.webp",
    "night_market": "https://customer-assets.emergentagent.com/job_celestial-app-5/artifacts/9rmm0g7d_Night%20market.webp",
    "ember_and_ash": "https://customer-assets.emergentagent.com/job_celestial-app-5/artifacts/c1fkz73x_Ember%20and%20ash.webp",
    "after_dark": "https://customer-assets.emergentagent.com/job_celestial-app-5/artifacts/2f51mmzf_After%20dark.webp",
    "pump": None,  # Logo to be added
    "mamacita": None,  # Logo to be added
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
        "tagline": "The Heart of Brisbane Entertainment",
        "logo_url": "https://customer-assets.emergentagent.com/job_celestial-app-5/artifacts/pr03f9wj_Eclipse.webp",
        "description": "Eclipse is the heart of the entertainment scene in Brisbane and unlike anything the city has experienced before. Hosting international and domestic headliners across a range of genres, stunning visuals and immersive sounds.",
        "long_description": "Eclipse is the heart of the entertainment scene in Brisbane and unlike anything the city has experienced before. Hosting international and domestic headliners across a range of genres, stunning visuals and immersive sounds create an unparalleled nightlife experience in the heart of Fortitude Valley.",
        "features": ["booth_booking", "fast_lane", "auctions", "photos"],
        "points_rate": 1.0,
        "image_url": "https://customer-assets.emergentagent.com/job_35388534-b16b-425d-bea7-94dde1c7e7ca/artifacts/2yvbfaio_Elipse%20Image.jpg",
        "hero_image": "https://customer-assets.emergentagent.com/job_35388534-b16b-425d-bea7-94dde1c7e7ca/artifacts/2yvbfaio_Elipse%20Image.jpg",
        "gallery": [
            "https://customer-assets.emergentagent.com/job_35388534-b16b-425d-bea7-94dde1c7e7ca/artifacts/2yvbfaio_Elipse%20Image.jpg",
            f"{API_BASE_URL}/api/photos/image/eclipse/@CUTBYJACK%20(42%20of%2075).jpg",
            f"{API_BASE_URL}/api/photos/image/eclipse/@CUTBYJACK-51.jpg"
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
        "music_genres": ["EDM", "House", "Electronic", "Various"],
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
        "description": "Get lost in the sound at After Dark, where the music is curated to keep the energy peaking until the early hours. We specialise in a seamless fusion of smooth R&B, infectious Afrobeats, and hard-hitting Hip-Hop.",
        "long_description": "Get lost in the sound at After Dark, where the music is curated to keep the energy peaking until the early hours. We specialise in a seamless fusion of smooth R&B, infectious Afrobeats, and hard-hitting Hip-Hop. The best crowd, best sound, and best vibes in Brisbane.",
        "features": ["booth_booking", "fast_lane", "auctions", "photos", "bottle_service"],
        "points_rate": 1.0,
        "image_url": "https://customer-assets.emergentagent.com/job_35388534-b16b-425d-bea7-94dde1c7e7ca/artifacts/s6rilv8u_After%20Dark%20Image.jpg",
        "hero_image": "https://customer-assets.emergentagent.com/job_35388534-b16b-425d-bea7-94dde1c7e7ca/artifacts/s6rilv8u_After%20Dark%20Image.jpg",
        "gallery": [
            "https://customer-assets.emergentagent.com/job_35388534-b16b-425d-bea7-94dde1c7e7ca/artifacts/s6rilv8u_After%20Dark%20Image.jpg",
            f"{API_BASE_URL}/api/photos/image/afterdark/ER%20(55%20of%20111).jpg",
            f"{API_BASE_URL}/api/photos/image/afterdark/ER%20(72%20of%20111).jpg"
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
        "music_genres": ["Hip Hop", "R&B", "Afrobeats"],
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
        "tagline": "Brisbane's Ultimate Nightlife Destination",
        "logo_url": "https://customer-assets.emergentagent.com/job_celestial-app-5/artifacts/fb4gjnlf_Sucasa2.webp",
        "description": "Su Casa Nightclub & Rooftop is Brisbane's ultimate nightlife destination, featuring a stylish rooftop bar with stunning city views, handcrafted cocktails, and top DJs.",
        "long_description": "Su Casa Nightclub & Rooftop is Brisbane's ultimate nightlife destination, featuring a stylish rooftop bar in Brisbane with stunning city views, handcrafted cocktails, and top DJs. Available for private events and VIP experiences.",
        "features": ["booth_booking", "fast_lane", "auctions", "rooftop_terrace"],
        "points_rate": 1.0,
        "image_url": "https://customer-assets.emergentagent.com/job_35388534-b16b-425d-bea7-94dde1c7e7ca/artifacts/ds5pfxad_SuCasa-2.jpg",
        "hero_image": "https://customer-assets.emergentagent.com/job_35388534-b16b-425d-bea7-94dde1c7e7ca/artifacts/ds5pfxad_SuCasa-2.jpg",
        "gallery": [
            "https://customer-assets.emergentagent.com/job_35388534-b16b-425d-bea7-94dde1c7e7ca/artifacts/ds5pfxad_SuCasa-2.jpg",
            f"{API_BASE_URL}/api/photos/image/sucasa-brisbane/CDSC09838-Enhanced-NR.jpg",
            f"{API_BASE_URL}/api/photos/image/sucasa-brisbane/@CUTBYJACK-36.jpg"
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
        "tagline": "Gold Coast Hip Hop & R&B Destination",
        "logo_url": "https://customer-assets.emergentagent.com/job_celestial-app-5/artifacts/w4lbm1ea_Sucasa1.webp",
        "description": "We curate a sonic journey that honours the roots of the genre while spinning the freshest tracks in the game. It is the ultimate destination in the Gold Coast for those who live for rhythm, the culture, and lovers of hip hop/R&B.",
        "long_description": "We curate a sonic journey that honours the roots of the genre while spinning the freshest tracks in the game. Su Casa Gold Coast is the ultimate destination in the Gold Coast for those who live for rhythm, the culture, and lovers of hip hop/R&B. Premium bottle service and VIP booths await.",
        "features": ["booth_booking", "fast_lane", "auctions", "bottle_service"],
        "points_rate": 1.0,
        "image_url": "https://customer-assets.emergentagent.com/job_35388534-b16b-425d-bea7-94dde1c7e7ca/artifacts/ymy4l2g5_Su%20Casa%20GC%20Image.jpg",
        "hero_image": "https://customer-assets.emergentagent.com/job_35388534-b16b-425d-bea7-94dde1c7e7ca/artifacts/ymy4l2g5_Su%20Casa%20GC%20Image.jpg",
        "gallery": [
            "https://customer-assets.emergentagent.com/job_35388534-b16b-425d-bea7-94dde1c7e7ca/artifacts/ymy4l2g5_Su%20Casa%20GC%20Image.jpg",
            f"{API_BASE_URL}/api/photos/image/sucasa-goldcoast/SuCasa%20(HighRes)-193.jpg",
            f"{API_BASE_URL}/api/photos/image/sucasa-goldcoast/SC%20Bottle%20Service-55.jpg"
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
        "music_genres": ["Hip Hop", "R&B"],
        "dress_code": "Smart casual. No thongs or beachwear.",
        "age_restriction": "18+"
    },
    "juju": {
        "id": "juju",
        "name": "JuJu Mermaid Beach",
        "type": "restaurant",
        "region": "gold_coast",
        "location": "Mermaid Beach, Gold Coast",
        "address": "2235 Gold Coast Hwy, Mermaid Beach QLD 4218",
        "coordinates": {"lat": -28.0450, "lng": 153.4380},
        "accent_color": "#00D4AA",
        "tagline": "Modern Dining in Mermaid Beach",
        "logo_url": "https://customer-assets.emergentagent.com/job_celestial-app-5/artifacts/wzf6k0km_Juju.webp",
        "description": "JuJu introduces a modern dining venue in the iconic Mermaid Beach area that offers seasonally inspired menus featuring the highest quality ingredients and culinary skills. The venue artfully blends incredible food and cocktails with impeccable service and an infectiously fun atmosphere.",
        "long_description": "JuJu introduces a modern dining venue in the iconic Mermaid Beach area that offers seasonally inspired menus featuring the highest quality ingredients and culinary skills. The venue artfully blends incredible food and cocktails with impeccable service and an infectiously fun atmosphere. Perfect for sunset sessions, boozy Sunday brunch, or special occasions.",
        "features": ["rooftop_terrace", "private_dining"],
        "points_rate": 0.5,
        "image_url": "https://customer-assets.emergentagent.com/job_35388534-b16b-425d-bea7-94dde1c7e7ca/artifacts/u2tpomcs_JuJu%201.jpg",
        "hero_image": "https://customer-assets.emergentagent.com/job_35388534-b16b-425d-bea7-94dde1c7e7ca/artifacts/u2tpomcs_JuJu%201.jpg",
        "gallery": [
            "https://customer-assets.emergentagent.com/job_35388534-b16b-425d-bea7-94dde1c7e7ca/artifacts/u2tpomcs_JuJu%201.jpg"
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
        "tagline": "Asian Street Food Experience",
        "logo_url": "https://customer-assets.emergentagent.com/job_celestial-app-5/artifacts/9rmm0g7d_Night%20market.webp",
        "description": "Step into the Night Market and be transported to the bustling laneways of Asia, where neon lights, aromas of wok fried dishes, and the buzz of late-night energy surround you. Our lively market-inspired space captures the chaos and charm of Asia's iconic food scenes.",
        "long_description": "Step into the Night Market and be transported to the bustling laneways of Asia, where neon lights, aromas of wok fried dishes, and the buzz of late-night energy surround you. Our lively market-inspired space captures the chaos and charm of Asia's iconic food scenes. Perfect for groups, date nights, and those seeking authentic Asian-fusion flavors with a modern twist.",
        "features": ["group_dining", "cocktail_bar"],
        "points_rate": 0.5,
        "image_url": "https://customer-assets.emergentagent.com/job_35388534-b16b-425d-bea7-94dde1c7e7ca/artifacts/0kw3wdq0_Night%20Market%20Hero%20Shot%202.jpg",
        "hero_image": "https://customer-assets.emergentagent.com/job_35388534-b16b-425d-bea7-94dde1c7e7ca/artifacts/0kw3wdq0_Night%20Market%20Hero%20Shot%202.jpg",
        "gallery": [
            "https://customer-assets.emergentagent.com/job_35388534-b16b-425d-bea7-94dde1c7e7ca/artifacts/0kw3wdq0_Night%20Market%20Hero%20Shot%202.jpg"
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
        "tagline": "Fire-Inspired Fine Dining",
        "logo_url": "https://customer-assets.emergentagent.com/job_celestial-app-5/artifacts/c1fkz73x_Ember%20and%20ash.webp",
        "description": "Ember & Ash is the restaurant Brisbane chooses for an elevated, fire-inspired, fine dining experience. Our kitchen specialises in the precision of the flame, offering a premium steak range, smouldering meals and an evolving late night rooftop energy.",
        "long_description": "Ember & Ash is the restaurant Brisbane chooses for an elevated, fire-inspired, fine dining experience. Our kitchen specialises in the precision of the flame, offering a premium steak range, smouldering meals and an evolving late night rooftop energy. Combining the warmth of refined casual dining with sophisticated cocktails.",
        "features": ["cocktail_bar", "rooftop_terrace"],
        "points_rate": 0.5,
        "image_url": "https://customer-assets.emergentagent.com/job_35388534-b16b-425d-bea7-94dde1c7e7ca/artifacts/25ud68hm_E%26A%201.jpg",
        "hero_image": "https://customer-assets.emergentagent.com/job_35388534-b16b-425d-bea7-94dde1c7e7ca/artifacts/25ud68hm_E%26A%201.jpg",
        "gallery": [
            "https://customer-assets.emergentagent.com/job_35388534-b16b-425d-bea7-94dde1c7e7ca/artifacts/25ud68hm_E%26A%201.jpg"
        ],
        "operating_hours": {
            "wednesday": "6:00 PM - 12:00 AM",
            "thursday": "6:00 PM - 12:00 AM",
            "friday": "6:00 PM - 12:00 AM",
            "saturday": "6:00 PM - 12:00 AM",
            "sunday": "6:00 PM - 10:00 PM"
        },
        "contact": {
            "website": "https://emberandashbrisbane.com.au"
        },
        "social": {
            "instagram": "@emberandashbrisbane"
        },
        "cuisine": "Modern Australian, Steakhouse",
        "price_range": "$$$"
    },
    "pump": {
        "id": "pump",
        "name": "Pump",
        "type": "nightclub",
        "region": "gold_coast",
        "location": "Surfers Paradise, Gold Coast",
        "address": "Surfers Paradise QLD 4217",
        "coordinates": {"lat": -28.0033, "lng": 153.4300},
        "accent_color": "#FF1493",
        "tagline": "Mainstage EDM Experience",
        "logo_url": "https://customer-assets.emergentagent.com/job_35388534-b16b-425d-bea7-94dde1c7e7ca/artifacts/04hm1xo6_Pump%20logo%20with%20no%20background%20.png",
        "description": "At Pump, we don't just play tracks, we deliver a mainstage experience in the heart of Surfers Paradise, Gold Coast. Specialising in EDM and club beats accompanied by a heavy bass hitting sound system, immersive LED and premium bottle service booths.",
        "long_description": "At Pump, we don't just play tracks, we deliver a mainstage experience in the heart of Surfers Paradise, Gold Coast. Specialising in EDM and club beats accompanied by a heavy bass hitting sound system, immersive LED and premium bottle service booths. The ultimate Gold Coast destination for electronic dance music lovers.",
        "features": ["booth_booking", "fast_lane", "bottle_service"],
        "points_rate": 1.0,
        "image_url": "https://customer-assets.emergentagent.com/job_35388534-b16b-425d-bea7-94dde1c7e7ca/artifacts/bzc5f147_Pump%20Night%20Club.png",
        "hero_image": "https://customer-assets.emergentagent.com/job_35388534-b16b-425d-bea7-94dde1c7e7ca/artifacts/bzc5f147_Pump%20Night%20Club.png",
        "gallery": [
            "https://customer-assets.emergentagent.com/job_35388534-b16b-425d-bea7-94dde1c7e7ca/artifacts/bzc5f147_Pump%20Night%20Club.png"
        ],
        "operating_hours": {
            "friday": "9:00 PM - 3:00 AM",
            "saturday": "9:00 PM - 3:00 AM"
        },
        "contact": {
            "website": "https://pumpgoldcoast.com.au"
        },
        "social": {
            "instagram": "@pumpgoldcoast"
        },
        "music_genres": ["EDM", "Club Beats", "Electronic"],
        "dress_code": "Smart casual. No thongs or beachwear.",
        "age_restriction": "18+"
    },
    "mamacita": {
        "id": "mamacita",
        "name": "Mamacita",
        "type": "nightclub",
        "region": "gold_coast",
        "location": "Surfers Paradise, Gold Coast",
        "address": "Surfers Paradise QLD 4217",
        "coordinates": {"lat": -28.0028, "lng": 153.4298},
        "accent_color": "#FF4500",
        "tagline": "Latin & Urban Heat",
        "logo_url": "https://customer-assets.emergentagent.com/job_35388534-b16b-425d-bea7-94dde1c7e7ca/artifacts/rfwu9zz9_Mamacita%20logo%20with%20no%20background%20.PNG",
        "description": "Feel the heat of the world's most infectious rhythms. At Mamacita, we champion the global explosion of Latin and Urban sounds, delivering a night of relentless momentum transitioning from sultry, low-tempo grinds to peak-hour club anthems.",
        "long_description": "Feel the heat of the world's most infectious rhythms. At Mamacita, we champion the global explosion of Latin and Urban sounds, delivering a night of relentless momentum transitioning from sultry, low-tempo grinds to peak-hour club anthems. The Gold Coast's premier Latin nightclub experience.",
        "features": ["booth_booking", "fast_lane", "bottle_service"],
        "points_rate": 1.0,
        "image_url": "https://customer-assets.emergentagent.com/job_35388534-b16b-425d-bea7-94dde1c7e7ca/artifacts/c2t6l9dq_Mamacita%20Night%20Club.png",
        "hero_image": "https://customer-assets.emergentagent.com/job_35388534-b16b-425d-bea7-94dde1c7e7ca/artifacts/c2t6l9dq_Mamacita%20Night%20Club.png",
        "gallery": [
            "https://customer-assets.emergentagent.com/job_35388534-b16b-425d-bea7-94dde1c7e7ca/artifacts/c2t6l9dq_Mamacita%20Night%20Club.png"
        ],
        "operating_hours": {
            "friday": "9:00 PM - 3:00 AM",
            "saturday": "9:00 PM - 3:00 AM"
        },
        "contact": {
            "website": "https://mamacitaclub.com.au"
        },
        "social": {
            "instagram": "@mamacitaclub"
        },
        "music_genres": ["Latin", "Urban", "Reggaeton"],
        "dress_code": "Smart casual. No thongs or beachwear.",
        "age_restriction": "18+"
    }
}
