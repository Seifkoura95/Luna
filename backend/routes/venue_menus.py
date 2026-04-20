"""
View-only food & drinks menus for Luna Group venues that do not sell bottle service.
Currently: JuJu's (food + drinks) and Night Market (food + drinks).
"""
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/venues", tags=["venue-menus"])


# ─── JuJu's Menu ─────────────────────────────────────────────────────────────
JUJU_FOOD = {
    "Lighter Plates": [
        {"name": "Oysters, Mignonette", "desc": "Chilled Pacific oysters with red wine mignonette", "price": 6.0, "unit": "each"},
        {"name": "Wagyu & Gruyère Croquette", "desc": "Crumbed wagyu & gruyère croquette with smoked aioli", "price": 9.0, "unit": "each"},
        {"name": "Kingfish Sashimi", "desc": "Kingfish, yuzu ponzu, jalapeño, radish", "price": 28.0},
        {"name": "Wagyu Beef Tartare", "desc": "Wagyu beef, egg yolk, cornichon, brioche toast", "price": 32.0},
        {"name": "Burrata", "desc": "Burrata, heirloom tomato, basil, aged balsamic", "price": 26.0},
        {"name": "Tuna Tataki", "desc": "Seared yellowfin, wasabi mayo, pickled ginger", "price": 30.0},
    ],
    "Signature Wagyu Range": [
        {"name": "Wagyu Striploin 250g (MB7+)", "desc": "Full-blood wagyu, grilled, café de Paris butter", "price": 89.0},
        {"name": "Wagyu Rib Eye 350g (MB9+)", "desc": "Full-blood wagyu rib eye, bone marrow gravy", "price": 145.0},
        {"name": "Wagyu Tomahawk 1kg (MB5+)", "desc": "Dry-aged wagyu tomahawk, roasted garlic, rosemary", "price": 280.0},
    ],
    "Mains": [
        {"name": "Market Fish", "desc": "Pan-seared, brown butter, capers, lemon", "price": 48.0},
        {"name": "Duck Breast", "desc": "Five-spice duck, cherry jus, celeriac purée", "price": 52.0},
        {"name": "Lamb Rack", "desc": "Herb-crusted lamb, mint salsa verde, dauphinoise", "price": 56.0},
        {"name": "Spring Risotto", "desc": "Asparagus, peas, parmesan, truffle oil", "price": 38.0},
    ],
    "Sides": [
        {"name": "Truffle Fries", "desc": "Hand-cut fries, truffle oil, parmesan", "price": 16.0},
        {"name": "Heirloom Carrots", "desc": "Honey-glazed, dukkah, yoghurt", "price": 14.0},
        {"name": "Mac & Cheese", "desc": "Three-cheese blend, panko crust", "price": 18.0},
        {"name": "Garden Salad", "desc": "Mixed leaves, vinaigrette", "price": 12.0},
    ],
    "Desserts": [
        {"name": "Crème Brûlée", "desc": "Vanilla bean, candied orange", "price": 18.0},
        {"name": "Chocolate Fondant", "desc": "Warm molten centre, vanilla ice cream", "price": 20.0},
        {"name": "Cheese Board", "desc": "Three cheeses, quince paste, lavosh, nuts", "price": 26.0},
    ],
}

JUJU_DRINKS = {
    "Signature Cocktails": [
        {"name": "JuJu Spritz", "desc": "Prosecco, Aperol, elderflower, grapefruit", "price": 22.0},
        {"name": "Smoked Old Fashioned", "desc": "Bourbon, demerara, bitters, hickory smoke", "price": 26.0},
        {"name": "Lychee Martini", "desc": "Vodka, lychee liqueur, lime, sugar rim", "price": 24.0},
        {"name": "Espresso Martini", "desc": "Vodka, Kahlúa, espresso, vanilla", "price": 22.0},
        {"name": "Pornstar Martini", "desc": "Vanilla vodka, passionfruit, prosecco side", "price": 24.0},
    ],
    "Classics": [
        {"name": "Negroni", "desc": "Gin, Campari, sweet vermouth", "price": 20.0},
        {"name": "Manhattan", "desc": "Rye whiskey, sweet vermouth, bitters", "price": 22.0},
        {"name": "Mojito", "desc": "Rum, lime, mint, soda", "price": 20.0},
        {"name": "Margarita", "desc": "Tequila, Cointreau, fresh lime, salt rim", "price": 20.0},
    ],
    "Wine By Glass": [
        {"name": "House Sparkling", "desc": "Brut NV, Yarra Valley", "price": 14.0, "unit": "glass"},
        {"name": "Sauvignon Blanc", "desc": "Marlborough NZ", "price": 15.0, "unit": "glass"},
        {"name": "Chardonnay", "desc": "Margaret River WA", "price": 17.0, "unit": "glass"},
        {"name": "Pinot Noir", "desc": "Mornington Peninsula", "price": 18.0, "unit": "glass"},
        {"name": "Shiraz", "desc": "Barossa Valley SA", "price": 17.0, "unit": "glass"},
    ],
    "Beer": [
        {"name": "Peroni Nastro Azzurro", "price": 12.0, "unit": "bottle"},
        {"name": "Asahi Super Dry", "price": 12.0, "unit": "bottle"},
        {"name": "Stone & Wood Pacific Ale", "price": 13.0, "unit": "bottle"},
        {"name": "Corona", "price": 11.0, "unit": "bottle"},
    ],
    "Spirits": [
        {"name": "Grey Goose Vodka", "price": 18.0, "unit": "nip"},
        {"name": "Hendrick's Gin", "price": 18.0, "unit": "nip"},
        {"name": "Don Julio Blanco", "price": 20.0, "unit": "nip"},
        {"name": "Macallan 12 Year", "price": 28.0, "unit": "nip"},
        {"name": "Hennessy VSOP", "price": 24.0, "unit": "nip"},
    ],
}


