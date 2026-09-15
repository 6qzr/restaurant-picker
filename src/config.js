/** Central tuning surface. Everything the engine's behaviour depends on lives here
 *  so the repetition simulation can sweep values without touching logic. */

export const OVERPASS = {
    mirrors: (import.meta.env?.VITE_OVERPASS_MIRRORS ||
        'https://overpass-api.de/api/interpreter,https://overpass.kumi.systems/api/interpreter,https://overpass.private.coffee/api/interpreter'
    ).split(',').map((s) => s.trim()).filter(Boolean),
    // Higher [timeout:N] makes Overpass reserve a bigger slot, which is
    // harder to schedule on a loaded server. 25 measurably succeeded where 45 did not.
    serverTimeoutSec: 25,
    clientTimeoutMs: 40000,
    // The public instance allows 2 concurrent slots per IP. Measured: exceeding
    // it turns every in-flight tile into a 429.
    concurrency: 2,
    spacingMs: 300,
    maxAttemptsPerTile: 4,
    backoffBaseMs: 1500,
    backoffJitterMs: 750,
    // 429 = our own 2-slot quota is busy; wait for a slot, don't hammer mirrors.
    rateLimitBackoffMs: 3000,
    maxAttemptsOn429: 6,
    cooldownLadderMs: [20_000, 60_000, 180_000],
    outLimit: 800,
};

export const TILES = {
    // z13 (~4.4km at mid latitudes) rather than z14. The Overpass bottleneck is
    // STATEMENTS PER QUERY, not area: a 4-statement query over a 4.4km box runs
    // in ~1-5s, while a 12-statement union over a 2.2km box times out. Bigger
    // tiles therefore mean 4x fewer requests at the same per-request cost.
    zoom: 13,
    staleAfterMs: 30 * 24 * 60 * 60 * 1000,
    ringLazyAboveKm: 6,
    earlyStopNamedCount: 250,
    maxTiles: 60,
};

export const SEARCH = {
    minRadiusKm: 1,
    maxRadiusKm: 15,
    defaultRadiusKm: 5,
    minPoolToSpin: 12,
};

export const SCORE = {
    priorRating: 4.1,
    priorWeight: 30,
    weights: { quality: 0.46, proximity: 0.28, preference: 0.12, indie: 0.14 },
    noveltyHalfLifeDays: 10,
    gamma: 1.0,
    chosenBonus: 0.08,
    plausibilityFloor: 0.55,
    vetoCooldownDays: 90,
    vetoReentryPenalty: 3,
    seenPruneDays: 60,
};

export const SAMPLING = {
    tauMin: 0.02,
    tauSpan: 25,
    defaultTemperature: 0.45,
    mmrLambda: 0.35,
    minSeparationMeters: 250,
};

export const LANES = ['safeBet', 'somethingNew', 'longShot'];
