import { describe, it, expect } from 'vitest';
import { makeRng, shuffled, gumbel } from '../src/engine/prng.js';
import { gumbelTopK, temperatureFor, plausible } from '../src/engine/rank/sample.js';
import { novelty, recencyWeight } from '../src/engine/history/decay.js';
import { pickNext, similarity, passesConstraints } from '../src/engine/rank/mmr.js';
import { encodeBoard, decodeBoard } from '../src/share/codec.js';
import { normalizeElement } from '../src/engine/discovery/osmNormalize.js';
import { scoreMatch, normalizeName, diceSimilarity } from '../src/engine/enrich/matcher.js';
import {
    classifyError, QuotaError, inspectKeyShape, sanitizeKey, testConnection,
} from '../src/engine/enrich/googlePlaces.js';
import { coveringTiles, tileSizeKm, tileBBox, latToTileY, lonToTileX } from '../src/engine/discovery/tiles.js';
import { TILES, SEARCH, nearestRadiusStep, widerRadius } from '../src/config.js';
import { quality, proximity } from '../src/engine/rank/score.js';
import { mapsUrlFor, directionsUrlFor } from '../src/utils/format.js';
import { chipCounts, matchesChips, CUISINE_CHIPS } from '../src/utils/cuisine.js';

const DAY = 86400000;

describe('prng', () => {
    it('is deterministic for a given seed', () => {
        const a = makeRng('seed-1');
        const b = makeRng('seed-1');
        expect(Array.from({ length: 8 }, a)).toEqual(Array.from({ length: 8 }, b));
    });

    it('diverges for different seeds', () => {
        expect(makeRng('a')()).not.toBe(makeRng('b')());
    });

    it('is uniform (chi-square, 64 bins, 1e6 draws)', () => {
        const rng = makeRng('uniformity');
        const BINS = 64;
        const N = 1e6;
        const bins = new Array(BINS).fill(0);
        for (let i = 0; i < N; i++) bins[Math.floor(rng() * BINS)]++;
        const expected = N / BINS;
        const chi2 = bins.reduce((s, o) => s + (o - expected) ** 2 / expected, 0);
        expect(chi2).toBeLessThan(112.3); // 99.9% critical value at df=63
    });

    it('gumbel never returns Infinity', () => {
        const rng = () => 0; // the degenerate case the epsilon guard exists for
        expect(Number.isFinite(gumbel(rng))).toBe(true);
    });
});

describe('shuffled', () => {
    it('produces all permutations near-uniformly', () => {
        const rng = makeRng('perm');
        const counts = {};
        const N = 120000;
        for (let i = 0; i < N; i++) {
            const k = shuffled([1, 2, 3], rng).join('');
            counts[k] = (counts[k] ?? 0) + 1;
        }
        expect(Object.keys(counts)).toHaveLength(6);
        for (const c of Object.values(counts)) {
            expect(Math.abs(c / N - 1 / 6)).toBeLessThan(0.01);
        }
    });

    it('does not mutate its input', () => {
        const rng = makeRng('pure');
        const input = [1, 2, 3, 4, 5];
        const copy = [...input];
        shuffled(input, rng);
        expect(input).toEqual(copy);
    });

    it('beats the biased comparator shuffle it replaced', () => {
        // sort(() => Math.random() - 0.5) heavily favours the identity order.
        const N = 60000;
        const tally = (fn) => {
            const c = {};
            for (let i = 0; i < N; i++) {
                const k = fn().join('');
                c[k] = (c[k] ?? 0) + 1;
            }
            return c;
        };
        const rng = makeRng('bias');
        const old = tally(() => [1, 2, 3, 4].sort(() => Math.random() - 0.5));
        const neu = tally(() => shuffled([1, 2, 3, 4], rng));
        const spread = (c) => Math.max(...Object.values(c)) / Math.min(...Object.values(c));
        expect(spread(old)).toBeGreaterThan(3);
        expect(spread(neu)).toBeLessThan(1.15);
    });
});

