import { bestMatch } from './matcher.js';
import { recordCall } from '../../data/budgetRepo.js';

/** Places API (New) over REST.
 *
 *  Verified: the endpoint answers CORS preflight for a browser origin and
 *  allows the x-goog-api-key and x-goog-fieldmask headers, so the entire Maps
 *  JS SDK -- and the hidden <Map> that only existed to obtain a map instance
 *  the search never used -- is gone.
 */

const BASE = 'https://places.googleapis.com/v1';

/** The `rating` field moves a request to the most expensive SKU tier, so it is
 *  a user-controlled toggle rather than an unconditional cost. */
const FIELDS_WITH_RATINGS = [
    'id', 'displayName', 'location', 'rating', 'userRatingCount', 'priceLevel',
    'photos', 'currentOpeningHours.openNow',
];
const FIELDS_NO_RATINGS = ['id', 'displayName', 'location', 'photos'];

const fieldMask = (withRatings, prefix = '') =>
    (withRatings ? FIELDS_WITH_RATINGS : FIELDS_NO_RATINGS).map((f) => prefix + f).join(',');

export class QuotaError extends Error {}

/** A Google rejection we can explain to the user.
 *
 *  `code` is a stable slug the UI switches on; `hint` is the sentence shown to
 *  the user; `docsUrl` is where they go to fix it.
 */
export class EnrichmentError extends Error {
    constructor(code, hint, { status, googleStatus, docsUrl, googleMessage } = {}) {
        super(hint);
        this.name = 'EnrichmentError';
        this.code = code;
        this.hint = hint;
        this.status = status;
        this.googleStatus = googleStatus;
        this.docsUrl = docsUrl;
        // Google's own wording, kept so a failure on a device we cannot inspect
        // can still be reported back verbatim.
        this.googleMessage = googleMessage;
    }
}

const ENABLE_URL = 'https://console.cloud.google.com/apis/library/places.googleapis.com';
const CREDENTIALS_URL = 'https://console.cloud.google.com/apis/credentials';

/** Turn Google's error payload into something actionable.
 *
 *  This matters more than it looks: "Places API (New)" is a SEPARATE service
 *  from the legacy "Places API", so a project set up for the old Maps
 *  JavaScript stack rejects every call here with SERVICE_DISABLED -- and
 *  because the call never reaches an enabled API, it shows up as zero traffic
 *  in the Cloud console, which looks like the app never tried.
 */
export const classifyError = (status, payload) => {
    const err = payload?.error ?? {};
    const msg = String(err.message ?? '');
    const gStatus = err.status ?? '';
    const reason = err.details?.find((d) => d.reason)?.reason ?? '';
    const raw = { status, googleStatus: gStatus, googleMessage: msg };

    if (reason === 'API_KEY_INVALID' || /API key not valid/i.test(msg)) {
        return new EnrichmentError(
            'invalid-key',
            'Google rejected that key. Check it was copied in full, and that it belongs to the project where Places API (New) is enabled.',
            { ...raw }
        );
    }
    // Distinct from SERVICE_DISABLED: here the API may well be enabled on the
    // project, but THIS KEY's "API restrictions" list does not include it. Seen
    // in the wild on a key originally scoped to the Maps JavaScript API.
    if (reason === 'API_KEY_SERVICE_BLOCKED' || /Requests to this API .* are blocked/i.test(msg)) {
        return new EnrichmentError(
            'key-restricted',
            'This key is not allowed to call Places API (New). Open the key in Google Cloud, and under "API restrictions" add Places API (New) to the allowed list.',
            { ...raw, docsUrl: CREDENTIALS_URL }
        );
    }
    if (reason === 'SERVICE_DISABLED' || /has not been used in project|is disabled/i.test(msg)) {
        return new EnrichmentError(
            'not-enabled',
            'Places API (New) is not enabled on your Google Cloud project. It is a separate service from the older "Places API".',
            { ...raw, docsUrl: ENABLE_URL }
        );
    }
    if (reason === 'API_KEY_HTTP_REFERRER_BLOCKED' || /referer|referrer/i.test(msg)) {
        return new EnrichmentError(
            'referrer-blocked',
            // Always the site the user is actually on, never a hardcoded dev URL.
            globalThis.location?.origin
                ? `This key is restricted to a different site. Add ${globalThis.location.origin}/* to its allowed HTTP referrers.`
                : 'This key is restricted to a different site. Add this site’s address to its allowed HTTP referrers.',
            { ...raw }
        );
    }
    if (reason === 'BILLING_DISABLED' || /billing/i.test(msg)) {
        return new EnrichmentError('billing', 'Billing is not enabled on this Google Cloud project.', { ...raw });
    }
    if (status === 429 || gStatus === 'RESOURCE_EXHAUSTED') {
        return new QuotaError('Google Places quota exhausted');
    }
    if (status === 403) {
        return new EnrichmentError('forbidden', msg || 'Google refused this request.', { ...raw });
    }
    return new EnrichmentError('error', msg || `Google Places returned ${status}.`, { ...raw });
};

