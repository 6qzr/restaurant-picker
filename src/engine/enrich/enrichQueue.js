import { fetchDetails, resolveByText, QuotaError, EnrichmentError } from './googlePlaces.js';
import { getMatches, putMatch, putMiss } from '../../data/gmatchRepo.js';
import { getBudget, totalCalls } from '../../data/budgetRepo.js';

/**
 * Enrichment for the three places actually on screen -- and nothing else.
 *
 * Google ratings, photos and display names have no caching exception in
 * Google's terms, so they are held HERE, in memory, for the session only, and
 * never written to IndexedDB. Only the resolved Place ID is persisted.
 */

const memory = new Map();
const inflight = new Map();

export const clearMemory = () => memory.clear();

/** Why enrichment is not producing results, in a form the UI can explain.
 *  A silent failure is the worst outcome for a bring-your-own-key app: the
 *  user has no way to tell a wrong key from a disabled API from no key at all. */
let status = { code: 'idle', hint: null, docsUrl: null, at: null };
export const enrichmentStatus = () => status;
const setStatus = (code, hint = null, docsUrl = null) => {
    status = { code, hint, docsUrl, at: Date.now() };
};

const MOCK = import.meta.env?.VITE_ENRICH_MODE === 'mock';

/** Deterministic stand-in so the whole UI can be built and demoed with zero
 *  spend and no key. */
const mockEnrichment = (place) => {
    let h = 0;
    for (let i = 0; i < place.id.length; i++) h = (h * 31 + place.id.charCodeAt(i)) >>> 0;
    return {
        googlePlaceId: `mock_${h}`,
        rating: Math.round((3.3 + (h % 170) / 100) * 10) / 10,
        userRatingCount: 5 + (h % 1800),
        photoUrl: null,
        mock: true,
    };
};

const enrichOne = async (place, opts) => {
    if (memory.has(place.id)) return memory.get(place.id);
    if (inflight.has(place.id)) return inflight.get(place.id);

    const task = (async () => {
        if (MOCK) {
            const e = mockEnrichment(place);
            memory.set(place.id, e);
            return e;
        }

        const { apiKey, withRatings = true, signal, languageCode } = opts;
        if (!apiKey) return null;

        try {
            const known = opts.matches?.get(place.id);
            if (known?.googlePlaceId) {
                const e = await fetchDetails(known.googlePlaceId, { apiKey, withRatings, signal });
                memory.set(place.id, e);
                return e;
            }
            // A remembered miss: don't pay for the same failed search every day.
            if (known && known.googlePlaceId === null) return null;

            const resolved = await resolveByText(place, { apiKey, withRatings, signal, languageCode });
            if (!resolved) {
                await putMiss(place.id);
                return null;
            }
            await putMatch(place.id, resolved.enrichment.googlePlaceId, resolved.confidence);
            memory.set(place.id, resolved.enrichment);
            return resolved.enrichment;
        } catch (err) {
            if (err?.name === 'AbortError') return null;
            if (err instanceof QuotaError) {
                setStatus('quota', 'Google quota reached. Still finding places from OpenStreetMap.');
                return null;
            }
            if (err instanceof EnrichmentError) {
                setStatus(err.code, err.hint, err.docsUrl);
                return null;
            }
            // Network-level failure: fetch rejects with a TypeError and no status.
            setStatus('network', 'Could not reach Google. Check your connection.');
            console.warn('[enrich] failed for', place.id, err?.message);
            return null;
        } finally {
            inflight.delete(place.id);
        }
    })();

    inflight.set(place.id, task);
    return task;
};

/**
 * Enrich a small set of places. Returns a Map<id, Enrichment>.
 * Never throws: a failure degrades the card, it does not break the board.
 */
export const enrichPlaces = async (places, opts = {}) => {
    const out = new Map();
    for (const [id, e] of memory) out.set(id, e);
    if (!places.length) return out;

    if (!MOCK) {
        if (!opts.apiKey) {
            setStatus('no-key', 'No Google key set, so there are no ratings or photos.');
            return out;
        }
        const budget = await getBudget();
        if (opts.monthlyCap && totalCalls(budget) >= opts.monthlyCap) {
            setStatus('capped', 'Monthly lookup cap reached. Still finding places from OpenStreetMap.');
            return out;
        }
        opts.matches = await getMatches(places.map((p) => p.id));
    }

    setStatus('working');
    const results = await Promise.all(places.map((p) => enrichOne(p, opts)));
    places.forEach((p, i) => {
        if (results[i]) out.set(p.id, results[i]);
    });

    // Every lookup came back empty with no error raised: the key works, but
    // nothing matched. Worth saying so rather than looking broken.
    if (status.code === 'working' && results.every((r) => !r)) {
        setStatus('no-match', 'Connected to Google, but none of these places could be matched confidently.');
    } else if (status.code === 'working') {
        setStatus('ok');
    }
    return out;
};