describe('gumbel-top-k', () => {
    it('matches softmax(score/tau) empirically', () => {
        const scores = [1.0, 0.9, 0.8, 0.6, 0.3];
        const tau = 0.25;
        const items = scores.map((score, id) => ({ id, score }));
        const rng = makeRng('softmax');
        const N = 120000;
        const counts = new Array(scores.length).fill(0);
        for (let i = 0; i < N; i++) counts[gumbelTopK(items, 1, tau, rng)[0].id]++;

        const exps = scores.map((s) => Math.exp(s / tau));
        const Z = exps.reduce((a, b) => a + b, 0);
        scores.forEach((_, i) => {
            expect(Math.abs(exps[i] / Z - counts[i] / N)).toBeLessThan(0.01);
        });
    });

    it('maps the slider to a monotonic temperature range', () => {
        expect(temperatureFor(0)).toBeCloseTo(0.02, 3);
        expect(temperatureFor(1)).toBeCloseTo(0.5, 3);
        expect(temperatureFor(0.5)).toBeGreaterThan(temperatureFor(0.25));
    });

    it('applies a plausibility floor', () => {
        const scored = [{ score: 1.0 }, { score: 0.8 }, { score: 0.2 }];
        expect(plausible(scored, 0.55)).toHaveLength(2);
    });
});

describe('novelty decay', () => {
    const now = Date.now();
    it.each([
        ['never shown', null, 1.0],
        ['yesterday', { shows: [now - DAY] }, 0.52],
        ['three weeks ago', { shows: [now - 21 * DAY] }, 0.81],
        ['five times this week', { shows: [1, 2, 3, 4, 5].map((d) => now - d * DAY) }, 0.2],
    ])('%s', (_label, record, expected) => {
        expect(novelty(record, now)).toBeCloseTo(expected, 1);
    });

    it('hard-excludes a place inside its veto cooldown', () => {
        expect(novelty({ shows: [], vetoedAt: now - DAY }, now)).toBe(0);
    });

    it('lets a veto lapse after the cooldown, but penalised', () => {
        const n = novelty({ shows: [], vetoedAt: now - 100 * DAY }, now);
        expect(n).toBeGreaterThan(0);
        expect(n).toBeLessThan(0.3);
    });

    it('ignores future timestamps rather than inflating recency', () => {
        expect(recencyWeight([now + DAY], now)).toBe(0);
    });
});

describe('mmr diversity', () => {
    const place = (id, cuisines, lat = 23.5, lon = 58.4, extra = {}) => ({
        id, name: id, cuisines, category: 'restaurant', lat, lon, tags: {}, ...extra,
    });

    it('never returns three of the same cuisine when alternatives exist', () => {
        const candidates = [
            ...Array.from({ length: 40 }, (_, i) =>
                ({ place: place(`p${i}`, ['pizza'], 23.5 + i * 0.01), key: 10 - i * 0.01 })),
            { place: place('sushi', ['japanese'], 23.62), key: 5 },
            { place: place('curry', ['indian'], 23.63), key: 4 },
        ];
        const chosen = [];
        for (let i = 0; i < 3; i++) {
            const next = pickNext(candidates.filter((c) => !chosen.includes(c.place)), chosen, { radiusKm: 5 });
            chosen.push(next.place);
        }
        const primaries = chosen.map((c) => c.cuisines[0]);
        expect(new Set(primaries).size).toBeGreaterThan(1);
    });

    it('still fills three slots when only one cuisine exists (relaxation works)', () => {
        const candidates = Array.from({ length: 10 }, (_, i) =>
            ({ place: place(`p${i}`, ['pizza'], 23.5 + i * 0.02), key: 10 - i }));
        const chosen = [];
        for (let i = 0; i < 3; i++) {
            const next = pickNext(candidates.filter((c) => !chosen.includes(c.place)), chosen, { radiusKm: 5 });
            expect(next).not.toBeNull();
            chosen.push(next.place);
        }
        expect(chosen).toHaveLength(3);
    });

    /** Reported from the live site: two cards both reading "Pizza Hut".
     *  OpenStreetMap had five Pizza Hut nodes among only fifteen pizza places,
     *  and the brand constraint could not catch them because it required BOTH
     *  records to carry a brand tag, which these do not. */
    it('never shows the same name twice, even fully relaxed', () => {
        const chosen = [place('a', ['pizza'], 23.5, 58.4)];
        chosen[0].name = 'Pizza Hut';
        const other = place('b', ['pizza'], 23.57, 58.4);
        other.name = 'Pizza Hut';
        expect(passesConstraints(other, chosen, 3)).toBe(false);
    });

    it('never shows the same place id twice', () => {
        const chosen = [place('a', ['pizza'])];
        expect(passesConstraints(place('a', ['indian'], 23.9, 58.9), chosen, 3)).toBe(false);
    });

    it('still allows genuinely different places when fully relaxed', () => {
        const chosen = [place('a', ['pizza'], 23.5, 58.4)];
        chosen[0].name = 'Pizza Hut';
        const other = place('b', ['pizza'], 23.5001, 58.4);
        other.name = "Papa John's";
        expect(passesConstraints(other, chosen, 3)).toBe(true);
    });

    it('scores identical places as maximally similar', () => {
        const a = place('a', ['pizza']);
        expect(similarity(a, a, 5)).toBeGreaterThan(0.9);
    });
});