const request = async (url, { apiKey, mask, method = 'GET', body, signal }) => {
    const res = await fetch(url, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': mask,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal,
    });

    if (!res.ok) {
        // Read the body before throwing: Google puts the actual reason in there,
        // and without it every failure looks identical to the user.
        let payload = null;
        try {
            payload = await res.json();
        } catch {
            /* non-JSON error page */
        }
        throw classifyError(res.status, payload);
    }
    return res.json();
};

export const photoUrl = (photoName, apiKey, maxWidth = 640) =>
    photoName
        ? `${BASE}/${photoName}/media?maxWidthPx=${maxWidth}&key=${encodeURIComponent(apiKey)}&skipHttpRedirect=false`
        : null;

const toEnrichment = (g, apiKey) => ({
    googlePlaceId: g.id,
    rating: g.rating,
    userRatingCount: g.userRatingCount,
    priceLevel: g.priceLevel,
    openNow: g.currentOpeningHours?.openNow,
    photoUrl: photoUrl(g.photos?.[0]?.name, apiKey),
    displayName: g.displayName?.text,
});

/** Exact lookup once we know the Place ID. Cheaper and with no matching risk. */
export const fetchDetails = async (googlePlaceId, { apiKey, withRatings, signal }) => {
    const json = await request(`${BASE}/places/${googlePlaceId}`, {
        apiKey,
        mask: fieldMask(withRatings),
        signal,
    });
    await recordCall('placeDetails');
    return toEnrichment(json, apiKey);
};

/** First-time resolution. Text Search is the only endpoint that can target a
 *  name, and unlike Nearby Search it supports pagination if ever needed. */
export const resolveByText = async (place, { apiKey, withRatings, signal, languageCode }) => {
    const textQuery = [place.name, place.tags?.street, place.tags?.city]
        .filter(Boolean)
        .join(' ');

    const json = await request(`${BASE}/places:searchText`, {
        apiKey,
        method: 'POST',
        mask: fieldMask(withRatings, 'places.'),
        signal,
        body: {
            textQuery,
            // Measured both ways over 45 real responses: a hard
            // locationRestriction box (350m and 800m alike) matched FEWER
            // places than this soft bias, because the matcher already rejects
            // distant results on its own and the box occasionally excluded a
            // valid one. Bias stays.
            locationBias: {
                circle: { center: { latitude: place.lat, longitude: place.lon }, radius: 120 },
            },
            maxResultCount: 3,
            ...(languageCode ? { languageCode } : {}),
        },
    });
    await recordCall('textSearch');

    const match = bestMatch(place, json.places ?? []);
    if (!match) return null;
    return { enrichment: toEnrichment(match.google, apiKey), confidence: match.match.score };
};

/**
 * One deliberate round-trip to Google, to answer "why am I not seeing ratings?"
 *
 * Worth its own function because the normal enrichment path is fire-and-forget
 * and swallows failures by design -- the board must never break because a
 * rating did not arrive. That is right for the happy path and useless for
 * diagnosis, so this asks the question directly and reports the answer.
 *
 * Deliberately uses the cheapest possible field mask: this is a diagnostic, not
 * a lookup, and it should never land on an expensive SKU.
 */
/** Google API keys are 39 characters and begin with "AIza".
 *
 *  Checking locally first turns the most common real-world failure -- a paste
 *  that dropped characters, or a mobile keyboard that autocorrected one -- from
 *  an opaque "not valid" from Google into a specific, self-evident message.
 */
/** Repair the substitutions an iOS keyboard makes without being asked.
 *
 *  Smart punctuation rewrites hyphens as en/em dashes and inserts non-breaking
 *  spaces, and it applies as you TYPE -- so entering the key character by
 *  character does not avoid it. A key containing one en-dash is rejected by
 *  Google outright, and looks completely correct on screen.
 */