# ─── Night Market Menu ───────────────────────────────────────────────────────
NIGHT_MARKET_FOOD = {
    "Raw": [
        {"name": "Kingfish Crudo", "desc": "Yuzu, chilli, sesame", "price": 26.0},
        {"name": "Salmon Sashimi", "desc": "Ponzu, nori, finger lime", "price": 24.0},
        {"name": "Tuna Tataki", "desc": "Sesame-crusted, wasabi mayo", "price": 28.0},
    ],
    "Snacks": [
        {"name": "Edamame", "desc": "Sea salt & yuzu", "price": 9.0},
        {"name": "Chicken Karaage", "desc": "Japanese fried chicken, kewpie", "price": 16.0},
        {"name": "Pork Gyoza", "desc": "5 pc, chilli vinegar", "price": 14.0},
        {"name": "Takoyaki", "desc": "Octopus balls, bonito, takoyaki sauce", "price": 14.0},
    ],
    "Skewers": [
        {"name": "Chicken Yakitori", "desc": "Tare glaze, spring onion", "price": 7.0, "unit": "skewer"},
        {"name": "Beef Short Rib", "desc": "Gochujang glaze, sesame", "price": 9.0, "unit": "skewer"},
        {"name": "Tiger Prawn", "desc": "Garlic butter, chilli", "price": 11.0, "unit": "skewer"},
        {"name": "Wagyu Kushi", "desc": "MB7+ wagyu, truffle ponzu", "price": 14.0, "unit": "skewer"},
    ],
    "Sandos": [
        {"name": "Wagyu Katsu Sando", "desc": "Panko-crusted wagyu, tonkatsu, milk bread", "price": 34.0},
        {"name": "Soft Shell Crab Sando", "desc": "Crispy soft shell, spicy mayo", "price": 26.0},
        {"name": "Fried Chicken Sando", "desc": "Buttermilk chicken, kewpie, slaw", "price": 22.0},
    ],
    "Share Plates": [
        {"name": "Miso-Glazed Black Cod", "desc": "Saikyo miso, pickled ginger", "price": 46.0},
        {"name": "Korean Fried Chicken", "desc": "Gochujang glaze, sesame, shallots", "price": 32.0},
        {"name": "Char Siu Pork Belly", "desc": "Steamed bun, hoisin, cucumber", "price": 28.0},
        {"name": "Whole Grilled Snapper", "desc": "Nam jim, fresh herbs", "price": 54.0},
    ],
    "Sides": [
        {"name": "Steamed Jasmine Rice", "price": 6.0},
        {"name": "Garlic Bok Choy", "desc": "Oyster sauce", "price": 12.0},
        {"name": "Prawn Crackers", "price": 8.0},
    ],
    "Sweet": [
        {"name": "Matcha Tiramisu", "desc": "Mascarpone, matcha, ladyfingers", "price": 16.0},
        {"name": "Mochi Ice Cream", "desc": "3 flavours — yuzu, black sesame, mango", "price": 14.0},
        {"name": "Taiyaki", "desc": "Fish-shaped waffle, red bean, vanilla ice cream", "price": 15.0},
    ],
    "Chef's Banquet": [
        {"name": "Banquet Menu", "desc": "8 courses chef's selection, min. 2 people. Vegetarian available.", "price": 95.0, "unit": "per person"},
    ],
}

