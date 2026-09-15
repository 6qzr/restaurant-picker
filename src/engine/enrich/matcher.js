/**
 * Match an OSM place to a Google place.
 *
 * The hard case in this dataset is script mismatch: OSM often has
 * "مطعم الجود اللبناني" where Google has "Al Jood Lebanese Restaurant".
 * String similarity across scripts is meaningless, so those fall back to a
 * strict proximity + category test instead of a name test.
 *
 * A rating attached to the WRONG restaurant is strictly worse than no rating,
 * so the acceptance threshold is deliberately conservative.
 */

const GENERIC_TOKENS = new Set([
    'restaurant', 'cafe', 'coffee', 'shop', 'the', 'and', 'bar', 'grill', 'house',
    'مطعم', 'مقهى', 'كافيه', 'كافي', 'ال',
]);

const ARABIC_RE = /[؀-ۿ]/;

/** NFKD + stripping combining marks removes Latin accents AND Arabic tashkeel
 *  in a single step; NFKC folds Arabic presentation forms. */
export const normalizeName = (raw = '') => {
    let s = String(raw).normalize('NFKC').normalize('NFKD');
    s = s.replace(/\p{M}+/gu, '');       // combining marks / tashkeel
    s = s.replace(/ـ/g, '');         // tatweel
    s = s.replace(/[أإآٱ]/g, 'ا'); // hamza forms -> alef
    s = s.replace(/ة/g, 'ه');   // teh marbuta -> heh
    s = s.replace(/ى/g, 'ي');   // alef maksura -> yeh
    s = s.toLowerCase();
    s = s.replace(/[^\p{L}\p{N}\s]/gu, ' ');
    s = s.replace(/\s+/g, ' ').trim();

    const tokens = s.split(' ').filter((t) => t && !GENERIC_TOKENS.has(t));
    return tokens.length ? tokens.join(' ') : s;
};

export const dominantScript = (s = '') => (ARABIC_RE.test(s) ? 'arab' : 'latin');

const bigrams = (s) => {
    const out = new Map();
    const t = ` ${s} `;
    for (let i = 0; i < t.length - 1; i++) {
        const g = t.slice(i, i + 2);
        out.set(g, (out.get(g) ?? 0) + 1);
    }
    return out;
};

/** Dice coefficient over character bigrams -- more forgiving than Levenshtein
 *  for reordered multi-word names ("Al Jood Lebanese" vs "Lebanese Al Jood"). */
export const diceSimilarity = (a, b) => {
    if (!a || !b) return 0;
    if (a === b) return 1;
    const A = bigrams(a);
    const B = bigrams(b);
    let inter = 0;
    let total = 0;
    for (const [, c] of A) total += c;
    for (const [, c] of B) total += c;
    for (const [g, c] of A) if (B.has(g)) inter += Math.min(c, B.get(g));
    return total ? (2 * inter) / total : 0;
};

/** Digits survive transliteration and are a useful cross-script tiebreaker. */
const numbersOf = (s) => (String(s).match(/\d+/g) ?? []).join(',');

const haversineM = (aLat, aLon, bLat, bLon) => {
    const R = 6371000;
    const d = Math.PI / 180;
    const dLat = (bLat - aLat) * d;
    const dLon = (bLon - aLon) * d;
    const x =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(aLat * d) * Math.cos(bLat * d) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
};

export const ACCEPT_THRESHOLD = 0.62;
const MAX_DISTANCE_M = 300;
const CROSS_SCRIPT_MAX_M = 26;

/**
 * @returns {{score:number, accepted:boolean, distanceM:number, reason:string}}
 */
export const scoreMatch = (osmPlace, googlePlace) => {
    const gLat = googlePlace.location?.latitude ?? googlePlace.lat;
    const gLon = googlePlace.location?.longitude ?? googlePlace.lon;
    const distanceM = haversineM(osmPlace.lat, osmPlace.lon, gLat, gLon);

    if (distanceM > MAX_DISTANCE_M) {
        return { score: 0, accepted: false, distanceM, reason: 'too-far' };
    }

    const gName = googlePlace.displayName?.text ?? googlePlace.displayName ?? '';
    const osmVariants = [osmPlace.name, ...(osmPlace.nameAlt ?? [])].filter(Boolean);

    const gNorm = normalizeName(gName);
    const gScript = dominantScript(gName);

    let nameSim = 0;
    let sameScriptPairFound = false;
    for (const v of osmVariants) {
        if (dominantScript(v) !== gScript) continue;
        sameScriptPairFound = true;
        nameSim = Math.max(nameSim, diceSimilarity(normalizeName(v), gNorm));
    }

    const proxScore = Math.exp(-distanceM / 90);
    const categoryAgree = 1; // Google types are coarse; proximity carries this.

    if (!sameScriptPairFound) {
        // Cross-script: names cannot be compared, so demand near-coincident
        // coordinates instead. Numbers are the one signal that survives.
        const numsMatch =
            numbersOf(osmPlace.name) &&
            numbersOf(osmPlace.name) === numbersOf(gName) ? 0.1 : 0;
        const accepted = distanceM <= CROSS_SCRIPT_MAX_M;
        return {
            score: accepted ? 0.65 + numsMatch : 0.3,
            accepted,
            distanceM,
            reason: accepted ? 'cross-script-proximity' : 'cross-script-too-far',
        };
    }

    const score = 0.55 * nameSim + 0.35 * proxScore + 0.1 * categoryAgree;
    return {
        score,
        accepted: score >= ACCEPT_THRESHOLD,
        distanceM,
        reason: score >= ACCEPT_THRESHOLD ? 'name+proximity' : 'low-confidence',
    };
};

/** Best candidate from a Text Search response, or null. */
export const bestMatch = (osmPlace, candidates = []) => {
    let best = null;
    for (const c of candidates) {
        const m = scoreMatch(osmPlace, c);
        if (!best || m.score > best.match.score) best = { google: c, match: m };
    }
    return best?.match.accepted ? best : null;
};
