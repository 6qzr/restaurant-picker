/**
 * Measures how often an OpenStreetMap place can be matched to a Google listing.
 *
 * This is the number the rebuild could never establish without a working key:
 * if it is low, most cards simply show no rating, which the app is designed to
 * handle -- but you want to know rather than guess.
 *
 * Costs one Text Search per sampled place. Keep the sample small.
 *
 *   node test/match-rate.mjs <apiKey> [sampleSize] [referer]
 */
import fs from 'node:fs';
import { bestMatch, scoreMatch } from '../src/engine/enrich/matcher.js';

const [, , apiKey, sizeArg, refererArg] = process.argv;
if (!apiKey) {
    console.error('usage: node test/match-rate.mjs <apiKey> [sampleSize] [referer]');
    process.exit(1);
}
const SAMPLE = Number(sizeArg ?? 30);
const REFERER = refererArg ?? 'https://restaurant-picker-cpkr.onrender.com/';

const places = JSON.parse(fs.readFileSync('test/fixtures/muscat-places.json', 'utf8'));

/** Deterministic spread across the pool rather than the first N, which would be
 *  one tile and therefore one neighbourhood. */
const step = Math.max(1, Math.floor(places.length / SAMPLE));
const sample = places.filter((_, i) => i % step === 0).slice(0, SAMPLE);

const search = async (place) => {
    const textQuery = [place.name, place.tags?.street, place.tags?.city].filter(Boolean).join(' ');
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Referer: REFERER,
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask':
                'places.id,places.displayName,places.location,places.rating,places.userRatingCount',
        },
        body: JSON.stringify({
            textQuery,
            locationBias: {
                circle: { center: { latitude: place.lat, longitude: place.lon }, radius: 120 },
            },
            maxResultCount: 3,
            languageCode: 'en',
        }),
    });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`${res.status} ${body.slice(0, 120)}`);
    }
    return (await res.json()).places ?? [];
};

const stats = { arab: { n: 0, hit: 0 }, latin: { n: 0, hit: 0 } };
const misses = [];
const hits = [];
let calls = 0;
let errors = 0;

console.log(`Sampling ${sample.length} of ${places.length} places\n`);

for (const place of sample) {
    const bucket = place.nameScript === 'arab' ? 'arab' : 'latin';
    stats[bucket].n++;
    try {
        const candidates = await search(place);
        calls++;
        const match = bestMatch(place, candidates);
        if (match) {
            stats[bucket].hit++;
            hits.push({ name: place.name, google: match.google.displayName?.text, score: match.match.score, rating: match.google.rating });
        } else {
            const best = candidates.length
                ? candidates.map((c) => scoreMatch(place, c)).sort((a, b) => b.score - a.score)[0]
                : null;
            misses.push({ name: place.name, script: bucket, candidates: candidates.length, bestScore: best?.score ?? 0, reason: best?.reason ?? 'no-candidates' });
        }
    } catch (err) {
        errors++;
        if (errors <= 2) console.error('  error:', err.message);
    }
    await new Promise((r) => setTimeout(r, 120));
}

const pct = (a, b) => (b ? ((a / b) * 100).toFixed(0) + '%' : 'n/a');
const total = stats.arab.n + stats.latin.n;
const totalHit = stats.arab.hit + stats.latin.hit;

console.log('=== MATCH RATE ===');
console.log(`  overall        ${totalHit}/${total}  ${pct(totalHit, total)}`);
console.log(`  latin names    ${stats.latin.hit}/${stats.latin.n}  ${pct(stats.latin.hit, stats.latin.n)}`);
console.log(`  arabic names   ${stats.arab.hit}/${stats.arab.n}  ${pct(stats.arab.hit, stats.arab.n)}`);
console.log(`  api calls      ${calls}   errors ${errors}`);

console.log('\n--- sample matches ---');
for (const h of hits.slice(0, 6)) {
    console.log(`  ${h.name}  ->  ${h.google}  (score ${h.score.toFixed(2)}, ${h.rating ?? 'no rating'})`);
}
console.log('\n--- sample misses ---');
for (const m of misses.slice(0, 8)) {
    console.log(`  ${m.name}  [${m.script}]  candidates=${m.candidates} best=${m.bestScore.toFixed(2)} ${m.reason}`);
}
