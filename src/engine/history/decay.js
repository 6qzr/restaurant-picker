import { SCORE } from '../../config.js';

const DAY_MS = 86400000;

/** Accumulated recency weight of every time a place was shown.
 *  Each showing contributes 0.5^(ageDays / halfLife), so old showings fade. */
export const recencyWeight = (shows = [], now = Date.now(), halfLifeDays = SCORE.noveltyHalfLifeDays) => {
    let sum = 0;
    for (const t of shows) {
        const ageDays = (now - t) / DAY_MS;
        if (ageDays < 0) continue;
        sum += 0.5 ** (ageDays / halfLifeDays);
    }
    return sum;
};

/**
 * Novelty in (0, 1]. 1 = never shown.
 *
 * This MULTIPLIES the base score rather than adding to it. As a linear term at
 * a plausible weight, a place seen five times would lose only ~0.15 -- nowhere
 * near enough to overcome a 0.4 quality gap, so the same few high-rated chains
 * would keep winning. Multiplicatively that place scores base * 0.18: pushed
 * out of the head of the distribution while remaining reachable.
 */
export const novelty = (record, now = Date.now()) => {
    if (!record) return 1;
    let recency = recencyWeight(record.shows, now);
    if (record.vetoedAt) {
        const daysSinceVeto = (now - record.vetoedAt) / DAY_MS;
        if (daysSinceVeto < SCORE.vetoCooldownDays) return 0; // hard-excluded
        recency += SCORE.vetoReentryPenalty;
    }
    return 1 / (1 + recency);
};

export const isVetoed = (record, now = Date.now()) =>
    Boolean(record?.vetoedAt) && (now - record.vetoedAt) / DAY_MS < SCORE.vetoCooldownDays;

/** Drop showings older than the prune window, so records stay small. */
export const pruneShows = (shows = [], now = Date.now()) => {
    const cutoff = now - SCORE.seenPruneDays * DAY_MS;
    return shows.filter((t) => t >= cutoff).slice(-12);
};