describe('share codec', () => {
    it('round-trips with sub-3m precision and stays short', () => {
        for (let i = 0; i < 2000; i++) {
            const board = {
                center: { lat: Math.random() * 170 - 85, lon: Math.random() * 360 - 180 },
                radiusKm: Math.round(Math.random() * 30) / 2,
                temperature: Math.random(),
                adventure: Math.random() > 0.5,
                ratingsOff: Math.random() > 0.5,
                chips: ['pizza', 'asian'].filter(() => Math.random() > 0.5),
                seed: Math.floor(Math.random() * 2 ** 32),
                placeIds: [0, 1, 2].map(
                    () => `osm:${['n', 'w', 'r'][Math.floor(Math.random() * 3)]}:${Math.floor(Math.random() * 1.3e10)}`
                ),
            };
            const encoded = encodeBoard(board);
            expect(encoded.length).toBeLessThanOrEqual(48);
            const d = decodeBoard(encoded);
            expect(d.placeIds).toEqual(board.placeIds);
            expect(d.seed).toBe(board.seed);
            expect(d.radiusKm).toBe(board.radiusKm);
            expect(d.chips.sort()).toEqual(board.chips.sort());
            expect(Math.abs(d.center.lat - board.center.lat) * 111320).toBeLessThan(3);
        }
    });

    it('rejects an unknown version', () => {
        const good = encodeBoard({ center: { lat: 0, lon: 0 }, radiusKm: 5, placeIds: [] });
        const bytes = Uint8Array.from(atob(good.replace(/-/g, '+').replace(/_/g, '/') + '=='), (c) => c.charCodeAt(0));
        bytes[0] = 99;
        let bin = '';
        for (const b of bytes) bin += String.fromCharCode(b);
        const bad = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        expect(() => decodeBoard(bad)).toThrow();
    });
});

describe('osm normalize', () => {
    it('reads a node position from lat/lon', () => {
        const p = normalizeElement({ type: 'node', id: 1, lat: 23.5, lon: 58.4, tags: { amenity: 'cafe', name: 'X' } }, 't');
        expect(p.lat).toBe(23.5);
        expect(p.category).toBe('cafe');
    });

    /** Guards a silent total-failure mode: if `center` ever stops being read,
     *  every way/relation becomes coordinate-less and the pool dies quietly. */
    it('reads a way position from center', () => {
        const p = normalizeElement(
            { type: 'way', id: 2, center: { lat: 23.6, lon: 58.5 }, tags: { amenity: 'restaurant', name: 'Y' } }, 't'
        );
        expect(p.lat).toBe(23.6);
        expect(p.id).toBe('osm:w:2');
    });

    it('drops elements with no position or no name', () => {
        expect(normalizeElement({ type: 'node', id: 3, tags: { amenity: 'cafe', name: 'Z' } }, 't')).toBeNull();
        expect(normalizeElement({ type: 'node', id: 4, lat: 1, lon: 1, tags: { amenity: 'cafe' } }, 't')).toBeNull();
    });

    it('detects Arabic script and canonicalises cuisine synonyms', () => {
        const p = normalizeElement(
            { type: 'node', id: 5, lat: 1, lon: 1, tags: { amenity: 'restaurant', name: 'مطعم الجود', cuisine: 'lebanese;kebab' } }, 't'
        );
        expect(p.nameScript).toBe('arab');
        expect(p.cuisines).toEqual(['middle_eastern']);
    });
});

