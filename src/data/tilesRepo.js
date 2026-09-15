import { getDB, STORES } from './db.js';
import { TILES } from '../config.js';

/** Tile sweep bookkeeping. A tile record answers "have I fully swept this
 *  rectangle, and how long ago?" -- which is the question a geohash could
 *  never answer, and the reason we key on z/x/y. */

export const getTiles = async (tileIds) => {
    const db = await getDB();
    const tx = db.transaction(STORES.tiles, 'readonly');
    const rows = await Promise.all(tileIds.map((id) => tx.store.get(id)));
    await tx.done;
    const map = new Map();
    rows.forEach((r, i) => map.set(tileIds[i], r ?? null));
    return map;
};

export const putTile = async (record) => {
    const db = await getDB();
    await db.put(STORES.tiles, record);
};

export const isFresh = (record, now = Date.now()) =>
    Boolean(record) && record.status === 'ok' && now - record.sweptAt < TILES.staleAfterMs;

/** Split a covering set into what we can serve now vs what needs fetching.
 *  Stale-but-present tiles are served immediately and re-swept in the
 *  background, so a repeat visit never waits on the network. */
export const planSweep = async (tiles, now = Date.now()) => {
    const records = await getTiles(tiles.map((t) => t.id));
    const warm = [];
    const fetch = [];
    for (const t of tiles) {
        const rec = records.get(t.id);
        if (rec && rec.status === 'ok') warm.push(t);
        if (!isFresh(rec, now)) fetch.push(t);
    }
    return { warm, fetch, records };
};
