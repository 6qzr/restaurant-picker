import { topCuisines } from '../../data/prefsRepo.js';

/**
 * The three lanes, defined by ROLE in the decision rather than by position on
 * the Google rating axis.
 *
 * The old Best Rated / Hidden Gem / Wildcard buckets were all defined on that
 * one axis, so when rating data was thin they collapsed into each other: the
 * "Hidden Gem" filter (under 150 reviews) almost never matched a popularity-
 * ranked result set, so it fell back to the same top-rated pool and two of the
 * three cards showed the same tier. Every lane below is fillable with zero
 * Google data.
 */

const median = (xs) => {
    if (!xs.length) return 0;
    const s = [...xs].sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export const LANE_DEFS = [
    {
        id: 'safeBet',
        label: 'Safe Bet',
        blurb: 'Reliable. You will not regret this one.',
        gamma: 0.5, // novelty softened: the dependable option may recur
        tauScale: 0.4,
        filter: (scored) => {
            const med = median(scored.map((s) => s.quality));
            const pool = scored.filter((s) => s.quality >= med);
            return pool.length ? pool : scored;
        },
    },
    {
        id: 'somethingNew',
        label: 'Something New',
        blurb: 'You have never been sent here before.',
        gamma: 1.0,
        tauScale: 1.0,
        // Structurally guaranteed novel. This lane is the direct answer to
        // "nothing new, nothing surprising".
        filter: (scored, ctx) => {
            const liked = new Set(topCuisines(ctx.prefs ?? {}, 3));
            const pool = scored.filter(
                (s) => s.novelty >= 0.85 || !s.place.cuisines.some((c) => liked.has(c))
            );
            return pool.length ? pool : [];
        },
        emptyMessage: 'You have seen almost everything nearby.',
    },
    {
        id: 'longShot',
        label: 'Long Shot',
        blurb: 'Further out, or nothing like the others.',
        gamma: 1.0,
        tauScale: 1.6,
        filter: (scored, ctx, chosen) => {
            const chosenCuisines = new Set(chosen.flatMap((c) => c.cuisines));
            const pool = scored.filter(
                (s) =>
                    s.distKm > 0.5 * ctx.radiusKm ||
                    !s.place.cuisines.some((c) => chosenCuisines.has(c))
            );
            return pool.length ? pool : scored;
        },
    },
];