export const sanitizeKey = (key = '') =>
    String(key)
        .normalize('NFKC')
        // Every hyphen-like glyph an iOS keyboard may substitute -> plain hyphen.
        .replace(/[\u2010-\u2015\u2212]/g, '-')
        // Strip everything invisible. \p{Cf} is the decisive one: a keyboard with
        // Arabic enabled inserts directional marks (LRM, RLM, the Arabic letter
        // mark, the isolate characters) when RTL and LTR text meet, and one of
        // those in front of a key makes it fail a startsWith('AIza') check while
        // looking perfectly correct on screen. \p{Cc} covers stray control
        // characters, and \s the ordinary and non-breaking spaces.
        .replace(/[\s\p{Cf}\p{Cc}]+/gu, '')
        .trim();

export const inspectKeyShape = (key = '') => {
    const trimmed = sanitizeKey(key);
    if (!trimmed) return { ok: false, reason: 'empty' };
    if (!trimmed.startsWith('AIza')) {
        // Report what it actually begins with. sanitizeKey has already removed
        // anything invisible, so what survives here is a VISIBLE character that
        // simply is not the right one -- a stray letter, or a character from
        // another script. Rendering non-ASCII as its code point keeps the
        // message meaningful when that character has no obvious glyph.
        return {
            ok: false,
            reason: 'prefix',
            startsWith: [...trimmed]
                .slice(0, 4)
                .map((c) => (/[ -~]/.test(c) ? c : `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`))
                .join(''),
        };
    }
    if (trimmed.length !== 39) return { ok: false, reason: 'length', length: trimmed.length };
    if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) return { ok: false, reason: 'charset' };
    return { ok: true, length: trimmed.length };
};

/** Capital I and lowercase L are near-identical in most UI typefaces, so
 *  "begins with AIza" is unreadable as guidance -- it cannot be used to spot
 *  that you typed the other one. Name the character, do not just show it. */
const prefixHint = (actual = '') => {
    const spelled = 'capital A, capital i, lowercase z, lowercase a';
    const base = `A Google API key begins with "AIza" -- ${spelled}. This one begins with "${actual}".`;

    // Name the character they actually typed. Saying "lowercase L" to someone
    // who typed a digit sends them looking for a mistake that is not there.
    const lookalike = { l: 'a lowercase L', 1: 'a digit one', '|': 'a pipe' }[actual[1]];
    return lookalike
        ? `${base} The second character is ${lookalike}, where the key needs a capital i.`
        : base;
};

/** Only the reasons that reach the fallback branch in testConnection.
 *  'length' and 'prefix' build their own messages from the shape detail. */
const SHAPE_HINTS = {
    empty: 'No API key is set.',
    charset: 'That key contains characters a Google API key never has. It may have been autocorrected; try pasting it again.',
};

export const testConnection = async (apiKey, { signal } = {}) => {
    const key = sanitizeKey(apiKey);
    const shape = inspectKeyShape(key);
    if (!shape.ok) {
        const hint =
            shape.reason === 'length'
                ? `That key is ${shape.length} characters; a Google API key is 39. It looks like the paste was cut short.`
                : shape.reason === 'prefix'
                  ? prefixHint(shape.startsWith)
                  : SHAPE_HINTS[shape.reason];
        return { ok: false, code: shape.reason === 'empty' ? 'no-key' : 'bad-key-shape', hint };
    }
    try {
        await request(`${BASE}/places:searchText`, {
            apiKey: key,
            method: 'POST',
            mask: 'places.id',
            signal,
            body: { textQuery: 'cafe', maxResultCount: 1 },
        });
        return { ok: true, code: 'ok', hint: 'Your key works. Ratings and photos will load.' };
    } catch (err) {
        if (err?.name === 'AbortError') return { ok: false, code: 'aborted', hint: 'Cancelled.' };
        if (err instanceof QuotaError) {
            return { ok: false, code: 'quota', hint: 'Quota exhausted for this key.' };
        }
        if (err instanceof EnrichmentError) {
            return {
                ok: false,
                code: err.code,
                hint: err.hint,
                docsUrl: err.docsUrl,
                googleStatus: err.googleStatus,
                detail: err.googleMessage,
            };
        }
        // fetch() rejects with a TypeError and no status when the request never
        // reaches Google at all -- offline, DNS, or a blocking extension.
        return {
            ok: false,
            code: 'network',
            hint: 'The request never reached Google. Check your connection, or an ad/privacy blocker.',
        };
    }
};
