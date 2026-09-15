import { getDB, STORES } from './db.js';

/** OSM-derived places only.
 *
 *  There is deliberately NO method here capable of writing a Google enrichment
 *  (rating, photo, Google display name). Those have no caching exception in
 *  Google's terms, so they live in an in-memory Map for the session only. The
 *  boundary is enforced by the shape of this module, not by a comment.
 */

export const putPlaces = async (places) => {
    if (!places.length) return 0;
    const db = await getDB();
    const tx = db.transaction(STORES.places, 'readwrite');
    await Promise.all([...places.map((p) => tx.store.put(p)), tx.done]);
    return places.length;
};

export const getPlacesByTiles = async (tileIds) => {
    const db = await getDB();
    const tx = db.transaction(STORES.places, 'readonly');
    const idx = tx.store.index('byTile');
    const results = await Promise.all(tileIds.map((id) => idx.getAll(id)));
    await tx.done;

    const seen = new Set();
    const out = [];
    for (const group of results) {
        for (const p of group) {
            if (seen.has(p.id)) continue;
            seen.add(p.id);
            out.push(p);
        }
    }
    return out;
};

export const getPlacesByIds = async (ids) => {
    const db = await getDB();
    const tx = db.transaction(STORES.places, 'readonly');
    const rows = await Promise.all(ids.map((id) => tx.store.get(id)));
    await tx.done;
    return rows.filter(Boolean);
};

export const countPlaces = async () => (await getDB()).count(STORES.places);
