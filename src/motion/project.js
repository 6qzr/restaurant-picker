/** Where a flick would come to rest.
 *
 *  This is the exponential-decay form used for scroll deceleration, not the
 *  textbook v^2/(2a): it is what makes a quick flick feel like it throws the
 *  card, and it is why the commit decision uses the PROJECTED position rather
 *  than wherever the finger happened to let go.
 */
export const project = (velocityPxPerSec, decelerationRate = 0.998) =>
    ((velocityPxPerSec / 1000) * decelerationRate) / (1 - decelerationRate);

/** Progressive resistance past a boundary: real things slow before they stop,
 *  and a hard stop reads as "frozen" rather than "there is nothing more here". */
export const rubberband = (overshoot, dimension, constant = 0.55) =>
    (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));

/** Least-squares slope over the recent samples. Far steadier than differencing
 *  the last two points, which is dominated by jitter at the moment of release. */
export const velocityFrom = (samples, windowMs = 80) => {
    if (samples.length < 2) return 0;
    const last = samples[samples.length - 1];
    const recent = samples.filter((s) => last.t - s.t <= windowMs);
    if (recent.length < 2) return 0;

    const n = recent.length;
    let sumT = 0;
    let sumX = 0;
    let sumTT = 0;
    let sumTX = 0;
    for (const s of recent) {
        const t = s.t - recent[0].t;
        sumT += t;
        sumX += s.x;
        sumTT += t * t;
        sumTX += t * s.x;
    }
    const denom = n * sumTT - sumT * sumT;
    if (!denom) return 0;
    return ((n * sumTX - sumT * sumX) / denom) * 1000; // px/s
};
