/** Before/after repetition report. No network, no Google quota. */
import fs from 'node:fs';
import {
    runNewEngine, runOldEngine, measure, synthEnrichments,
} from '../src/engine/rank/__sim__/repetition.sim.js';

const FIXTURE = 'test/fixtures/muscat-places.json';
if (!fs.existsSync(FIXTURE)) {
    console.error(`Missing ${FIXTURE}. Run: node test/sweep-live.mjs`);
    process.exit(1);
}

const places = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
const origin = { lat: 23.588, lon: 58.3829 };
const radiusKm = 5;
const DAYS = 60;
const enrichments = synthEnrichments(places);

console.log(`Pool: ${places.length} places | ${DAYS} days x 1 spin | radius ${radiusKm}km\n`);

const TARGETS = { uniquePct: 55, meanGapDays: 14, maxAppearances: 5, cuisineCollisionPct: 2 };
const row = (label, m, showVerdict = true) => {
    const v = (ok) => (showVerdict ? (ok ? '  PASS' : '  FAIL') : '');
    console.log(
        label.padEnd(30) +
        String(m.unique).padStart(7) +
        (m.uniquePct.toFixed(0) + '%').padStart(7) +
        (m.meanGapDays === Infinity ? 'never' : m.meanGapDays.toFixed(1)).padStart(9) +
        String(m.maxAppearances).padStart(7) +
        (m.cuisineCollisionPct.toFixed(0) + '%').padStart(8) +
        v(m.uniquePct >= TARGETS.uniquePct && m.meanGapDays >= TARGETS.meanGapDays &&
          m.maxAppearances <= TARGETS.maxAppearances && m.cuisineCollisionPct < TARGETS.cuisineCollisionPct)
    );
};

console.log('configuration'.padEnd(30) + 'unique'.padStart(7) + 'of180'.padStart(7) +
            'gap(d)'.padStart(9) + 'maxAp'.padStart(7) + 'sameCu'.padStart(8));
console.log('-'.repeat(76));

const oldBoards = runOldEngine(places, { origin, radiusKm, days: DAYS, enrichments });
const oldM = measure(oldBoards, places);
row('OLD (20-place cap + old algo)', oldM);

const oldFull = runOldEngine(places, { origin, radiusKm, days: DAYS, enrichments, universeCap: places.length });
row('old algo, full pool', measure(oldFull, places));

console.log('-'.repeat(76));
for (const [label, t] of [['NEW  safe (0.0)', 0.0], ['NEW  balanced (0.45)', 0.45], ['NEW  chaos (1.0)', 1.0]]) {
    row(label, measure(runNewEngine(places, { origin, radiusKm, temperature: t, days: DAYS, enrichments }), places));
}

console.log('-'.repeat(76));
console.log(`targets: unique >= ${TARGETS.uniquePct}%   gap >= ${TARGETS.meanGapDays}d   maxAppearances <= ${TARGETS.maxAppearances}   sameCuisine < ${TARGETS.cuisineCollisionPct}%`);

const newM = measure(runNewEngine(places, { origin, radiusKm, temperature: 0.45, days: DAYS, enrichments }), places);
console.log(`\nHEADLINE: ${oldM.unique} unique places -> ${newM.unique} (${(newM.unique / Math.max(oldM.unique, 1)).toFixed(1)}x) over ${DAYS} days`);
