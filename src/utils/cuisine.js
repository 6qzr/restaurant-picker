/** Canonical cuisine taxonomy.
 *
 *  OSM `cuisine=` is free-form and semicolon-separated ("pizza;italian"), with a
 *  long tail of synonyms. We fold it into a small canonical set so the diversity
 *  constraint ("never three pizza places") and the filter chips both have
 *  something stable to reason about.
 */

export const CUISINE_SYNONYMS = {
    pizza: 'pizza',
    italian: 'italian',
    pasta: 'italian',
    burger: 'burger',
    hamburger: 'burger',
    sandwich: 'sandwich',
    kebab: 'middle_eastern',
    shawarma: 'middle_eastern',
    lebanese: 'middle_eastern',
    arab: 'middle_eastern',
    arabic: 'middle_eastern',
    syrian: 'middle_eastern',
    egyptian: 'middle_eastern',
    turkish: 'turkish',
    persian: 'persian',
    iranian: 'persian',
    mediterranean: 'mediterranean',
    greek: 'mediterranean',
    indian: 'indian',
    pakistani: 'indian',
    bangladeshi: 'indian',
    biryani: 'indian',
    curry: 'indian',
    chinese: 'chinese',
    asian: 'asian',
    japanese: 'japanese',
    sushi: 'japanese',
    ramen: 'japanese',
    korean: 'korean',
    thai: 'thai',
    vietnamese: 'vietnamese',
    filipino: 'filipino',
    indonesian: 'indonesian',
    malaysian: 'malaysian',
    mexican: 'mexican',
    tex$mex: 'mexican',
    taco: 'mexican',
    american: 'american',
    bbq: 'bbq',
    barbecue: 'bbq',
    grill: 'grill',
    steak_house: 'steak',
    steak: 'steak',
    chicken: 'chicken',
    fried_chicken: 'chicken',
    fish: 'seafood',
    seafood: 'seafood',
    fish_and_chips: 'seafood',
    coffee_shop: 'coffee',
    coffee: 'coffee',
    tea: 'tea',
    cafe: 'coffee',
    bubble_tea: 'tea',
    juice: 'juice',
    ice_cream: 'dessert',
    dessert: 'dessert',
    cake: 'bakery',
    pastry: 'bakery',
    bakery: 'bakery',
    donut: 'bakery',
    crepe: 'dessert',
    waffle: 'dessert',
    chocolate: 'dessert',
    breakfast: 'breakfast',
    brunch: 'breakfast',
    vegetarian: 'vegetarian',
    vegan: 'vegan',
    salad: 'healthy',
    healthy: 'healthy',
    poke: 'healthy',
    international: 'international',
    regional: 'local',
    local: 'local',
};

/** Chips shown in the filter row. `match` is tested against canonical cuisines;
 *  `categories` against the place category, so a chip still works for places
 *  that carry no cuisine tag at all. */
export const CUISINE_CHIPS = [
    { id: 'coffee', label: 'Coffee & Tea', icon: '☕', match: ['coffee', 'tea', 'juice'], categories: ['cafe'] },
    { id: 'bakery', label: 'Bakery', icon: '\u{1F950}', match: ['bakery'], categories: ['bakery'] },
    { id: 'fastfood', label: 'Fast Food', icon: '\u{1F354}', match: ['burger', 'chicken', 'sandwich'], categories: ['fastfood'] },
    { id: 'pizza', label: 'Pizza', icon: '\u{1F355}', match: ['pizza'], categories: [] },
    { id: 'asian', label: 'Asian', icon: '\u{1F363}', match: ['asian', 'japanese', 'chinese', 'thai', 'korean', 'vietnamese', 'filipino', 'indonesian', 'malaysian'], categories: [] },
    { id: 'indian', label: 'Indian', icon: '\u{1F35B}', match: ['indian'], categories: [] },
    { id: 'middle_eastern', label: 'Middle Eastern', icon: '\u{1F362}', match: ['middle_eastern', 'turkish', 'persian', 'mediterranean'], categories: [] },
    { id: 'italian', label: 'Italian', icon: '\u{1F35D}', match: ['italian'], categories: [] },
    { id: 'seafood', label: 'Seafood', icon: '\u{1F990}', match: ['seafood'], categories: [] },
    { id: 'grill', label: 'Grill & BBQ', icon: '\u{1F356}', match: ['grill', 'bbq', 'steak'], categories: [] },
    { id: 'healthy', label: 'Healthy', icon: '\u{1F957}', match: ['healthy', 'vegetarian', 'vegan'], categories: [] },
    { id: 'dessert', label: 'Dessert', icon: '\u{1F366}', match: ['dessert'], categories: [] },
];

/** "pizza;italian" -> ['pizza','italian'] */
export const parseCuisines = (raw) => {
    if (!raw) return [];
    const out = [];
    for (const part of String(raw).split(/[;,]/)) {
        const key = part.trim().toLowerCase().replace(/[\s-]+/g, '_');
        if (!key) continue;
        const canon = CUISINE_SYNONYMS[key] ?? key;
        if (!out.includes(canon)) out.push(canon);
    }
    return out;
};

export const cuisineLabel = (slug) =>
    String(slug).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const matchesChips = (place, chipIds) => {
    if (!chipIds || chipIds.length === 0) return true;
    return chipIds.some((id) => {
        const chip = CUISINE_CHIPS.find((c) => c.id === id);
        if (!chip) return false;
        if (chip.match.some((m) => place.cuisines.includes(m))) return true;
        return chip.categories.includes(place.category);
    });
};

/** How many places each chip would actually leave you choosing between.
 *
 *  Worth surfacing: in a real pool of ~500 Muscat places, "Pizza" reaches 15
 *  and "Healthy" reaches none. A chip that silently empties the board is
 *  indistinguishable from the app being broken.
 */
export const chipCounts = (places = []) => {
    const counts = {};
    for (const chip of CUISINE_CHIPS) {
        counts[chip.id] = places.reduce((n, p) => n + (matchesChips(p, [chip.id]) ? 1 : 0), 0);
    }
    return counts;
};
