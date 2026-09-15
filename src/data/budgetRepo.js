import { getDB, STORES } from './db.js';

/** Per-SKU monthly call budget.
 *
 *  Replaces usageTracker.js, which counted every call at a flat $0.04 against a
 *  "$200 free tier" that no longer exists, tracked failed calls as billable, and
 *  never reset -- so the gauge was actively misleading rather than merely
 *  decorative.
 */

const monthKey = (d = new Date()) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

const EMPTY = { textSearch: 0, placeDetails: 0, photos: 0 };

export const getBudget = async () => {
    const db = await getDB();
    const key = monthKey();
    // Reading by the current month key IS the monthly reset.
    return { month: key, ...EMPTY, ...((await db.get(STORES.budget, key)) ?? {}) };
};

export const recordCall = async (sku, n = 1) => {
    const db = await getDB();
    const key = monthKey();
    const cur = (await db.get(STORES.budget, key)) ?? { ...EMPTY };
    cur[sku] = (cur[sku] ?? 0) + n;
    cur.updatedAt = Date.now();
    await db.put(STORES.budget, cur, key);
    return cur;
};

export const totalCalls = (b) => (b.textSearch ?? 0) + (b.placeDetails ?? 0) + (b.photos ?? 0);