describe('google matcher', () => {
    const osm = (name, lat = 23.5, lon = 58.4, nameAlt = []) => ({ name, nameAlt, lat, lon });
    const g = (text, lat = 23.5, lon = 58.4) => ({ displayName: { text }, location: { latitude: lat, longitude: lon } });

    it('strips Arabic diacritics and Latin accents alike', () => {
        expect(normalizeName('Café')).toBe(normalizeName('Cafe'));
        expect(normalizeName('مَطعَم الجود')).toBe(normalizeName('مطعم الجود'));
    });

    it('tolerates reordered multi-word names', () => {
        expect(diceSimilarity(normalizeName('Al Jood Lebanese'), normalizeName('Lebanese Al Jood'))).toBeGreaterThan(0.7);
    });

    /** Tuned against 45 real Google responses for Muscat. The weighted score
     *  alone rejected listings sitting on top of the target but formatting
     *  their name differently -- a branch suffix, or a bilingual name. */
    it('accepts a differently-formatted name in the same building', () => {
        const m = scoreMatch(osm('Pizza Hut'), g('Pizza Hut | Al Khuwair Oman Oil', 23.50008, 58.4));
        expect(m.accepted).toBe(true);
        expect(m.reason).toBe('same-building');
    });

    it('accepts a transliterated name a short walk away', () => {
        // استار بكس is Starbucks; the two datasets place it ~50m apart.
        expect(scoreMatch(osm('استار بكس'), g('Starbucks', 23.50045, 58.4)).accepted).toBe(true);
    });

    /** The guard that keeps proximity from swallowing neighbours: a wrong
     *  rating is worse than no rating. */
    it('still rejects a different business just beyond the coincident radius', () => {
        expect(scoreMatch(osm('Cowboy SteakHouse'), g('Pizza Hut', 23.5005, 58.4)).accepted).toBe(false);
    });

    it.each([
        ['exact same-script match', osm('Turkish Days'), g('Turkish Days'), true],
        ['cross-script, coincident', osm('مطعم الجود اللبناني'), g('Al Jood Lebanese', 23.50001, 58.40001), true],
        ['cross-script, 200m away', osm('مطعم الملح'), g('Salt Restaurant', 23.5018), false],
        ['alt name bridges scripts', osm('مطعم الجود', 23.5, 58.4, ['Al Jood']), g('Al Jood', 23.5001), true],
        ['different place nearby', osm('Cowboy SteakHouse'), g('Pizza Hut', 23.5005), false],
        ['same name, far away', osm('Tea Time'), g('Tea Time', 23.55), false],
    ])('%s', (_label, o, gp, expected) => {
        expect(scoreMatch(o, gp).accepted).toBe(expected);
    });
});

