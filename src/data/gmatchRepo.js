import { getDB, STORES } from './db.js';

/** OSM id -> Google Place ID.
 *
 *  Place IDs are the one Google field that may be stored indefinitely, so this
 *  cache is permanent. It is also what makes enrichment get cheaper over time:
 *  after the first visit to an area nearly every call is a direct Place Details
 *  lookup rather than a Text Search.
 */

export const getMatch = async (id) => (await getDB()).get(STORES.gmatch, id);

export const getMatches = async (ids) => {
    const db = await getDB();
    const tx = db.transaction(STORES.gmatch, 'readonly');
    const rows = await Promise.all(ids.map((i) => tx.store.get(i)));
    await tx.done;
    const map = new Map();
    rows.forEach((r, i) => { if (r) map.set(ids[i], r); });
    return map;
};

export const putMatch = async (id, googlePlaceId, matchConfidence) => {
    const db = await getDB();
    await db.put(STORES.gmatch, { id, googlePlaceId, matchConfidence, matchedAt: Date.now() });
};

/** Remember misses too, so we don't pay for the same failed Text Search daily. */
export const putMiss = async (id) => {
    const db = await getDB();
    await db.put(STORES.gmatch, { id, googlePlaceId: null, missedAt: Date.now() });
};
