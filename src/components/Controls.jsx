import { Car, Armchair } from 'lucide-react';
import { CUISINE_CHIPS } from '../utils/cuisine.js';
import { TEMPERATURE_DETENTS } from '../engine/rank/sample.js';
import { SEARCH } from '../config.js';
import { Num } from './primitives/Bidi.jsx';

export const RadiusDial = ({ radiusKm, onChange }) => (
    <label className="flex items-center gap-3 w-full">
        <span className="meta shrink-0" style={{ color: 'var(--ink-3)' }}>Within</span>
        <input
            type="range"
            min={SEARCH.minRadiusKm}
            max={SEARCH.maxRadiusKm}
            step={1}
            value={radiusKm}
            onChange={(e) => onChange(Number(e.target.value))}
            className="flex-1 accent-[var(--gold)]"
            aria-label={`Search radius, ${radiusKm} kilometres`}
        />
        <Num className="text-sm font-semibold tabular-nums shrink-0 w-12 text-end">{radiusKm} km</Num>
    </label>
);

/** The dial that decides how far down the ranking the sampler is willing to
 *  reach. Labelled in plain language rather than as a temperature. */
export const SurpriseDial = ({ temperature, onChange }) => {
    const idx = TEMPERATURE_DETENTS.reduce(
        (best, d, i) => (Math.abs(d.value - temperature) < Math.abs(TEMPERATURE_DETENTS[best].value - temperature) ? i : best),
        0
    );
    return (
        <label className="flex items-center gap-3 w-full">
            <span className="meta shrink-0" style={{ color: 'var(--ink-3)' }}>Mood</span>
            <input
                type="range"
                min={0}
                max={TEMPERATURE_DETENTS.length - 1}
                step={1}
                value={idx}
                onChange={(e) => onChange(TEMPERATURE_DETENTS[Number(e.target.value)].value)}
                className="flex-1 accent-[var(--gold)]"
                aria-label={`Adventurousness: ${TEMPERATURE_DETENTS[idx].label}`}
            />
            <span className="text-sm font-semibold shrink-0 w-24 text-end">
                {TEMPERATURE_DETENTS[idx].label}
            </span>
        </label>
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
