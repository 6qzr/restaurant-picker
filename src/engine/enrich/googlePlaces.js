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
    constructor(code, hint, { status, googleStatus, docsUrl } = {}) {
        super(hint);
        this.name = 'EnrichmentError';
        this.code = code;
        this.hint = hint;
        this.status = status;
        this.googleStatus = googleStatus;
        this.docsUrl = docsUrl;
    }
}

const ENABLE_URL = 'https://console.cloud.google.com/apis/library/places.googleapis.com';

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

    if (reason === 'API_KEY_INVALID' || /API key not valid/i.test(msg)) {
        return new EnrichmentError('invalid-key', 'That API key is not valid.', { status, googleStatus: gStatus });
    }
    if (reason === 'SERVICE_DISABLED' || /has not been used in project|is disabled/i.test(msg)) {
        return new EnrichmentError(
            'not-enabled',
            'Places API (New) is not enabled on your Google Cloud project. It is a separate service from the older "Places API".',
            { status, googleStatus: gStatus, docsUrl: ENABLE_URL }
        );
    }
    if (reason === 'API_KEY_HTTP_REFERRER_BLOCKED' || /referer|referrer/i.test(msg)) {
        return new EnrichmentError(
            'referrer-blocked',
            `This key is restricted to a different site. Add ${globalThis.location?.origin ?? 'this site'}/* to its allowed HTTP referrers.`,
            { status, googleStatus: gStatus }
        );
    }
    if (reason === 'BILLING_DISABLED' || /billing/i.test(msg)) {
        return new EnrichmentError('billing', 'Billing is not enabled on this Google Cloud project.', { status, googleStatus: gStatus });
    }
    if (status === 429 || gStatus === 'RESOURCE_EXHAUSTED') {
        return new QuotaError('Google Places quota exhausted');
    }
    if (status === 403) {
        return new EnrichmentError('forbidden', msg || 'Google refused this request.', { status, googleStatus: gStatus });
    }
    return new EnrichmentError('error', msg || `Google Places returned ${status}.`, { status, googleStatus: gStatus });
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
