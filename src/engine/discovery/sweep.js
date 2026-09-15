import { coveringTiles } from './tiles.js';
import { buildCoreQuery, buildTailQuery, runQuery } from './overpass.js';
import { normalizeElements } from './osmNormalize.js';
import { putPlaces, getPlacesByTiles } from '../../data/placesRepo.js';
import { planSweep, putTile } from '../../data/tilesRepo.js';
import { OVERPASS, TILES, SEARCH } from '../../config.js';

/** Background discovery sweep.
 *
 *  Contract: this NEVER blocks first paint and NEVER re-rolls a visible board.
 *  It emits incremental batches; the UI decides what to do with a growing pool.
 *  (The old app re-ran its pick whenever results arrived, which is precisely how
 *  vetoing a place silently replaced the user's whole board two seconds later.)
 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Bounded worker pool. Overpass allows 2 concurrent slots per IP; exceeding it
 *  earns a 429 for every tile in flight, which is how an unpaced 16-tile burst
 *  produced 16 failures during development. */
const runPool = async (items, worker, { concurrency, spacingMs, signal }) => {
    let cursor = 0;
    const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
        while (cursor < items.length) {
            if (signal?.aborted) return;
            const item = items[cursor++];
            await worker(item);
            if (spacingMs) await sleep(spacingMs);
        }
    });
    await Promise.all(runners);
};

export const createSweep = ({ onBatch, onProgress } = {}) => {
    let controller = null;
    let current = null;

    const abort = () => {
        controller?.abort();
        controller = null;
    };

    /**
     * @param {{lat:number, lon:number}} center
     * @param {number} radiusKm
     */
    const start = async (center, radiusKm) => {
        abort();
        controller = new AbortController();
        const { signal } = controller;

        const tiles = coveringTiles(center.lat, center.lon, radiusKm);
        const { warm, fetch: toFetch } = await planSweep(tiles);

        // 1. Warm read. On any repeat visit this alone fills the pool, so the
        //    user can spin before a single request leaves the device.
        const pool = new Map();
        if (warm.length) {
            const cached = await getPlacesByTiles(warm.map((t) => t.id));
            for (const p of cached) pool.set(p.id, p);
            if (cached.length) onBatch?.(cached, { source: 'cache', done: false });
        }

        onProgress?.({
            phase: toFetch.length ? 'sweeping' : 'ready',
            total: tiles.length,
            fetched: 0,
            toFetch: toFetch.length,
            poolSize: pool.size,
        });

        if (!toFetch.length) {
            current = null;
            return { poolSize: pool.size, tilesFetched: 0, tilesFailed: 0 };
        }

        // 2. Ring-lazy: tiles are already ordered centre-outwards, so stopping
        //    early leaves no hole in the middle.
        const ringLazy = radiusKm > TILES.ringLazyAboveKm;
        let fetched = 0;
        let failed = 0;
        let stop = false;

        // Phase A: the core query only, emitted the moment it lands.
        //
        // The tail query (ice cream, bars, food courts, bakeries tagged as
        // shops) used to run inline here, which doubled the requests standing
        // between the user and their first result -- 18 round-trips for a 5km
        // radius when a single tile already yields ~150 places. It is a bonus,
        // so it now runs after the board is usable.
        const tailQueue = [];

        const worker = async (tile) => {
            if (stop || signal.aborted) return;
            try {
                const { elements, mirror } = await runQuery(buildCoreQuery(tile.bbox), { signal });
                const places = normalizeElements(elements, tile.id);

                await putPlaces(places);
                await putTile({
                    tileId: tile.id,
                    bbox: tile.bbox,
                    sweptAt: Date.now(),
                    elementCount: elements.length,
                    namedCount: places.length,
                    status: 'ok',
                    mirror,
                });

                const fresh = places.filter((p) => !pool.has(p.id));
                for (const p of places) pool.set(p.id, p);
                fetched++;
                if (fresh.length) onBatch?.(fresh, { source: 'network', done: false });

                tailQueue.push(tile);

                if (ringLazy && pool.size >= TILES.earlyStopNamedCount && tile.distanceKm > radiusKm * 0.4) {
                    stop = true;
                }
            } catch (err) {
                failed++;
                // A failed tile is recorded, never fatal. It retries
                // opportunistically on a later session rather than blocking the
                // board now.
                await putTile({
                    tileId: tile.id,
                    bbox: tile.bbox,
                    sweptAt: Date.now(),
                    elementCount: 0,
                    namedCount: 0,
                    status: 'failed',
                    error: String(err?.message ?? err),
                });
            } finally {
                onProgress?.({
                    phase: 'sweeping',
                    total: tiles.length,
                    fetched: fetched + failed,
                    toFetch: toFetch.length,
                    poolSize: pool.size,
                });
            }
        };

        current = runPool(toFetch, worker, {
            concurrency: OVERPASS.concurrency,
            spacingMs: OVERPASS.spacingMs,
            signal,
        });
        await current;
        current = null;

        // The board is usable from here on; everything below is additive.
        onProgress?.({
            phase: 'ready',
            total: tiles.length,
            fetched: fetched + failed,
            toFetch: toFetch.length,
            poolSize: pool.size,
        });
        onBatch?.([], { source: 'done', done: true });

        // Phase B: the long tail, best-effort and never surfaced as an error.
        if (!signal.aborted && tailQueue.length) {
            runPool(
                tailQueue,
                async (tile) => {
                    try {
                        const { elements } = await runQuery(buildTailQuery(tile.bbox), { signal });
                        const places = normalizeElements(elements, tile.id);
                        const fresh = places.filter((p) => !pool.has(p.id));
                        if (!fresh.length) return;
                        await putPlaces(fresh);
                        for (const p of fresh) pool.set(p.id, p);
                        onBatch?.(fresh, { source: 'network-tail', done: false });
                    } catch {
                        /* bonus categories; the core results stand alone */
                    }
                },
                { concurrency: 1, spacingMs: OVERPASS.spacingMs, signal }
            ).catch(() => {});
        }

        return { poolSize: pool.size, tilesFetched: fetched, tilesFailed: failed };
    };

    return { start, abort, get running() { return current !== null; } };
};

export const canSpin = (poolSize) => poolSize >= SEARCH.minPoolToSpin;
