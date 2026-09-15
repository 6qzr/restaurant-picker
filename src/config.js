/** Central tuning surface. Everything the engine's behaviour depends on lives here
 *  so the repetition simulation can sweep values without touching logic. */

export const OVERPASS = {
    mirrors: (import.meta.env?.VITE_OVERPASS_MIRRORS ||
        'https://overpass-api.de/api/interpreter,https://overpass.kumi.systems/api/interpreter,https://overpass.private.coffee/api/interpreter'
    ).split(',').map((s) => s.trim()).filter(Boolean),
    // Higher [timeout:N] makes Overpass reserve a bigger slot, which is
    // harder to schedule on a loaded server. 25 measurably succeeded where 45 did not.
    serverTimeoutSec: 25,
    // Just past the server's own deadline. Waiting 40s bought nothing: a tile
    // that has not answered by then is not going to, and meanwhile it occupies
    // one of only two concurrency slots and delays the user's first result.
    clientTimeoutMs: 27000,
    // The public instance allows 2 concurrent slots per IP. Measured: exceeding
    // it turns every in-flight tile into a 429.
    concurrency: 2,
    spacingMs: 300,
    // Fewer attempts up front. A tile that fails is recorded and retried on a
    // later visit, which costs nothing, whereas retrying now blocks first paint.
    maxAttemptsPerTile: 2,
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
    // Up to here the disc is swept exhaustively. Past it the tile count grows
    // with the square of the radius -- a 50km disc is ~540 tiles at z13, which
    // is hours of polite Overpass traffic -- so the far field is probed with a
    // bounded, evenly-fanned SAMPLE instead. See coveringTiles().
    fullCoverageKm: 15,
    // The far field is probed, not covered: each of `outerSectors` directions
    // gets one probe per `outerKmPerProbe` of extra reach, up to
    // `outerProbesPerSector`. Fewer sectors would let one direction swallow the
    // whole budget, which is the failure the sample exists to avoid.
    outerSectors: 12,
    outerKmPerProbe: 5,
    outerProbesPerSector: 6,
};

export const SEARCH = {
    minRadiusKm: 1,
    maxRadiusKm: 50,
    defaultRadiusKm: 5,
    minPoolToSpin: 12,
    /** Detents, not a linear 1..50 sweep.
     *
     *  A 50-position slider spends most of its travel on distinctions nobody
     *  makes (37km vs 38km) while the ones people do make (5 vs 10) sit a
     *  pixel apart. Steps are fine where the choice is real and coarse where
     *  it is not, which also keeps a drag from firing 50 re-sweeps. */
    radiusSteps: [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20, 25, 30, 40, 50],
};

/** Index of the detent closest to `km`. A radius restored from storage or from
 *  a share link need not be one of ours. */
export const nearestRadiusStep = (km) =>
    SEARCH.radiusSteps.reduce(
        (best, step, i) =>
            Math.abs(step - km) < Math.abs(SEARCH.radiusSteps[best] - km) ? i : best,
        0
    );

/** The next detent outward, for "search further out". */
export const widerRadius = (km) =>
    SEARCH.radiusSteps[Math.min(SEARCH.radiusSteps.length - 1, nearestRadiusStep(km) + 1)];

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

