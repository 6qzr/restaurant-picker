/** Live smoke test for the discovery engine. Touches Overpass only -- never Google.
 *  Usage: node test/sweep-live.mjs [lat] [lon] [radiusKm] */
import 'fake-indexeddb/auto';
import fs from 'node:fs';
import { createSweep } from '../src/engine/discovery/sweep.js';
import { getPlacesByTiles } from '../src/data/placesRepo.js';
import { coveringTiles } from '../src/engine/discovery/tiles.js';
import { mirrorHealth } from '../src/engine/discovery/overpass.js';

const lat = Number(process.argv[2] ?? 23.588);
const lon = Number(process.argv[3] ?? 58.3829);
const radiusKm = Number(process.argv[4] ?? 5);

const tiles = coveringTiles(lat, lon, radiusKm);
console.log(`Sweeping ${tiles.length} tiles @ ${radiusKm}km around ${lat},${lon}`);

let batches = 0;
let lastProgress = 0;
const sweep = createSweep({
    onBatch: (places, meta) => {
        if (places.length) batches++;
        if (meta.done) console.log('  [done]');
    },
    onProgress: (p) => {
        if (Date.now() - lastProgress < 2500 && p.phase !== 'ready') return;
        lastProgress = Date.now();
        console.log(`  ${p.phase} ${p.fetched}/${p.toFetch} tiles | pool ${p.poolSize}`);
    },
});

const t0 = Date.now();
const cold = await sweep.start({ lat, lon }, radiusKm);
const coldMs = Date.now() - t0;

const t1 = Date.now();
const warmPlaces = await getPlacesByTiles(tiles.map((t) => t.id));
const warmMs = Date.now() - t1;

console.log('');
console.log('=== PHASE 2 GATE ===');
console.log(`cold sweep       : ${(coldMs / 1000).toFixed(1)}s   (target < 12s for a warm cache, cold is network-bound)`);
console.log(`warm read        : ${warmMs}ms   (target < 150ms)`);
console.log(`tiles ok/failed  : ${cold.tilesFetched}/${cold.tilesFailed}`);
console.log(`UNIQUE PLACES    : ${warmPlaces.length}   (target >= 300)`);
console.log(`incremental batches: ${batches}`);

const byCat = {};
for (const p of warmPlaces) byCat[p.category] = (byCat[p.category] || 0) + 1;
console.log('by category      :', JSON.stringify(byCat));
console.log('with cuisine tag :', warmPlaces.filter((p) => p.cuisines.length).length);
console.log('chains           :', warmPlaces.filter((p) => p.isChain).length);
console.log('arabic names     :', warmPlaces.filter((p) => p.nameScript === 'arab').length);
console.log('mirror health    :', JSON.stringify(mirrorHealth.snapshot()));

if (warmPlaces.length) {
    fs.mkdirSync('test/fixtures', { recursive: true });
    fs.writeFileSync('test/fixtures/muscat-places.json', JSON.stringify(warmPlaces));
    console.log(`\nfixture saved: test/fixtures/muscat-places.json (${warmPlaces.length} places)`);
    console.log('\nsample:');
    for (const p of warmPlaces.slice(0, 10)) {
        console.log(`  * ${p.name}  |  ${p.category}  |  ${p.cuisines.join(',') || '-'}`);
    }
}
