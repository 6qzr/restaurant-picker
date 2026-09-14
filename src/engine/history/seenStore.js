import { getDB, STORES } from '../../data/db.js';
import { pruneShows } from './decay.js';

/** Persistent memory of what you have already been shown.
 *
 *  The old app kept vetoes in `useState([])`, so every page reload forgot
 *  everything -- which is a large part of why the same places kept coming back.
 */

export const loadSeen = async (ids) => {
    const db = await getDB();
    const tx = db.transaction(STORES.seen, 'readonly');
    const rows = await Promise.all(ids.map((id) => tx.store.get(id)));
    await tx.done;
    const map = new Map();
    rows.forEach((r, i) => { if (r) map.set(ids[i], r); });
    return map;
};

export const loadAllSeen = async () => {
    const db = await getDB();
    const rows = await db.getAll(STORES.seen);
    return new Map(rows.map((r) => [r.id, r]));
};

export const recordShown = async (ids, now = Date.now()) => {
    const db = await getDB();
    const tx = db.transaction(STORES.seen, 'readwrite');
    await Promise.all(
        ids.map(async (id) => {
            const prev = (await tx.store.get(id)) ?? { id, shows: [] };
            prev.shows = pruneShows([...(prev.shows ?? []), now], now);
            prev.lastShownAt = now;
            await tx.store.put(prev);
        })
    );
    await tx.done;
};

/** The name is stored alongside the veto purely so Settings can show a
 *  readable "restore" list rather than a column of OSM ids. */
export const recordVeto = async (id, name, now = Date.now()) => {
    const db = await getDB();
    const prev = (await db.get(STORES.seen, id)) ?? { id, shows: [] };
    prev.vetoedAt = now;
    if (name) prev.name = name;
    await db.put(STORES.seen, prev);
};

export const clearVeto = async (id) => {
    const db = await getDB();
    const prev = await db.get(STORES.seen, id);
    if (!prev) return;
    delete prev.vetoedAt;
    await db.put(STORES.seen, prev);
};

export const recordChosen = async (id, now = Date.now()) => {
    const db = await getDB();
    const prev = (await db.get(STORES.seen, id)) ?? { id, shows: [] };
    prev.chosenAt = now;
    prev.chosenCount = (prev.chosenCount ?? 0) + 1;
    await db.put(STORES.seen, prev);
};

export const listVetoed = async () => {
    const db = await getDB();
    const rows = await db.getAll(STORES.seen);
    return rows.filter((r) => r.vetoedAt);
};

/** In-memory implementation with the same surface, for the simulation harness. */
export const createMemorySeenStore = () => {
    const map = new Map();
    return {
        map,
        get: (id) => map.get(id),
        loadAll: () => map,
        recordShown(ids, now = Date.now()) {
            for (const id of ids) {
                const prev = map.get(id) ?? { id, shows: [] };
                prev.shows = pruneShows([...prev.shows, now], now);
                prev.lastShownAt = now;
                map.set(id, prev);
            }
        },
        recordVeto(id, now = Date.now()) {
            const prev = map.get(id) ?? { id, shows: [] };
            prev.vetoedAt = now;
            map.set(id, prev);
        },
    };
};