describe('tiling', () => {
    it('keeps tiles inside the query-safe size envelope', () => {
        for (const lat of [0, 23.588, 51.5, 64]) {
            const t = coveringTiles(lat, 0, 5)[0];
            const { width, height } = tileSizeKm(t.z, t.x, t.y);
            expect(width).toBeLessThan(5);
            expect(height).toBeLessThan(5);
        }
    });

    it('orders tiles centre-outwards so a ring-lazy stop leaves no hole', () => {
        const tiles = coveringTiles(23.588, 58.3829, 10);
        const dists = tiles.map((t) => t.distanceKm);
        expect(dists).toEqual([...dists].sort((a, b) => a - b));
    });

    it('round-trips a coordinate through its tile bbox', () => {
        const lat = 23.588;
        const lon = 58.3829;
        const z = 13;
        const b = tileBBox(z, lonToTileX(lon, z), latToTileY(lat, z));
        expect(lat).toBeGreaterThanOrEqual(b.south);
        expect(lat).toBeLessThanOrEqual(b.north);
        expect(lon).toBeGreaterThanOrEqual(b.west);
        expect(lon).toBeLessThanOrEqual(b.east);
    });

    it('grows tile count with radius but stays bounded', () => {
        expect(coveringTiles(23.588, 58.3829, 1).length).toBeLessThan(coveringTiles(23.588, 58.3829, 10).length);
        // Covering a 50km disc outright is ~540 tiles, which at two polite
        // requests at a time is hours of Overpass traffic.
        expect(coveringTiles(23.588, 58.3829, 50).length).toBeLessThanOrEqual(
            TILES.maxTiles + TILES.outerSectors * TILES.outerProbesPerSector
        );
    });

    it('sweeps the near field exhaustively, with no probes', () => {
        for (const r of [1, 5, 10, TILES.fullCoverageKm]) {
            expect(coveringTiles(23.588, 58.3829, r).some((t) => t.sampled)).toBe(false);
        }
    });

    it('reaches further out as the radius grows', () => {
        // The bug this pins: fanning to the NEAREST tile in each direction
        // spreads correctly but never leaves the inner edge, so 20km and 50km
        // searched exactly the same ground.
        const reach = (r) =>
            coveringTiles(23.588, 58.3829, r).reduce((m, t) => Math.max(m, t.distanceKm), 0);
        expect(reach(50)).toBeGreaterThan(reach(30));
        expect(reach(30)).toBeGreaterThan(reach(20));
        expect(reach(20)).toBeGreaterThan(reach(TILES.fullCoverageKm));
    });

    it('probes every direction, not whichever side is tiled densest', () => {
        const lat = 23.588;
        const lon = 58.3829;
        const probes = coveringTiles(lat, lon, 50).filter((t) => t.sampled);
        const quadrant = (t) =>
            `${t.center.lat >= lat ? 'n' : 's'}${t.center.lon >= lon ? 'e' : 'w'}`;
        expect(new Set(probes.map(quadrant)).size).toBe(4);
    });

    it('keeps the fully-covered core ordered centre-outwards', () => {
        const core = coveringTiles(23.588, 58.3829, 30).filter((t) => !t.sampled);
        const dists = core.map((t) => t.distanceKm);
        expect(dists).toEqual([...dists].sort((a, b) => a - b));
    });

    it('clamps a radius no dial can produce', () => {
        // A share link carries the radius as a byte in 0.5km steps, so a
        // hand-edited one can ask for 127km -- and the grid grows with its square.
        expect(coveringTiles(23.588, 58.3829, 127)).toEqual(
            coveringTiles(23.588, 58.3829, SEARCH.maxRadiusKm)
        );
    });
});

describe('radius detents', () => {
    it('snaps a stored or shared radius to the nearest detent', () => {
        expect(SEARCH.radiusSteps[nearestRadiusStep(13)]).toBe(12);
        expect(SEARCH.radiusSteps[nearestRadiusStep(5)]).toBe(5);
        // Dead centre between two detents settles on the narrower search,
        // which is the cheaper sweep to be wrong about.
        expect(SEARCH.radiusSteps[nearestRadiusStep(11)]).toBe(10);
        expect(SEARCH.radiusSteps[nearestRadiusStep(999)]).toBe(SEARCH.maxRadiusKm);
    });

    it('widens by one detent and stops at the last', () => {
        expect(widerRadius(5)).toBe(6);
        expect(widerRadius(15)).toBe(20);
        expect(widerRadius(SEARCH.maxRadiusKm)).toBe(SEARCH.maxRadiusKm);
    });
});