NIGHT_MARKET_DRINKS = {
    "Cocktails": [
        {"name": "Shiso Gin Smash", "desc": "Gin, shiso, lime, yuzu", "price": 22.0},
        {"name": "Yuzu Margarita", "desc": "Tequila, yuzu, triple sec, chilli salt", "price": 22.0},
        {"name": "Tokyo Sour", "desc": "Japanese whisky, umeshu, lemon, egg white", "price": 24.0},
        {"name": "Lychee Negroni", "desc": "Gin, lychee liqueur, Campari, vermouth", "price": 22.0},
        {"name": "Sake-Tini", "desc": "Vodka, sake, cucumber, lime", "price": 22.0},
    ],
    "Sake": [
        {"name": "Junmai Daiginjo", "desc": "Premium rice polish — floral & silky", "price": 22.0, "unit": "glass 100mL"},
        {"name": "Nigori Cloudy Sake", "desc": "Unfiltered, creamy, slightly sweet", "price": 16.0, "unit": "glass"},
        {"name": "Dassai 45", "desc": "Yamaguchi premium junmai daiginjo", "price": 120.0, "unit": "bottle 720mL"},
    ],
    "Wines": [
        {"name": "Riesling", "desc": "Clare Valley — dry & citrusy", "price": 15.0, "unit": "glass"},
        {"name": "Gewürztraminer", "desc": "Alsace — lychee & spice", "price": 17.0, "unit": "glass"},
        {"name": "Pinot Gris", "desc": "Mornington Peninsula", "price": 15.0, "unit": "glass"},
        {"name": "Chilled Gamay", "desc": "Beaujolais — light red, served chilled", "price": 18.0, "unit": "glass"},
    ],
    "Beers": [
        {"name": "Asahi Super Dry", "price": 11.0, "unit": "bottle"},
        {"name": "Kirin Ichiban", "price": 12.0, "unit": "bottle"},
        {"name": "Hitachino Nest White Ale", "price": 14.0, "unit": "bottle"},
        {"name": "Orion Draft", "price": 12.0, "unit": "draft"},
    ],
    "Highballs": [
        {"name": "Toki Highball", "desc": "Suntory Toki, soda, lemon peel", "price": 18.0},
        {"name": "Roku Gin Soda", "desc": "Roku gin, tonic, yuzu peel", "price": 18.0},
    ],
}


