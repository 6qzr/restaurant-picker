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
    if (res.status === 429 || res.status === 403) {
        throw new QuotaError(`Google Places ${res.status}`);
    }
    if (!res.ok) throw new Error(`Google Places ${res.status}`);
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