describe('scoring', () => {
    it('shrinks a single glowing review toward the prior', () => {
        const oneFiveStar = quality({}, { rating: 5, userRatingCount: 1 });
        const establishedGood = quality({}, { rating: 4.6, userRatingCount: 800 });
        expect(establishedGood).toBeGreaterThan(oneFiveStar);
    });

    it('places unrated OSM entries mid-distribution, not at the bottom', () => {
        const unrated = quality({ completeness: 0.5 }, undefined);
        expect(unrated).toBeGreaterThan(quality({}, { rating: 3.2, userRatingCount: 400 }));
        expect(unrated).toBeLessThan(quality({}, { rating: 4.7, userRatingCount: 400 }));
    });

    it('decays with distance in standard mode', () => {
        expect(proximity(1, 5)).toBeGreaterThan(proximity(4, 5));
    });

    it('adventure mode peaks mid-range rather than at the boundary', () => {
        const mid = proximity(3.5, 5, true);
        expect(mid).toBeGreaterThan(proximity(0.5, 5, true));
        expect(mid).toBeGreaterThan(proximity(5, 5, true));
    });
});

describe('google error classification', () => {
    const payload = (status, message, reason) => ({
        error: { code: status, status: 'PERMISSION_DENIED', message, details: reason ? [{ reason }] : [] },
    });

    /** The failure that actually happened in production: a project set up for
     *  the legacy Maps stack rejects every Places API (New) call, and because
     *  the call never reaches an enabled API it shows as zero traffic in the
     *  Cloud console -- indistinguishable from the app never trying. */
    it('identifies a disabled Places API (New) and links to the fix', () => {
        const e = classifyError(403, payload(403, 'Places API (New) has not been used in project 1 before or it is disabled.', 'SERVICE_DISABLED'));
        expect(e.code).toBe('not-enabled');
        expect(e.docsUrl).toContain('places.googleapis.com');
    });

    /** Seen on the real deployment: the key was scoped to the Maps JavaScript
     *  API, so Places API (New) was refused by the KEY rather than missing from
     *  the project -- a different fix, and previously indistinguishable. */
    it('separates a key-restriction block from a disabled API', () => {
        const e = classifyError(403, payload(403, 'Requests to this API places.googleapis.com method google.maps.places.v1.Places.SearchText are blocked.', 'API_KEY_SERVICE_BLOCKED'));
        expect(e.code).toBe('key-restricted');
        expect(e.hint).toMatch(/API restrictions/i);
        expect(e.docsUrl).toContain('credentials');
    });

    it.each([
        ['API key not valid. Please pass a valid API key.', 'API_KEY_INVALID', 'invalid-key'],
        ['Requests from referer http://x are blocked.', 'API_KEY_HTTP_REFERRER_BLOCKED', 'referrer-blocked'],
        ['Billing has not been enabled for this project.', 'BILLING_DISABLED', 'billing'],
    ])('classifies %s', (message, reason, expected) => {
        expect(classifyError(403, payload(403, message, reason)).code).toBe(expected);
    });

    it('treats 429 as quota, not as a configuration problem', () => {
        expect(classifyError(429, payload(429, 'Quota exceeded'))).toBeInstanceOf(QuotaError);
    });

    it('still produces something actionable for an unrecognised failure', () => {
        const e = classifyError(500, null);
        expect(e.code).toBe('error');
        expect(e.hint).toMatch(/500/);
    });
});

describe('maps links', () => {
    const place = { name: 'Star Coffee Shop', lat: 23.588, lon: 58.3829 };
    const arabic = { name: 'مطعم الجود', lat: 23.5, lon: 58.4 };

    /** About a quarter of OSM places return nothing from Google, so a name
     *  search would land the user on results for a business Google has never
     *  heard of. Directions to the coordinates are always correct. */
    it('routes to the exact coordinates when there is no Google listing', () => {
        const url = mapsUrlFor(place, null);
        expect(url).toContain('/maps/dir/');
        expect(url).toContain('destination=23.588,58.3829');
    });

    it('uses the exact listing when a Place ID is known', () => {
        const url = mapsUrlFor(place, { googlePlaceId: 'ChIJabc123' });
        expect(url).toContain('query_place_id=ChIJabc123');
        expect(url).toContain('api=1');
    });

    it('ignores mock Place IDs from the offline dev mode', () => {
        expect(mapsUrlFor(place, { googlePlaceId: 'mock_999' })).not.toContain('query_place_id');
    });

    it('percent-encodes Arabic names when a listing exists', () => {
        expect(mapsUrlFor(arabic, { googlePlaceId: 'ChIJx' })).toContain('%D9%85');
        expect(directionsUrlFor(arabic, { googlePlaceId: 'ChIJx' })).toContain('%D9%85');
    });
});

