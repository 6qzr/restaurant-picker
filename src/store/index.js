import { create } from 'zustand';
import { SEARCH, SAMPLING } from '../config.js';
import { randomSeed } from '../engine/prng.js';
import { pickBoard, swapLane } from '../engine/rank/pick.js';

/** One store, read and written from plain modules as well as React.
 *
 *  The sweep emits many incremental batches from outside React; a store that is
 *  readable synchronously outside a component is what keeps that from turning
 *  into a re-render storm, and it makes pickBoard testable with no React at all.
 */

const loadKey = () => {
    try {
        return import.meta.env?.VITE_GOOGLE_MAPS_API_KEY || localStorage.getItem('cc_api_key') || '';
    } catch {
        return '';
    }
};

const loadJSON = (k, fallback) => {
    try {
        const v = localStorage.getItem(k);
        return v ? JSON.parse(v) : fallback;
    } catch {
        return fallback;
    }
};

const save = (k, v) => {
    try {
        localStorage.setItem(k, JSON.stringify(v));
    } catch {
        /* private mode / quota: settings simply don't persist */
    }
};

export const useStore = create((set, get) => ({
    // ---- session ----
    apiKey: loadKey(),
    location: null,
    locationError: '',
    radiusKm: loadJSON('cc_radius', SEARCH.defaultRadiusKm),
    chips: loadJSON('cc_chips', []),
    temperature: loadJSON('cc_temp', SAMPLING.defaultTemperature),
    adventure: loadJSON('cc_adventure', false),
    showRatings: loadJSON('cc_ratings', true),
    reducedMotion: false,

    setApiKey: (apiKey) => {
        try { localStorage.setItem('cc_api_key', apiKey); } catch { /* ignore */ }
        set({ apiKey });
    },
    setLocation: (location) => set({ location, locationError: '' }),
    setLocationError: (locationError) => set({ locationError }),
    setRadius: (radiusKm) => { save('cc_radius', radiusKm); set({ radiusKm }); },
    setChips: (chips) => { save('cc_chips', chips); set({ chips }); },
    toggleChip: (id) => {
        const chips = get().chips.includes(id)
            ? get().chips.filter((c) => c !== id)
            : [...get().chips, id];
        save('cc_chips', chips);
        set({ chips });
    },
    setTemperature: (temperature) => { save('cc_temp', temperature); set({ temperature }); },
    setAdventure: (adventure) => { save('cc_adventure', adventure); set({ adventure }); },
    setShowRatings: (showRatings) => { save('cc_ratings', showRatings); set({ showRatings }); },

    // ---- discovery ----
    pool: [],
    poolVersion: 0,
    sweepPhase: 'idle',
    sweepProgress: { fetched: 0, toFetch: 0, total: 0 },
    /** Growth is surfaced as an invitation, never an automatic re-roll. */
    newSincePick: 0,

    addPlaces: (places) => {
        if (!places.length) return;
        const seen = new Set(get().pool.map((p) => p.id));
        const fresh = places.filter((p) => !seen.has(p.id));
        if (!fresh.length) return;
        set((s) => ({
            pool: [...s.pool, ...fresh],
            poolVersion: s.poolVersion + 1,
            newSincePick: s.board ? s.newSincePick + fresh.length : 0,
        }));
    },
    resetPool: () => set({ pool: [], poolVersion: 0, newSincePick: 0 }),
    setSweep: (p) => set({ sweepPhase: p.phase, sweepProgress: p }),

    // ---- board ----
    board: null,
    seed: null,
    isPicking: false,
    enrichments: new Map(),
    prefs: {},
    seen: new Map(),
    swapCursors: {},
    sharedMode: false,

    setPrefs: (prefs) => set({ prefs }),
    setSeen: (seen) => set({ seen }),
    setEnrichments: (enrichments) => set({ enrichments: new Map(enrichments) }),
    mergeEnrichments: (more) =>
        set((s) => {
            const next = new Map(s.enrichments);
            for (const [k, v] of more) next.set(k, v);
            return { enrichments: next };
        }),

    spin: (overrides = {}) => {
        const s = get();
        if (!s.location) return null;
        const seed = overrides.seed ?? randomSeed();
        const board = pickBoard(s.pool, {
            origin: s.location,
            radiusKm: s.radiusKm,
            seed,
            temperature: s.temperature,
            adventure: s.adventure,
            prefs: s.prefs,
            seen: s.seen,
            enrichments: s.enrichments,
            chips: s.chips,
            shared: overrides.shared ?? false,
            ...overrides,
        });
        set({ board, seed, swapCursors: {}, newSincePick: 0, sharedMode: Boolean(overrides.shared) });
        return board;
    },

    setBoard: (board, seed) => set({ board, seed, swapCursors: {}, newSincePick: 0 }),

    swap: (laneId) => {
        const s = get();
        if (!s.board) return;
        const cursors = { ...s.swapCursors };
        const board = swapLane(s.board, laneId, cursors);
        set({ board, swapCursors: cursors });
    },

    // ---- group voting (pass-the-phone) ----
    voters: [],
    votes: {},
    revealed: false,
    addVoter: (name) => set((s) => ({ voters: [...s.voters, name] })),
    removeVoter: (name) => set((s) => ({
        voters: s.voters.filter((v) => v !== name),
        votes: Object.fromEntries(Object.entries(s.votes).filter(([k]) => !k.startsWith(`${name}:`))),
    })),
    castVote: (voter, laneId, approve) =>
        set((s) => ({ votes: { ...s.votes, [`${voter}:${laneId}`]: approve } })),
    reveal: () => set({ revealed: true }),
    resetVoting: () => set({ voters: [], votes: {}, revealed: false }),
}));

/** Approval voting: most yeses wins; ties broken by the ranking score. */
export const tallyVotes = (board, voters, votes) => {
    if (!board) return [];
    return board.slots
        .filter((s) => s.place)
        .map((slot) => ({
            slot,
            approvals: voters.filter((v) => votes[`${v}:${slot.lane}`]).length,
            score: slot.metrics?.base ?? 0,
        }))
        .sort((a, b) => b.approvals - a.approvals || b.score - a.score);
};
