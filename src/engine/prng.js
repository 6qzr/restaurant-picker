/** Seeded randomness.
 *
 *  Everything downstream (Gumbel perturbation, shuffles, lane sampling) draws
 *  from here, so a spin is a pure function of its seed. That is what lets a
 *  share link reproduce the exact same board on a friend's phone.
 */

/** cyrb128: expands a seed string into four uint32s. */
export const cyrb128 = (str) => {
    let h1 = 1779033703;
    let h2 = 3144134277;
    let h3 = 1013904242;
    let h4 = 2773480762;
    for (let i = 0; i < str.length; i++) {
        const k = str.charCodeAt(i);
        h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
        h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
        h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
        h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    return [
        (h1 ^ h2 ^ h3 ^ h4) >>> 0,
        (h2 ^ h1) >>> 0,
        (h3 ^ h1) >>> 0,
        (h4 ^ h1) >>> 0,
    ];
};

/** sfc32: 128 bits of state, period >= 2^64, passes PractRand and BigCrush.
 *  Chosen over mulberry32, whose 32-bit state is measurably weak in higher
 *  dimensions -- and both are ten lines, so there is no reason to take the
 *  weaker one. */
export const sfc32 = (a, b, c, d) => {
    let A = a >>> 0;
    let B = b >>> 0;
    let C = c >>> 0;
    let D = d >>> 0;
    return () => {
        A |= 0; B |= 0; C |= 0; D |= 0;
        const t = (((A + B) | 0) + D) | 0;
        D = (D + 1) | 0;
        A = B ^ (B >>> 9);
        B = (C + (C << 3)) | 0;
        C = (C << 21) | (C >>> 11);
        C = (C + t) | 0;
        return (t >>> 0) / 4294967296;
    };
};

/** Build a generator from a seed string, warming the state first. */
export const makeRng = (seedString) => {
    const rng = sfc32(...cyrb128(String(seedString)));
    for (let i = 0; i < 12; i++) rng();
    return rng;
};

/** Standard Gumbel(0,1). The epsilon guard matters: u === 0 yields Infinity,
 *  which would silently pin one candidate to the top of every draw. */
export const gumbel = (rng) => {
    const u = rng() || Number.EPSILON;
    return -Math.log(-Math.log(u));
};

/** Pure Fisher-Yates. Returns a new array -- the in-place `sort(() => rnd-0.5)`
 *  it replaces was both biased and mutated the caller's pool. */
export const shuffled = (array, rng) => {
    const a = [...array];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
};

export const randomSeed = () => {
    const buf = new Uint32Array(1);
    if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(buf);
    else buf[0] = Math.floor(Math.random() * 2 ** 32);
    return buf[0] >>> 0;
};
