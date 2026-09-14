import { parseCuisines } from '../../utils/cuisine.js';

/** OSM element -> our normalized Place shape.
 *
 *  Google results normalize into the same shape, but enrichment never mutates a
 *  Place: it returns a separate Enrichment object held alongside. That keeps the
 *  ODbL data (ours to persist) structurally separate from Google-derived fields
 *  (memory-only), so the caching boundary can't be crossed by accident.
 */

const AMENITY_TO_CATEGORY = {
    restaurant: 'restaurant',
    cafe: 'cafe',
    fast_food: 'fastfood',
    bakery: 'bakery',
    ice_cream: 'dessert',
    pub: 'bar',
    bar: 'bar',
    food_court: 'fastfood',
};

const SHOP_TO_CATEGORY = {
    bakery: 'bakery',
    pastry: 'bakery',
    deli: 'bakery',
    confectionery: 'dessert',
};

const ARABIC_RE = /[؀-ۿݐ-ݿ]/;
const HAN_RE = /[一-鿿぀-ヿ]/;
const CYRL_RE = /[Ѐ-ӿ]/;

export const detectScript = (s = '') => {
    if (ARABIC_RE.test(s)) return HAN_RE.test(s) || /[a-z]/i.test(s) ? 'mixed' : 'arab';
    if (HAN_RE.test(s)) return 'han';
    if (CYRL_RE.test(s)) return 'cyrl';
    return 'latin';
};

const has = (v) => (v ? 1 : 0);

/** Proxy for "a real, noticed business" when we have no rating to go on.
 *  Drives the no-key ranking path. */
export const tagCompleteness = (t = {}) =>
    0.3 * has(t.cuisine) +
    0.2 * has(t.opening_hours) +
    0.2 * has(t.phone || t['contact:phone'] || t.website || t['contact:website']) +
    0.15 * has(t['addr:street']) +
    0.15 * has(t.takeaway || t.delivery || t.outdoor_seating);

/** Returns null for elements we can't place on a map or can't name. */
export const normalizeElement = (el, tileIdValue) => {
    const t = el.tags ?? {};

    // Nodes carry lat/lon directly; ways/relations carry `center` because the
    // query asks for `out ... center`. If this ever silently returns undefined
    // the whole pool becomes coordinate-less, so it is asserted in tests.
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (typeof lat !== 'number' || typeof lon !== 'number') return null;

    const name = (t.name || t['name:en'] || t.brand || '').trim();
    if (!name) return null;

    const category =
        AMENITY_TO_CATEGORY[t.amenity] ?? SHOP_TO_CATEGORY[t.shop] ?? 'restaurant';

    const nameAlt = [t['name:en'], t['name:ar'], t.int_name, t.alt_name, t.brand]
        .filter((v) => v && v !== name)
        .map((v) => v.trim());

    const cuisines = parseCuisines(t.cuisine);
    if (cuisines.length === 0) {
        if (category === 'cafe') cuisines.push('coffee');
        else if (category === 'bakery') cuisines.push('bakery');
        else if (category === 'dessert') cuisines.push('dessert');
    }

    const typeChar = el.type === 'way' ? 'w' : el.type === 'relation' ? 'r' : 'n';

    return {
        id: `osm:${typeChar}:${el.id}`,
        osmType: el.type ?? 'node',
        osmId: el.id,
        source: 'osm',
        name,
        nameScript: detectScript(name),
        nameAlt: [...new Set(nameAlt)],
        lat,
        lon,
        cuisines,
        category,
        tags: {
            opening_hours: t.opening_hours,
            phone: t.phone || t['contact:phone'],
            website: t.website || t['contact:website'],
            takeaway: t.takeaway,
            delivery: t.delivery,
            outdoor_seating: t.outdoor_seating,
            wheelchair: t.wheelchair,
            street: t['addr:street'],
            housenumber: t['addr:housenumber'],
            city: t['addr:city'],
            brand: t.brand,
        },
        isChain: Boolean(t.brand || t['brand:wikidata']),
        completeness: tagCompleteness(t),
        tileId: tileIdValue,
        fetchedAt: Date.now(),
    };
};

export const normalizeElements = (elements, tileIdValue) => {
    const out = [];
    const seen = new Set();
    for (const el of elements) {
        const p = normalizeElement(el, tileIdValue);
        if (!p || seen.has(p.id)) continue;
        seen.add(p.id);
        out.push(p);
    }
    return out;
};
