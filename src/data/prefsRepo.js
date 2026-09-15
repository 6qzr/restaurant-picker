import { getDB, STORES } from './db.js';

/** Cuisine/category taste weights.
 *
 *  The old version stored weights against raw Google type strings, including
 *  junk types like `food`, `point_of_interest` and `establishment` that EVERY
 *  place carries -- so every vote nudged the generic buckets equally and the
 *  signal drowned in noise. We key on canonical cuisines and the category only.
 */

const CLAMP = 10;

export const loadPrefs = async () => {
    const db = await getDB();
    const tx = db.transaction(STORES.prefs, 'readonly');
    const keys = await tx.store.getAllKeys();
    const vals = await tx.store.getAll();
    await tx.done;
    const out = {};
    keys.forEach((k, i) => { out[k] = vals[i]; });
    return out;
};

export const votePlace = async (place, weight) => {
    const db = await getDB();
    const tx = db.transaction(STORES.prefs, 'readwrite');
    const keys = [...place.cuisines.map((c) => `cuisine:${c}`), `category:${place.category}`];
    await Promise.all(
        keys.map(async (k) => {
            const cur = (await tx.store.get(k)) ?? 0;
            await tx.store.put(Math.max(-CLAMP, Math.min(CLAMP, cur + weight)), k);
        })
    );
    await tx.done;
};

/** Combined taste score for a place, normalized to [0,1] by the caller. */
export const preferenceScore = (place, prefs = {}) => {
    let cuisine = 0;
    for (const c of place.cuisines) cuisine += prefs[`cuisine:${c}`] ?? 0;
    if (place.cuisines.length) cuisine /= place.cuisines.length;
    const category = prefs[`category:${place.category}`] ?? 0;
    return 0.6 * cuisine + 0.4 * category;
};

/** The user's most-liked cuisines, used by the "Something New" lane to
 *  deliberately look outside the usual. */
export const topCuisines = (prefs = {}, n = 3) =>
    Object.entries(prefs)
        .filter(([k, v]) => k.startsWith('cuisine:') && v > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([k]) => k.slice('cuisine:'.length));
