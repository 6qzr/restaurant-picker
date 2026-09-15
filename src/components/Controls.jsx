import { Car, Armchair } from 'lucide-react';
import { CUISINE_CHIPS } from '../utils/cuisine.js';
import { TEMPERATURE_DETENTS } from '../engine/rank/sample.js';
import { SEARCH, TILES, nearestRadiusStep } from '../config.js';
import { Num } from './primitives/Bidi.jsx';

/** Shared row so the two dials line up.
 *
 *  They previously set their own label and value widths ("Within" vs "Mood",
 *  w-12 vs w-24), so the flex-1 track between them came out a different length
 *  on each row and the thumbs sat at different offsets. Fixed columns at both
 *  ends keep the tracks identical, and sharing one component stops them
 *  drifting apart again.
 */
const DialRow = ({ label, value, children }) => (
    <label className="flex items-center gap-3 w-full">
        <span className="meta shrink-0 w-14" style={{ color: 'var(--ink-3)' }}>
            {label}
        </span>
        {children}
        <span className="text-sm font-semibold tabular-nums shrink-0 w-[5.5rem] text-end">
            {value}
        </span>
    </label>
);

const RANGE_CLASS = 'flex-1 min-w-0 accent-[var(--gold)]';

/** Detents rather than every whole kilometre.
 *
 *  Most of a 1-50 slider's travel goes on distinctions nobody makes (37km vs
 *  38km) while the ones people do make sit a pixel apart -- and each step
 *  restarts the sweep, so a coarse tail is cheaper as well as easier to hit. */
export const RadiusDial = ({ radiusKm, onChange }) => {
    const steps = SEARCH.radiusSteps;
    const idx = nearestRadiusStep(radiusKm);
    const sampled = radiusKm > TILES.fullCoverageKm;

    return (
        <div className="flex flex-col gap-1.5">
            <DialRow label="Within" value={<Num>{radiusKm} km</Num>}>
                <input
                    type="range"
                    min={0}
                    max={steps.length - 1}
                    step={1}
                    value={idx}
                    onChange={(e) => onChange(steps[Number(e.target.value)])}
                    className={RANGE_CLASS}
                    aria-label={`Search radius, ${radiusKm} kilometres`}
                />
            </DialRow>
            {/* Say what a wide search actually does. Past the covered disc we
                probe a fan of areas rather than every street, and a picker that
                quietly showed you a thin sample of somewhere as though it were
                the whole place would be the same lie as the old header. */}
            {sampled && (
                <p className="text-xs ps-[4.25rem]" style={{ color: 'var(--ink-3)' }}>
                    Past <Num>{TILES.fullCoverageKm} km</Num> we check a spread of areas in every
                    direction rather than every street, so far-out picks are a sample. The first
                    wide search takes a few minutes; you can spin while it runs.
                </p>
            )}
        </div>
    );
};

/** The dial that decides how far down the ranking the sampler is willing to
 *  reach. Labelled in plain language rather than as a temperature. */
export const SurpriseDial = ({ temperature, onChange }) => {
    const idx = TEMPERATURE_DETENTS.reduce(
        (best, d, i) =>
            Math.abs(d.value - temperature) < Math.abs(TEMPERATURE_DETENTS[best].value - temperature)
                ? i
                : best,
        0
    );
    return (
        <DialRow label="Mood" value={TEMPERATURE_DETENTS[idx].label}>
            <input
                type="range"
                min={0}
                max={TEMPERATURE_DETENTS.length - 1}
                step={1}
                value={idx}
                onChange={(e) => onChange(TEMPERATURE_DETENTS[Number(e.target.value)].value)}
                className={RANGE_CLASS}
                aria-label={`Adventurousness: ${TEMPERATURE_DETENTS[idx].label}`}
            />
        </DialRow>
    );
};

export const ModeToggle = ({ adventure, onChange }) => (
    <button
        type="button"
        onClick={() => onChange(!adventure)}
        aria-pressed={adventure}
        className="btn inline-flex items-center gap-2 px-3 py-1.5 text-sm border"
        style={{
            borderColor: adventure ? 'var(--gold)' : 'var(--line)',
            background: adventure ? 'var(--gold-soft)' : 'var(--surface)',
            color: adventure ? 'var(--gold)' : 'var(--ink-2)',
        }}
    >
        {adventure ? <Car className="w-4 h-4" /> : <Armchair className="w-4 h-4" />}
        {adventure ? 'Worth the drive' : 'Stay close'}
    </button>
);

export const CuisineChips = ({ chips, onToggle, counts = {} }) => (
    <div className="flex gap-2 overflow-x-auto no-scrollbar py-0.5 -mx-1 px-1">
        {CUISINE_CHIPS.map((c) => {
            const on = chips.includes(c.id);
            const n = counts[c.id];
            // A chip with nothing behind it empties the board, which reads as a
            // fault rather than as a filter. Show the count and refuse the tap.
            const empty = n === 0;
            return (
                <button
                    key={c.id}
                    type="button"
                    onClick={() => !empty && onToggle(c.id)}
                    disabled={empty}
                    aria-pressed={on}
                    title={empty ? `No ${c.label.toLowerCase()} places found nearby` : undefined}
                    className="btn shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                        borderColor: on ? 'var(--ink)' : 'var(--line)',
                        background: on ? 'var(--ink)' : 'var(--surface)',
                        color: on ? 'var(--paper)' : 'var(--ink-2)',
                    }}
                >
                    <span aria-hidden="true">{c.icon}</span>
                    {c.label}
                    {n != null && (
                        <Num className="tabular-nums opacity-55">{n}</Num>
                    )}
                </button>
            );
        })}
    </div>
);
