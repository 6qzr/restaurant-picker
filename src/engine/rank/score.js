import { SCORE } from '../../config.js';
import { haversineKm } from '../geo.js';
import { novelty } from '../history/decay.js';
import { preferenceScore } from '../../data/prefsRepo.js';

const clamp01 = (x) => Math.max(0, Math.min(1, x));

/**
 * Quality in [0,1].
 *
 * With a Google rating we apply Bayesian shrinkage toward a global prior, so a
 * single glowing review can't outrank a well-established 4.5.
 *
 * Without one -- no key, no confident match, or ratings turned off -- we fall
 * back to OSM tag completeness as a proxy for "a real, noticed business". The
 * resulting [0.35, 0.80] band is deliberate: an unrated place lands mid-
 * distribution, so it competes with a 4.2 but never beats a genuine 4.7 and
 * never sinks below a 3.2. That keeps mixed pools coherent and makes the
 * no-key app degrade from rating-led to discovery-led rather than to useless.
 */
export const quality = (place, enrichment) => {
    const r = enrichment?.rating;
    const n = enrichment?.userRatingCount;
    if (typeof r === 'number' && typeof n === 'number' && n > 0) {
        const bayes = (n * r + SCORE.priorWeight * SCORE.priorRating) / (n + SCORE.priorWeight);
        return clamp01((bayes - 3.0) / 1.6);
    }
    return 0.35 + 0.45 * clamp01(place.completeness ?? 0);
};

/**
 * Proximity in (0,1].
 *
 * The old linear -0.1/km penalty was trivially outweighed by a rating delta,
 * which is part of why distant chains kept winning. Exponential decay scaled to
 * the search radius makes distance actually matter.
 */
export const proximity = (distKm, radiusKm, adventure = false) => {
    if (adventure) {
        // The old adventure mode added +0.15/km, which is monotonic in distance
        // and therefore always returned the single most distant place. A band
        // centred at 70% of the radius means "worth the drive", not "as far as
        // physically possible".
        const mu = 0.7 * radiusKm;
        const sigma = 0.25 * radiusKm;
        return Math.exp(-((distKm - mu) ** 2) / (2 * sigma ** 2));
    }
    return Math.exp(-distKm / (radiusKm / 2));
};

/** Squash the unbounded preference tally into [0,1]. */
export const preference = (place, prefs) => (Math.tanh(preferenceScore(place, prefs) / 4) + 1) / 2;

/**
 * Score every candidate. Returns new objects; never mutates the pool.
 * @returns {Array<{place, base, score, novelty, distKm, quality, proximity}>}
 */
export const scorePlaces = (places, ctx) => {
    const {
        origin,
        radiusKm,
        adventure = false,
        prefs = {},
        seen = new Map(),
        enrichments = new Map(),
        gamma = SCORE.gamma,
        now = Date.now(),
    } = ctx;

    const w = SCORE.weights;
    const out = [];

    for (const place of places) {
        const rec = seen.get(place.id);
        const N = novelty(rec, now);
        if (N === 0) continue; // inside veto cooldown

        const distKm = haversineKm(origin.lat, origin.lon, place.lat, place.lon);
        const Q = quality(place, enrichments.get(place.id));
        const P = proximity(distKm, radiusKm, adventure);
        const Pref = preference(place, prefs);
        const Indie = place.isChain ? 0 : 1;

        let base = w.quality * Q + w.proximity * P + w.preference * Pref + w.indie * Indie;
        if (rec?.chosenAt) base += SCORE.chosenBonus;

        out.push({
            place,
            distKm,
            quality: Q,
            proximity: P,
            preference: Pref,
            novelty: N,
            base,
            // Novelty multiplies. See decay.js for why adding it doesn't work.
            score: base * N ** gamma,
        });
    }

    return out;
};
