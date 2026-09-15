import { SAMPLING } from '../../config.js';
import { haversineKm } from '../geo.js';

/** Diversity, so the board never shows three pizza places.
 *
 *  Randomness has already been applied once (the Gumbel perturbation); selection
 *  here is deterministic greedy MMR over the perturbed keys. Sampling-then-
 *  rejecting would have non-deterministic runtime and would break the share
 *  link's reproducibility.
 */

const jaccard = (a = [], b = []) => {
    if (!a.length || !b.length) return 0;
    const A = new Set(a);
    let inter = 0;
    for (const x of new Set(b)) if (A.has(x)) inter++;
    const union = new Set([...a, ...b]).size;
    return union ? inter / union : 0;
};

export const similarity = (a, b, radiusKm) => {
    const d = haversineKm(a.lat, a.lon, b.lat, b.lon);
    return (
        0.55 * jaccard(a.cuisines, b.cuisines) +
        0.25 * Math.exp(-d / (0.4 * Math.max(radiusKm, 0.5))) +
        0.2 * (a.category === b.category ? 1 : 0)
    );
};

/** Hard constraints, applied on top of the soft MMR penalty. Cheaper and far
 *  more legible than trying to tune lambda to express "not within 250m". */
export const CONSTRAINTS = [
    {
        name: 'brand',
        ok: (cand, chosen) =>
            !chosen.some(
                (c) => cand.tags?.brand && c.tags?.brand && cand.tags.brand === c.tags.brand
            ),
    },
    {
        name: 'distance',
        ok: (cand, chosen) =>
            !chosen.some(
                (c) => haversineKm(cand.lat, cand.lon, c.lat, c.lon) * 1000 < SAMPLING.minSeparationMeters
            ),
    },
    {
        name: 'cuisine',
        ok: (cand, chosen) => {
            const primary = cand.cuisines[0];
            if (!primary) return true;
            return !chosen.some((c) => c.cuisines[0] === primary);
        },
    },
];

/** Relaxation order: give up brand-distinctness first, geography next, and
 *  cuisine variety last -- cuisine is what the user actually perceives. */
const RELAX_ORDER = ['brand', 'distance', 'cuisine'];

export const passesConstraints = (cand, chosen, relaxLevel = 0) => {
    const dropped = RELAX_ORDER.slice(0, relaxLevel);
    return CONSTRAINTS.every((c) => dropped.includes(c.name) || c.ok(cand, chosen));
};

/**
 * Pick the next item: highest perturbed key, penalised by similarity to what is
 * already on the board, subject to the hard constraints. Relaxes silently
 * rather than leaving a slot empty for a reason the user can't see.
 */
export const pickNext = (candidates, chosen, { radiusKm, lambda = SAMPLING.mmrLambda } = {}) => {
    if (!candidates.length) return null;
    if (!chosen.length) return candidates.reduce((a, b) => (b.key > a.key ? b : a));

    const keys = candidates.map((c) => c.key);
    const lo = Math.min(...keys);
    const hi = Math.max(...keys);
    const norm = (k) => (hi === lo ? 1 : (k - lo) / (hi - lo));

    for (let relax = 0; relax <= RELAX_ORDER.length; relax++) {
        let best = null;
        let bestVal = -Infinity;
        for (const cand of candidates) {
            if (!passesConstraints(cand.place, chosen, relax)) continue;
            const maxSim = Math.max(...chosen.map((c) => similarity(cand.place, c, radiusKm)));
            const val = (1 - lambda) * norm(cand.key) - lambda * maxSim;
            if (val > bestVal) {
                bestVal = val;
                best = cand;
            }
        }
        if (best) return best;
    }
    return null;
};
