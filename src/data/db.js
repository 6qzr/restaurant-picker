import { openDB } from 'idb';

export const DB_NAME = 'chefs-choice';
export const DB_VERSION = 1;

export const STORES = {
    places: 'places',
    tiles: 'tiles',
    gmatch: 'gmatch',
    seen: 'seen',
    prefs: 'prefs',
    budget: 'budget',
};

let dbPromise = null;

export const getDB = () => {
    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(STORES.places)) {
                    const s = db.createObjectStore(STORES.places, { keyPath: 'id' });
                    s.createIndex('byTile', 'tileId');
                }
                if (!db.objectStoreNames.contains(STORES.tiles)) {
                    db.createObjectStore(STORES.tiles, { keyPath: 'tileId' });
                }
                // Google Place IDs only. Per Google's terms a Place ID may be
                // stored indefinitely; ratings, names and photos may not, and so
                // are never written to IndexedDB at all (see enrichQueue).
                if (!db.objectStoreNames.contains(STORES.gmatch)) {
                    db.createObjectStore(STORES.gmatch, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(STORES.seen)) {
                    db.createObjectStore(STORES.seen, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(STORES.prefs)) {
                    db.createObjectStore(STORES.prefs);
                }
                if (!db.objectStoreNames.contains(STORES.budget)) {
                    db.createObjectStore(STORES.budget);
                }
            },
        });
    }
    return dbPromise;
};

/** Test seam: lets the simulation and unit tests swap in fake-indexeddb. */
export const _resetDBForTests = () => {
    dbPromise = null;
};
