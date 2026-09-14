import { SAMPLING } from '../../config.js';
import { gumbel } from '../prng.js';

/**
 * Gumbel-top-k.
 *
 * Adding a Gumbel(0,1) draw to each score/temperature and taking the top k is
 * an exact sample of k items, without replacement, from softmax(scores/tau) --
 * in a single O(n) pass, with no rejection loop and no order dependence. Under
 * a seeded PRNG it is fully deterministic, which is what the share link needs.
 */

/** Slider position [0,1] -> temperature. Log-scaled so the low end is finely
 *  controllable: at tau=0.02 a 0.25 score gap is 12.5 units against Gumbel
 *  noise (sigma ~ 1.28) and the pick is near-deterministic; at tau=0.5 that
 *  same gap is 0.5 units and noise dominates. */
export const temperatureFor = (slider) =>
    SAMPLING.tauMin * SAMPLING.tauSpan ** Math.max(0, Math.min(1, slider));

export const TEMPERATURE_DETENTS = [
    { label: 'Safe', value: 0.0 },
    { label: 'Familiar', value: 0.25 },
    { label: 'Balanced', value: 0.45 },
    { label: 'Adventurous', value: 0.7 },
    { label: 'Chaos', value: 1.0 },
];

/**
 * Keep "surprise" inside "plausible".
 *
 * Unconstrained sampling at a high temperature will happily surface a 2.1-star
 * petrol-station kebab. Losing the user's trust is a worse failure mode than
 * repetition, so candidates must stay within a band of the best available.
 */
export const plausible = (scored, floor = SAMPLING.plausibilityFloor ?? 0.55) => {
    if (!scored.length) return scored;
    const max = Math.max(...scored.map((s) => s.score));
    return scored.filter((s) => s.score >= max - floor);
};

/** Add the Gumbel perturbation once. Everything downstream is deterministic. */
export const perturb = (scored, tau, rng) =>
    scored.map((s) => ({ ...s, key: s.score / tau + gumbel(rng) }));

/** Top-k by perturbed key. */
export const topK = (perturbed, k) =>
    [...perturbed].sort((a, b) => b.key - a.key).slice(0, k);

export const gumbelTopK = (scored, k, tau, rng) => topK(perturb(scored, tau, rng), k);
