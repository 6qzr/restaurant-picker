import { Car, Armchair } from 'lucide-react';
import { CUISINE_CHIPS } from '../utils/cuisine.js';
import { TEMPERATURE_DETENTS } from '../engine/rank/sample.js';
import { SEARCH } from '../config.js';
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

export const RadiusDial = ({ radiusKm, onChange }) => (
    <DialRow label="Within" value={<Num>{radiusKm} km</Num>}>
        <input
            type="range"
            min={SEARCH.minRadiusKm}
            max={SEARCH.maxRadiusKm}
            step={1}
            value={radiusKm}
            onChange={(e) => onChange(Number(e.target.value))}
            className={RANGE_CLASS}
            aria-label={`Search radius, ${radiusKm} kilometres`}
        />
    </DialRow>
);

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

export const CuisineChips = ({ chips, onToggle }) => (
    <div className="flex gap-2 overflow-x-auto no-scrollbar py-0.5 -mx-1 px-1">
        {CUISINE_CHIPS.map((c) => {
            const on = chips.includes(c.id);
            return (
                <button
                    key={c.id}
                    type="button"
                    onClick={() => onToggle(c.id)}
                    aria-pressed={on}
                    className="btn shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border"
                    style={{
                        borderColor: on ? 'var(--ink)' : 'var(--line)',
                        background: on ? 'var(--ink)' : 'var(--surface)',
                        color: on ? 'var(--paper)' : 'var(--ink-2)',
                    }}
                >
                    <span aria-hidden="true">{c.icon}</span>
                    {c.label}
                </button>
            );
        })}
    </div>
);
