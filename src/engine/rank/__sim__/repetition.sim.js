/**
 * The acceptance test for the whole rebuild.
 *
 * Simulates 60 days of one spin per day and measures how repetitive the results
 * are. Run against both the old pickerLogic and the new engine to turn "it keeps
 * bringing the same restaurants" from a feeling into a number.
 */
import { pickBoard } from '../pick.js';
import { createMemorySeenStore } from '../../history/seenStore.js';
import { makeRng } from '../../prng.js';

const DAY = 86400000;

/** Deterministic pseudo-ratings, so both engines see identical data.
 *  (Real Google ratings are never persisted -- see the enrichment boundary.) */
export const synthEnrichments = (places, seedStr = 'ratings') => {
    const rng = makeRng(seedStr);
    const map = new Map();
    for (const p of places) {
        const popular = p.isChain || rng() < 0.25;
        map.set(p.id, {
            rating: 3.2 + rng() * 1.7,
            userRatingCount: Math.round(popular ? 200 + rng() * 2500 : 3 + rng() * 160),
        });
    }
    return map;
};

export const measure = (boards, places) => {
    const byId = new Map(places.map((p) => [p.id, p]));
    const slots = boards.flat();
    const total = slots.length;
    const unique = new Set(slots).size;

    const appearances = new Map();
    const dayOf = new Map();
    const gaps = [];
    boards.forEach((board, day) => {
        for (const id of board) {
            appearances.set(id, (appearances.get(id) ?? 0) + 1);
            if (dayOf.has(id)) gaps.push(day - dayOf.get(id));
            dayOf.set(id, day);
        }
    });

    let cuisineCollisions = 0;
    for (const board of boards) {
        const primaries = board.map((id) => byId.get(id)?.cuisines?.[0]).filter(Boolean);
        if (new Set(primaries).size < primaries.length) cuisineCollisions++;
    }

    return {
        totalSlots: total,
        unique,
        uniquePct: total ? (unique / total) * 100 : 0,
        meanGapDays: gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : Infinity,
        maxAppearances: appearances.size ? Math.max(...appearances.values()) : 0,
        cuisineCollisionPct: boards.length ? (cuisineCollisions / boards.length) * 100 : 0,
    };
};

export const runNewEngine = (places, { origin, radiusKm, temperature, days = 60, enrichments }) => {
    const seen = createMemorySeenStore();
    const boards = [];
    const start = Date.now() - days * DAY;

    for (let d = 0; d < days; d++) {
        const now = start + d * DAY;
        const board = pickBoard(places, {
            origin,
            radiusKm,
            seed: `sim-${d}`,
            temperature,
            prefs: {},
            seen: seen.map,
            enrichments,
            now,
        });
        const ids = board.slots.filter((s) => s.place).map((s) => s.place.id);
        boards.push(ids);
        seen.recordShown(ids, now);
    }
    return boards;
};

/** The shipped algorithm, reproduced exactly -- including the biased shuffle and
 *  the session-only ban list (i.e. no memory at all across days). */
export const runOldEngine = (places, { origin, days = 60, enrichments, universeCap = 20 }) => {
    const toLegacy = (p) => {
        const e = enrichments.get(p.id) ?? {};
        return {
            place_id: p.id,
            name: p.name,
            rating: e.rating,
            user_ratings_total: e.userRatingCount,
            types: p.cuisines,
            geometry: { location: { lat: p.lat, lng: p.lon } },
            cuisines: p.cuisines,
        };
    };

    // The old app's universe: Places searchNearby returns at most 20, ranked by
    // popularity, then filters to rated-only. Same 20 rows on every call.
    const universe = [...places]
        .map(toLegacy)
        .filter((p) => p.rating && p.user_ratings_total > 0)
        .sort((a, b) => b.user_ratings_total - a.user_ratings_total)
        .slice(0, universeCap);

    const biasedShuffle = (arr) => arr.sort(() => Math.random() - 0.5);
    const dist = (a, b, c, d) => {
        const R = 6371, dLat = (c - a) * Math.PI / 180, dLon = (d - b) * Math.PI / 180;
        const x = Math.sin(dLat / 2) ** 2 + Math.cos(a * Math.PI / 180) * Math.cos(c * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    };

    const boards = [];
    for (let d = 0; d < days; d++) {
        const scored = universe.map((p) => {
            const conf = Math.min(Math.log10(p.user_ratings_total || 1) * 0.2, 1.0);
            const dk = dist(origin.lat, origin.lon, p.geometry.location.lat, p.geometry.location.lng);
            return { ...p, effectiveRating: (p.rating || 0) + conf - dk * 0.1 };
        });
        if (scored.length < 3) { boards.push([]); continue; }

        const sortedByBest = [...scored].sort((a, b) => b.effectiveRating - a.effectiveRating);
        const bestRated = biasedShuffle(sortedByBest.slice(0, 3))[0];

        const hiddenPool = scored
            .filter((p) => p.place_id !== bestRated.place_id && p.user_ratings_total < 150 && p.user_ratings_total > 5)
            .sort((a, b) => b.rating - a.rating)
            .slice(0, 5);
        let hiddenGem = hiddenPool.length ? biasedShuffle(hiddenPool)[0] : null;
        if (!hiddenGem) {
            // The fallback that makes two cards show the same tier.
            const remaining = sortedByBest.filter((p) => p.place_id !== bestRated.place_id);
            hiddenGem = remaining.length ? biasedShuffle(remaining.slice(0, 3))[0] : null;
        }

        const rest = scored.filter(
            (p) => p.place_id !== bestRated.place_id && p.place_id !== hiddenGem?.place_id
        );
        const wildcard = rest.length ? biasedShuffle(rest)[0] : null;

        boards.push([bestRated, hiddenGem, wildcard].filter(Boolean).map((p) => p.place_id));
    }
    return boards;
};
