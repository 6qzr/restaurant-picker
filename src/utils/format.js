/** Locale-aware formatting. Numbers go through Intl so they read correctly
 *  alongside Arabic names. */

export const formatDistance = (km, locale = navigator?.language) => {
    if (km == null) return '';
    if (km < 1) {
        return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(km * 1000)} m`;
    }
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: km < 10 ? 1 : 0 }).format(km)} km`;
};

export const formatCount = (n, locale = navigator?.language) =>
    n == null ? '' : new Intl.NumberFormat(locale, { notation: n >= 10000 ? 'compact' : 'standard' }).format(n);

export const formatRating = (r, locale = navigator?.language) =>
    r == null ? '' : new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(r);

/** Rough walking/driving time. Honest about being an estimate. */
export const travelEstimate = (km) => {
    if (km == null) return null;
    if (km <= 1.2) return { mode: 'walk', mins: Math.max(1, Math.round((km / 4.8) * 60)) };
    return { mode: 'drive', mins: Math.max(1, Math.round((km / 28) * 60)) };
};

/** Stable gradient from a name: zero network, never a broken image, and it
 *  looks deliberate rather than like a missing asset. */
export const gradientFor = (name = '') => {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
    return `linear-gradient(135deg, hsl(${h} 38% 58%), hsl(${(h + 42) % 360} 44% 38%))`;
};

const GLYPHS = {
    cafe: '☕',
    bakery: '\u{1F950}',
    dessert: '\u{1F366}',
    fastfood: '\u{1F354}',
    bar: '\u{1F378}',
    restaurant: '\u{1F37D}',
};

export const glyphFor = (place) => GLYPHS[place?.category] ?? GLYPHS.restaurant;

/** OSM opening_hours is a small language of its own; we only surface the raw
 *  string when it is short enough to be readable, rather than mis-parsing it. */
export const readableHours = (raw) => {
    if (!raw || raw.length > 28) return null;
    if (raw === '24/7') return 'Open 24/7';
    return raw;
};

/**
 * Where "Go" should send you.
 *
 * Linking to bare coordinates (which is what this did) drops a pin in the
 * middle of nowhere instead of opening the restaurant, so you get no hours, no
 * reviews and no name. Coordinates were chosen so the link would work without a
 * Google Place ID -- but the name works without one too, and carries far more.
 *
 * - With a Place ID from enrichment: the official Maps URL API opens that exact
 *   business listing.
 * - Without one: search for the name centred on its coordinates, so Google
 *   resolves the right branch rather than a same-named place in another city.
 */
export const mapsUrlFor = (place, enrichment) => {
    const name = encodeURIComponent(place.name);
    const placeId = enrichment?.googlePlaceId;

    // Matched to a Google listing: open it. The user gets reviews, hours,
    // photos and a directions button of their own.
    if (placeId && !String(placeId).startsWith('mock_')) {
        return `https://www.google.com/maps/search/?api=1&query=${name}&query_place_id=${encodeURIComponent(placeId)}`;
    }

    // No listing. Measured: about a quarter of the places OpenStreetMap knows
    // about return nothing at all from Google -- they are the small local spots
    // that make this app worth using. Searching for the name would dump the
    // user on a results page for a business Google has never heard of, so send
    // them to the coordinates instead: the destination is exactly right even
    // though the listing does not exist.
    return `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lon}`;
};

/** Turn-by-turn, for when the user wants directions rather than the listing. */
export const directionsUrlFor = (place, enrichment) => {
    const dest = encodeURIComponent(place.name);
    const placeId = enrichment?.googlePlaceId;
    const base = `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
    return placeId && !String(placeId).startsWith('mock_')
        ? `${base}&destination_place_id=${encodeURIComponent(placeId)}`
        : `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lon}`;
};