VENUE_MENUS = {
    "juju": {
        "venue_name": "JuJu's",
        "description": "Modern dining reimagined. Wagyu, craft cocktails, rooftop views.",
        "food": JUJU_FOOD,
        "drinks": JUJU_DRINKS,
    },
    "night_market": {
        "venue_name": "Night Market",
        "description": "Asian-inspired share plates and premium sake in a neon-lit izakaya.",
        "food": NIGHT_MARKET_FOOD,
        "drinks": NIGHT_MARKET_DRINKS,
    },
    "ember_and_ash": {
        "venue_name": "Ember & Ash",
        "description": "Fire-kissed fine dining. Premium steak, flame-forged flavour, rooftop energy.",
        "food": {
            "Snacks": [
                {"name": "20g Baeri Sturgeon Caviar Service", "desc": "Blinis, crème fraîche, house condiments", "price": 0, "unit": "MP"},
                {"name": "Rock Oysters", "desc": "Blackberry mignonette", "price": 0, "unit": "MP"},
            ],
            "Small Plates": [
                {"name": "Beef Tartare", "desc": "Hand-cut, smoked egg yolk, textural garnish", "price": 0, "unit": "MP"},
                {"name": "White Fish Crudo", "desc": "Zesty citrus, refined heat", "price": 0, "unit": "MP"},
            ],
            "Large Plates": [
                {"name": "Crab & Prawn Ravioli", "desc": "Coastal elegance, bisque reduction", "price": 0, "unit": "MP"},
                {"name": "Char-Grilled Duck Breast", "desc": "Flame-kissed, seasonal jus", "price": 0, "unit": "MP"},
                {"name": "Slow Roasted Pork Neck", "desc": "Robust, flame-kissed, signature glaze", "price": 0, "unit": "MP"},
            ],
            "Steaks": [
                {"name": "9+ Rump Cap", "desc": "Tender, flame-kissed. Choice of sauce.", "price": 0, "unit": "MP"},
                {"name": "5+ Tomahawk", "desc": "Massive, caramelised crust, share-size. Choice of sauce.", "price": 0, "unit": "MP"},
                {"name": "Sauce Selection", "desc": "Au Poivre · Café de Paris · Smoked Marrow Jus · Red Wine Jus · Porcini Cream", "price": 0, "unit": "incl."},
            ],
            "Sides": [
                {"name": "Twice Cooked Potatoes", "desc": "Sherry gastrique, house-smoked sour cream", "price": 0, "unit": "MP"},
            ],
            "Chef's Experiences": [
                {"name": "Chef's Menu", "desc": "Signature curated selection from Beef Tartare to Slow Roasted Pork Neck", "price": 99.0, "unit": "per person"},
                {"name": "Wagyu Tasting Experience", "desc": "Curated premium cuts, choice of side and signature sauce", "price": 225.0, "unit": "per person"},
            ],
            "Desserts": [
                {"name": "Strawberries & Cream", "desc": "Elegant, seasonal", "price": 0, "unit": "MP"},
                {"name": "White Chocolate & Koji", "desc": "Bold, sweet, fermented richness", "price": 0, "unit": "MP"},
            ],
        },
        "drinks": {
            "Signature Cocktails": [
                {"name": "Ember Old Fashioned", "desc": "Smoked bourbon, demerara, house bitters", "price": 26.0},
                {"name": "Ash Negroni", "desc": "Charred orange peel, Campari, sweet vermouth, gin", "price": 24.0},
                {"name": "Flame Sour", "desc": "Mezcal, lime, egg white, chilli salt rim", "price": 24.0},
            ],
            "Wine By Glass": [
                {"name": "House Sparkling", "desc": "Brut NV", "price": 14.0, "unit": "glass"},
                {"name": "Chardonnay", "desc": "Margaret River", "price": 17.0, "unit": "glass"},
                {"name": "Pinot Noir", "desc": "Mornington Peninsula", "price": 18.0, "unit": "glass"},
                {"name": "Shiraz", "desc": "Barossa Valley", "price": 18.0, "unit": "glass"},
            ],
            "Spirits": [
                {"name": "Japanese Whisky Selection", "desc": "Toki, Hibiki, Yamazaki — ask your waiter", "price": 0, "unit": "MP"},
                {"name": "Cognac Selection", "desc": "Hennessy VSOP, XO, Louis XIII — ask your waiter", "price": 0, "unit": "MP"},
            ],
        },
    },
    "ember_and_ash_cafe": {
        "venue_name": "Ember & Ash — Cafe",
        "description": "Fire-kissed mornings. Artisanal bagels, slow-roasted coffee, smoked brisket.",
        "food": {
            "Bagels": [
                {"name": "Gin Cured Salmon Bagel", "desc": "Zesty zing, house-cured salmon", "price": 0, "unit": "MP"},
                {"name": "Halloumi & Hummus Bagel", "desc": "Earthy, creamy, portable brunch", "price": 0, "unit": "MP"},
                {"name": "Smokey Braised Brisket Bagel", "desc": "Slow-cooked brisket, punchy slaw", "price": 0, "unit": "MP"},
            ],
            "Sourdough": [
                {"name": "Thick Cut Sourdough", "desc": "House-made seasonal jam", "price": 0, "unit": "MP"},
                {"name": "Eggs Your Way on Sourdough", "desc": "Fried, poached, or scrambled", "price": 0, "unit": "MP"},
            ],
            "Signature Dishes": [
                {"name": "Potato Gem Benny", "desc": "Golden crunch, poached eggs, hollandaise", "price": 0, "unit": "MP"},
                {"name": "Açai Bowl", "desc": "Fresh fruit, granola, honey", "price": 0, "unit": "MP"},
                {"name": "Wood-Fired Haloumi Plate", "desc": "Artisanal textures, flame-kissed", "price": 0, "unit": "MP"},
            ],
        },
        "drinks": {
            "Coffee & Matcha": [
                {"name": "Espresso", "desc": "Slow-roasted house blend", "price": 4.5},
                {"name": "Long Black", "price": 5.0},
                {"name": "Flat White / Latte / Cappuccino", "price": 5.5},
                {"name": "Matcha Latte", "desc": "Ceremonial-grade matcha", "price": 6.5},
            ],
            "Cold Drinks": [
                {"name": "Cold Brew", "desc": "24h steeped, chilled", "price": 6.5},
                {"name": "Pineapple Bliss Juice", "desc": "Cold-pressed, pure", "price": 8.5},
                {"name": "Milkshakes", "desc": "Chocolate · Vanilla · Strawberry · Salted Caramel", "price": 9.0},
            ],
        },
    },
}


@router.get("/{venue_id}/menu")
async def get_venue_menu(venue_id: str):
    """View-only food + drinks menu for JuJu's and Night Market."""
    menu = VENUE_MENUS.get(venue_id)
    if not menu:
        raise HTTPException(status_code=404, detail=f"No menu available for {venue_id}")
    return {"venue_id": venue_id, **menu}
