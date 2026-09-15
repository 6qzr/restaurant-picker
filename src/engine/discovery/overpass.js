import { OVERPASS } from '../../config.js';

/** Overpass client: mirror rotation, health tracking, bounded retries.
 *
 *  Measured behaviour that shaped this: a light node-only query over a ~2km box
 *  returns ~120 elements in under 3s, while a heavy `nwr` query over 5km with
 *  `out 2000` returned HTTP 504 after 236 seconds. Both sides therefore need a
 *  deadline -- [timeout:N] server-side and an AbortController client-side.
 */

/** Measured on the public instance: regex tag matching (`~`) cannot use
 *  Overpass's tag index, so it degrades into a scan. A union of exact `=`
 *  statements over the same box returned in ~1s where the equivalent regex
 *  timed out. Cost scales with STATEMENT COUNT, so the set is split into a
 *  required core group and a best-effort tail group.
 */
export const CORE_AMENITIES = ['restaurant', 'cafe', 'fast_food', 'bakery'];
export const TAIL_AMENITIES = ['ice_cream', 'pub', 'bar', 'food_court'];
export const TAIL_SHOPS = ['bakery', 'pastry', 'deli', 'confectionery'];

const box = (bbox) => `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;

const union = (bbox, entries) =>
    entries.map(([k, v]) => `  node(${box(bbox)})["${k}"="${v}"];`).join(String.fromCharCode(10));

/** The core query: four exact statements. This is the reliable one. */
export const buildCoreQuery = (bbox, outLimit = OVERPASS.outLimit) =>
    `[out:json][timeout:${OVERPASS.serverTimeoutSec}];
(
${union(bbox, CORE_AMENITIES.map((a) => ['amenity', a]))}
);
out tags center ${outLimit};`;

/** The tail query: the long tail of food places. Best-effort -- if the server
 *  is busy we simply keep the core results rather than failing the tile. */
export const buildTailQuery = (bbox, outLimit = 300) =>
    `[out:json][timeout:${OVERPASS.serverTimeoutSec}];
(
${union(bbox, [
    ...TAIL_AMENITIES.map((a) => ['amenity', a]),
    ...TAIL_SHOPS.map((sh) => ['shop', sh]),
])}
);
out tags center ${outLimit};`;

/** Fetch three specific OSM nodes by id -- used when opening a share link whose
 *  places are not yet in the local cache. Tiny and near-instant. */
export const buildIdQuery = (osmIds) =>
    `[out:json][timeout:${OVERPASS.serverTimeoutSec}];node(id:${osmIds.join(',')});out tags center;`;

class MirrorHealth {
    constructor(urls) {
        this.state = urls.map((url) => ({ url, failures: 0, cooldownUntil: 0 }));
        this.cursor = 0;
    }

    /** Round-robin over mirrors that are not cooling down, skipping `exclude`. */
    next(exclude = []) {
        const now = Date.now();
        const n = this.state.length;
        for (let i = 0; i < n; i++) {
            const m = this.state[(this.cursor + i) % n];
            if (m.cooldownUntil > now || exclude.includes(m.url)) continue;
            this.cursor = (this.cursor + i + 1) % n;
            return m.url;
        }
        // Everything is cooling down or excluded: take the soonest-available.
        const fallback = [...this.state].sort((a, b) => a.cooldownUntil - b.cooldownUntil)[0];
        return fallback?.url ?? null;
    }

    succeed(url) {
        const m = this.state.find((s) => s.url === url);
        if (m) {
            m.failures = 0;
            m.cooldownUntil = 0;
        }
    }

    fail(url) {
        const m = this.state.find((s) => s.url === url);
        if (!m) return;
        const ladder = OVERPASS.cooldownLadderMs;
        m.cooldownUntil = Date.now() + ladder[Math.min(m.failures, ladder.length - 1)];
        m.failures += 1;
    }

    snapshot() {
        const now = Date.now();
        return this.state.map((m) => ({
            url: m.url,
            failures: m.failures,
            coolingFor: Math.max(0, m.cooldownUntil - now),
        }));
    }
}

export const mirrorHealth = new MirrorHealth(OVERPASS.mirrors);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Overpass's usage policy asks clients to identify themselves, and the public
 *  instance's Apache returns 406 Not Acceptable to requests with no Accept
 *  header and a default library User-Agent. Browsers supply their own UA (it is
 *  a forbidden header there), so this mainly matters for Node -- but sending
 *  Accept explicitly is correct in both. */
const UA = 'ChefsChoice/1.0 (restaurant picker; +https://github.com/6qzr/restaurant-picker)';
const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
export const REQUEST_HEADERS = isBrowser
    ? { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }
    : { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', 'User-Agent': UA };

/** A 400 means our query is malformed -- it will fail identically everywhere,
 *  so retrying on another mirror just wastes everyone's time. */
const isRetryable = (status) => status !== 400 && status !== 401 && status !== 403;

export class OverpassError extends Error {
    constructor(message, { status, fatal = false } = {}) {
        super(message);
        this.name = 'OverpassError';
        this.status = status;
        this.fatal = fatal;
    }
}

/**
 * Run one Overpass query with retries across distinct mirrors.
 * @returns {Promise<{elements: Array, mirror: string}>}
 */
export const runQuery = async (query, { signal } = {}) => {
    const tried = [];
    let lastError = null;

    const maxAttempts = Math.max(OVERPASS.maxAttemptsPerTile, OVERPASS.maxAttemptsOn429);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const mirror = mirrorHealth.next(tried);
        if (!mirror) break;

        const ac = new AbortController();
        const onAbort = () => ac.abort();
        signal?.addEventListener('abort', onAbort, { once: true });
        const timer = setTimeout(() => ac.abort(), OVERPASS.clientTimeoutMs);

        try {
            const res = await fetch(mirror, {
                method: 'POST',
                headers: REQUEST_HEADERS,
                body: new URLSearchParams({ data: query }),
                signal: ac.signal,
            });

            if (!res.ok) {
                const err = new OverpassError(`Overpass ${res.status}`, {
                    status: res.status,
                    fatal: !isRetryable(res.status),
                });
                if (err.fatal) {
                    console.error('[overpass] fatal, not retrying elsewhere:', res.status, query.slice(0, 120));
                    throw err;
                }
                throw err;
            }

            const json = await res.json();
            mirrorHealth.succeed(mirror);
            return { elements: json.elements ?? [], mirror };
        } catch (err) {
            lastError = err;
            if (err?.fatal) throw err;
            if (signal?.aborted) throw err;

            const is429 = err?.status === 429;
            // A 429 is our own quota, not mirror ill-health -- keep the mirror in
            // rotation and wait for a slot instead of burning through the list.
            if (!is429) {
                tried.push(mirror);
                mirrorHealth.fail(mirror);
            }

            // 429 means "all your slots are busy", not "this mirror is broken".
            // Measured: overpass-api.de allows 2 concurrent slots per IP, so the
            // right response is to wait for a slot rather than hammer the next
            // mirror -- which is how a 16-tile burst turned into 16 failures.
            const backoff = is429
                ? OVERPASS.rateLimitBackoffMs * (attempt + 1) + Math.random() * 500
                : OVERPASS.backoffBaseMs * 2 ** attempt + Math.random() * OVERPASS.backoffJitterMs;
            if (attempt < maxAttempts - 1) await sleep(backoff);
        } finally {
            clearTimeout(timer);
            signal?.removeEventListener('abort', onAbort);
        }
    }

    throw lastError ?? new OverpassError('Overpass: all mirrors exhausted');
};