describe('api key shape', () => {
    const GOOD = 'AIza' + 'b'.repeat(35);

    it('accepts a well-formed key', () => {
        expect(inspectKeyShape(GOOD)).toEqual({ ok: true, length: 39 });
    });

    /** The failure that actually bit in production: a key that looks right but
     *  was cut short on paste produces an opaque "not valid" from Google. */
    it('catches a truncated paste and says how short it is', () => {
        const r = inspectKeyShape(GOOD.slice(0, 35));
        expect(r.ok).toBe(false);
        expect(r.reason).toBe('length');
        expect(r.length).toBe(35);
    });

    /** An autocorrected dash is now REPAIRED rather than rejected -- see the
     *  sanitising suite. What must still be caught is a character that is not a
     *  recoverable substitution. */
    it('rejects a character that is not a recoverable substitution', () => {
        expect(inspectKeyShape('AIza!' + 'b'.repeat(34)).reason).toBe('charset');
    });

    it('accepts a key whose hyphens a keyboard replaced with en-dashes', () => {
        expect(inspectKeyShape('AIza–' + 'b'.repeat(34)).ok).toBe(true);
    });

    it.each([
        ['empty', '', 'empty'],
        ['not a Google key', 'my-api-key', 'prefix'],
        // Whitespace is stripped by the sanitiser, so what remains is judged on
        // length -- a key with a line break in it is still the right length.
        ['too short once whitespace is stripped', `AIza${'b'.repeat(20)}
bbbb`, 'length'],
    ])('rejects %s', (_label, key, reason) => {
        expect(inspectKeyShape(key).reason).toBe(reason);
    });

    it('tolerates surrounding whitespace from a clipboard', () => {
        expect(inspectKeyShape(`  ${GOOD}  `).ok).toBe(true);
    });
});

