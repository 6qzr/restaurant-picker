import { makeRng } from '../prng.js';
import { scorePlaces } from './score.js';
import { perturb, plausible, temperatureFor } from './sample.js';
import { pickNext } from './mmr.js';
import { LANE_DEFS } from './buckets.js';
import { matchesChips } from '../../utils/cuisine.js';

/**
 * Build a board of three places.
 *
 * Pure and synchronous: given the same pool, seen-history and seed it always
 * returns the same board. That is what makes the share link work and what makes
 * the repetition simulation meaningful.
 *
 * Runs in single-digit milliseconds over a few hundred places -- so the old
 * 2000ms setTimeout in front of the reveal was pure theatre, and worse, it was
 * the mechanism by which a late-arriving fetch silently re-rolled the board.
 */
export const pickBoard = (pool, ctx) => {
    const {
        origin,
        radiusKm,
        seed = 'seed',
        temperature = 0.45,
        adventure = false,
        prefs = {},
        seen = new Map(),
        enrichments = new Map(),
        chips = [],
        now = Date.now(),
        shared = false,
    } = ctx;

    // A shared board must not be coloured by one person's private history.
    const effSeen = shared ? new Map() : seen;
    const effPrefs = shared ? {} : prefs;

    const filtered = pool.filter((p) => matchesChips(p, chips));
    if (filtered.length < 3) {
        return { slots: [], seed, temperature, reason: 'pool-too-small', poolSize: filtered.length };
    }

    const rng = makeRng(`${seed}`);
    const tauBase = temperatureFor(temperature);

    const scoredAll = scorePlaces(filtered, {
        origin,
        radiusKm,
        adventure,
        prefs: effPrefs,
        seen: effSeen,
        enrichments,
        now,
    });

    const slots = [];
    const chosenPlaces = [];
    const used = new Set();

    for (const lane of LANE_DEFS) {
        // Re-score per lane only where gamma differs, so "Safe Bet" can tolerate
        // repetition while "Something New" cannot.
        const laneScored =
            lane.gamma === 1.0
                ? scoredAll
                : scorePlaces(filtered, {
                      origin,
                      radiusKm,
                      adventure,
                      prefs: effPrefs,
                      seen: effSeen,
                      enrichments,
                      gamma: lane.gamma,
                      now,
                  });

        const available = laneScored.filter((s) => !used.has(s.place.id));
        // A lane NEVER silently borrows another lane's pool -- that collapse is
        // exactly what made two of the three old cards show the same tier.
        const lanePool = lane.filter(available, { ...ctx, prefs: effPrefs, radiusKm }, chosenPlaces);

        if (!lanePool.length) {
            slots.push({ lane: lane.id, label: lane.label, blurb: lane.blurb, place: null, empty: true, emptyMessage: lane.emptyMessage });
            continue;
        }

        const candidates = perturb(plausible(lanePool), tauBase * lane.tauScale, rng).sort(
            (a, b) => b.key - a.key
        );

        const winner = pickNext(candidates, chosenPlaces, { radiusKm });
        if (!winner) {
            slots.push({ lane: lane.id, label: lane.label, blurb: lane.blurb, place: null, empty: true, emptyMessage: lane.emptyMessage });
            continue;
        }

        used.add(winner.place.id);
        chosenPlaces.push(winner.place);
        slots.push({
            lane: lane.id,
            label: lane.label,
            blurb: lane.blurb,
            place: winner.place,
            metrics: {
                score: winner.score,
                base: winner.base,
                novelty: winner.novelty,
                quality: winner.quality,
                distKm: winner.distKm,
            },
            // Ordered alternates, so Swap walks the list deterministically
            // instead of returning candidates[0] forever.
            alternates: candidates.filter((c) => c.place.id !== winner.place.id).map((c) => c.place),
            empty: false,
        });
    }

    return { slots, seed, temperature, poolSize: filtered.length };
};

/** Swap one lane to its next alternate, honouring the board's other picks. */
export const swapLane = (board, laneId, cursorMap) => {
    const slot = board.slots.find((s) => s.lane === laneId);
    if (!slot?.alternates?.length) return board;

    const others = board.slots.filter((s) => s.lane !== laneId && s.place).map((s) => s.place);
    const usedIds = new Set(others.map((p) => p.id));

    const cursor = cursorMap[laneId] ?? 0;
    const pool = slot.alternates.filter((p) => !usedIds.has(p.id));
    if (!pool.length) return board;

    const next = pool[cursor % pool.length];
    cursorMap[laneId] = cursor + 1;

    return {
        ...board,
        slots: board.slots.map((s) =>
            s.lane === laneId ? { ...s, place: next, empty: false } : s
        ),
    };
};
