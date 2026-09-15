/**
 * Tune the matcher against real Google responses without paying per iteration.
 *
 * Pass 1 fetches candidates for a sample and caches them to disk. Every later
 * run scores variants against that cache, so threshold changes can be evaluated
 * offline instead of costing an API call each time.
 *
 *   node test/match-tune.mjs fetch <apiKey> [size] [referer]   # one-time, costs calls
 *   node test/match-tune.mjs score                             # free, repeatable
 */
import fs from 'node:fs';
import { scoreMatch } from '../src/engine/enrich/matcher.js';

const CACHE = 'test/fixtures/google-candidates.json';
const [, , mode, apiKey, sizeArg, refererArg] = process.argv;

const haversineM = (aLat, aLon, bLat, bLon) => {
    const R = 6371000;
    const d = Math.PI / 180;
    const dLat = (bLat - aLat) * d;
    const dLon = (bLon - aLon) * d;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * d) * Math.cos(bLat * d) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
};

if (mode === 'fetch') {
    if (!apiKey) {
        console.error('usage: node test/match-tune.mjs fetch <apiKey> [size] [referer]');
        process.exit(1);
    }
    const size = Number(sizeArg ?? 40);
    const referer = refererArg ?? 'https://restaurant-picker-cpkr.onrender.com/';
    const places = JSON.parse(fs.readFileSync('test/fixtures/muscat-places.json', 'utf8'));
    const step = Math.max(1, Math.floor(places.length / size));
    const sample = places.filter((_, i) => i % step === 0).slice(0, size);

    const out = [];
    for (const p of sample) {
        const textQuery = [p.name, p.tags?.street, p.tags?.city].filter(Boolean).join(' ');
        const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Referer: referer,
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.rating',
            },
            body: JSON.stringify({
                textQuery,
                locationBias: { circle: { center: { latitude: p.lat, longitude: p.lon }, radius: 120 } },
                maxResultCount: 3,
                languageCode: 'en',
            }),
        });
        const candidates = res.ok ? ((await res.json()).places ?? []) : [];
        out.push({ place: p, candidates });
        process.stdout.write('.');
        await new Promise((r) => setTimeout(r, 120));
    }
    fs.writeFileSync(CACHE, JSON.stringify(out));
    console.log(`\ncached ${out.length} responses -> ${CACHE}`);
    process.exit(0);
}

// --- scoring pass, free and repeatable ---
if (!fs.existsSync(CACHE)) {
    console.error(`no cache at ${CACHE}; run the fetch pass first`);
    process.exit(1);
}
const rows = JSON.parse(fs.readFileSync(CACHE, 'utf8'));

let hit = 0;
const byScript = { arab: { n: 0, hit: 0 }, latin: { n: 0, hit: 0 } };
const nearMisses = [];

for (const { place, candidates } of rows) {
    const bucket = place.nameScript === 'arab' ? 'arab' : 'latin';
    byScript[bucket].n++;

    let best = null;
    for (const c of candidates) {
        const m = scoreMatch(place, c);
        if (!best || m.score > best.m.score) best = { c, m };
    }

    if (best?.m.accepted) {
        hit++;
        byScript[bucket].hit++;
    } else if (best) {
        const d = haversineM(place.lat, place.lon, best.c.location.latitude, best.c.location.longitude);
        nearMisses.push({
            osm: place.name,
            google: best.c.displayName?.text ?? '',
            score: best.m.score,
            distM: Math.round(d),
            reason: best.m.reason,
        });
    }
}

const pct = (a, b) => (b ? ((a / b) * 100).toFixed(0) + '%' : 'n/a');
console.log(`overall ${hit}/${rows.length}  ${pct(hit, rows.length)}`);
console.log(`  latin  ${byScript.latin.hit}/${byScript.latin.n}  ${pct(byScript.latin.hit, byScript.latin.n)}`);
console.log(`  arabic ${byScript.arab.hit}/${byScript.arab.n}  ${pct(byScript.arab.hit, byScript.arab.n)}`);

// The interesting ones: rejected despite being physically on top of the target.
const closeRejects = nearMisses.filter((m) => m.distM <= 60).sort((a, b) => a.distM - b.distM);
if (closeRejects.length) {
    console.log('\nrejected despite being within 60m (likely the same place):');
    for (const m of closeRejects) {
        console.log(`  ${String(m.distM + 'm').padEnd(6)} ${m.osm.slice(0, 28).padEnd(30)} -> ${m.google.slice(0, 34).padEnd(36)} score ${m.score.toFixed(2)} ${m.reason}`);
    }
}