describe('api key sanitising', () => {
    // Shape-accurate but synthetic: 39 chars, and two hyphens so the
    // dash-substitution cases below are genuinely exercised.
    const GOOD = 'AIzaSyEXAMPLE-NOT-A-REAL-KEY-0123456789';
    const ch = (c) => String.fromCharCode(c);

    /** Reported: the key worked on desktop but never on an iPhone, in both
     *  Safari and Chrome, even typed character by character. Smart punctuation
     *  applies as you TYPE, so typing slowly does not avoid it, and a single
     *  substituted dash is invisible on screen but fatal to the request. */
    it.each([
        ['en dash', 0x2013],
        ['em dash', 0x2014],
        ['figure dash', 0x2012],
        ['non-breaking hyphen', 0x2011],
        ['minus sign', 0x2212],
    ])('repairs a %s substituted for a hyphen', (_label, code) => {
        expect(sanitizeKey(GOOD.replace(/-/g, ch(code)))).toBe(GOOD);
    });

    it.each([
        ['non-breaking space', 0x00a0],
        ['zero-width space', 0x200b],
        ['zero-width joiner', 0x200d],
        ['byte order mark', 0xfeff],
    ])('strips an embedded %s', (_label, code) => {
        expect(sanitizeKey(GOOD.slice(0, 20) + ch(code) + GOOD.slice(20))).toBe(GOOD);
    });

    it('trims clipboard whitespace', () => {
        expect(sanitizeKey(`
  ${GOOD}  
`)).toBe(GOOD);
    });

    /** The failure that actually reached the user, on an iPhone with an Arabic
     *  keyboard: an invisible directional mark lands in front of the key when
     *  RTL and LTR text meet. The key looks perfectly correct on screen, and
     *  startsWith('AIza') fails, so the app called a correct key wrong. */
    it.each([
        ['left-to-right mark', 0x200e],
        ['right-to-left mark', 0x200f],
        ['arabic letter mark', 0x061c],
        ['left-to-right isolate', 0x2066],
        ['pop directional isolate', 0x2069],
    ])('strips a leading %s', (_label, code) => {
        expect(sanitizeKey(ch(code) + GOOD)).toBe(GOOD);
        expect(inspectKeyShape(ch(code) + GOOD).ok).toBe(true);
    });

    it.each([
        ['left-to-right mark', 0x200e],
        ['right-to-left mark', 0x200f],
        ['arabic letter mark', 0x061c],
    ])('strips an embedded %s', (_label, code) => {
        expect(sanitizeKey(GOOD.slice(0, 12) + ch(code) + GOOD.slice(12))).toBe(GOOD);
    });

    it('names the actual leading characters when the prefix is genuinely wrong', () => {
        const r = inspectKeyShape('xxAIzaSyEXAMPLE-NOT-A-REAL-KEY-01234567');
        expect(r.reason).toBe('prefix');
        expect(r.startsWith).toBe('xxAI');
    });

    /** The failure that actually happened: "AIza" was read off the screen and
     *  typed as "Alza", because capital I and lowercase l are the same shape in
     *  most UI typefaces -- including the one the error message was rendered in,
     *  so the message could not be used to spot the mistake. */
    it.each([
        ['lowercase L', 'Alza', 'a lowercase L'],
        ['digit one', 'A1za', 'a digit one'],
        ['pipe', 'A|za', 'a pipe'],
    ])('names %s specifically when typed where the capital i belongs', async (_label, prefix, expected) => {
        const r = await testConnection(prefix + 'b'.repeat(35));
        expect(r.code).toBe('bad-key-shape');
        // Naming the wrong character matters: telling someone who typed a digit
        // to look for a lowercase L sends them hunting a mistake that is not there.
        expect(r.hint).toContain(`The second character is ${expected}`);
        expect(r.hint).toMatch(/capital A, capital i, lowercase z, lowercase a/);
    });

    it('does not invent a lookalike when the prefix is simply wrong', async () => {
        const r = await testConnection('zzzz' + 'b'.repeat(35));
        expect(r.hint).not.toMatch(/second character is/);
    });

    it('spells out the prefix rather than only showing it', async () => {
        const r = await testConnection('zzzz' + 'b'.repeat(35));
        expect(r.hint).toMatch(/capital A, capital i, lowercase z, lowercase a/);
    });

    it('leaves a correct key untouched', () => {
        expect(sanitizeKey(GOOD)).toBe(GOOD);
    });

    it('does not disguise a genuinely truncated key', () => {
        expect(inspectKeyShape(GOOD.slice(0, 35)).reason).toBe('length');
    });
});

describe('filter counts', () => {
    const place = (id, cuisines, category = 'restaurant') => ({
        id, name: id, cuisines, category, lat: 23.5, lon: 58.4, tags: {},
    });
    const pool = [
        place('a', ['pizza']),
        place('b', ['pizza']),
        place('c', ['coffee'], 'cafe'),
        place('d', ['indian']),
    ];

    it('reports how many places each chip actually reaches', () => {
        const counts = chipCounts(pool);
        expect(counts.pizza).toBe(2);
        expect(counts.indian).toBe(1);
    });

    /** The reported symptom: the header showed the unfiltered total, so with a
     *  narrow chip on it promised far more variety than the board could draw
     *  from -- which reads as the picker being broken rather than narrowed. */
    it('counts only what the filter leaves selectable', () => {
        const selectable = pool.filter((p) => matchesChips(p, ['pizza'])).length;
        expect(selectable).toBe(2);
        expect(selectable).toBeLessThan(pool.length);
    });

    it('reports zero for a chip nothing matches, so it can be disabled', () => {
        expect(chipCounts(pool).seafood).toBe(0);
    });

    it('gives every chip a count, so none renders blank', () => {
        const counts = chipCounts(pool);
        for (const chip of CUISINE_CHIPS) expect(typeof counts[chip.id]).toBe('number');
    });

    it('treats no chips as the whole pool', () => {
        expect(pool.filter((p) => matchesChips(p, [])).length).toBe(pool.length);
    });
});
