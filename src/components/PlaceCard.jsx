import { Star, Navigation, RefreshCw, X, ThumbsUp, ThumbsDown, Clock, ShoppingBag, Sun } from 'lucide-react';
import { Bidi, Num } from './primitives/Bidi.jsx';
import { cuisineLabel } from '../utils/cuisine.js';
import {
    formatDistance, formatCount, formatRating, travelEstimate, gradientFor, glyphFor, readableHours,
} from '../utils/format.js';

const LANE_TINT = {
    safeBet: 'var(--gold)',
    somethingNew: 'var(--accent)',
    longShot: '#6d6096',
};

/**
 * The card's presentation. Two variants -- enriched and not -- rather than an
 * enriched card with holes in it: when there is no Google rating, nothing
 * renders a rating-shaped empty box.
 */
export const PlaceCard = ({ slot, enrichment, onVote, userVote, onSwap, onVeto, onChoose, dragging }) => {
    const { place, label, blurb, lane, metrics } = slot;
    if (!place) return null;

    const tint = LANE_TINT[lane] ?? 'var(--gold)';
    const rating = enrichment?.rating;
    const travel = travelEstimate(metrics?.distKm);
    const hours = readableHours(place.tags?.opening_hours);

    // No Place ID required, so this works with no Google key at all.
    const mapHref = `https://www.google.com/maps/search/?api=1&query=${place.lat}%2C${place.lon}`;

    return (
        <article className="card flex flex-col overflow-hidden h-full select-none">
            <div
                className="relative h-40 shrink-0"
                style={{ background: gradientFor(place.name) }}
            >
                {enrichment?.photoUrl ? (
                    <img
                        src={enrichment.photoUrl}
                        alt=""
                        loading="lazy"
                        draggable={false}
                        className="absolute inset-0 w-full h-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                ) : (
                    <div className="absolute inset-0 grid place-items-center text-5xl opacity-80" aria-hidden="true">
                        {glyphFor(place)}
                    </div>
                )}

                <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/35 to-transparent" />

                <span
                    className="meta absolute top-3 start-3 px-2.5 py-1 rounded-full text-white"
                    style={{ background: tint }}
                >
                    {label}
                </span>

                <div className="absolute top-2.5 end-2.5 flex gap-1.5">
                    <button
                        type="button"
                        onClick={onSwap}
                        aria-label={`Show a different ${label}`}
                        className="btn grid place-items-center w-8 h-8 bg-black/35 text-white hover:bg-black/55"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={onVeto}
                        aria-label={`Never show ${place.name} again`}
                        className="btn grid place-items-center w-8 h-8 bg-black/35 text-white hover:bg-[var(--danger)]"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {rating != null && (
                    <div className="absolute bottom-2.5 start-3 flex items-center gap-1 text-white">
                        <Star className="w-3.5 h-3.5 fill-current" style={{ color: '#f2c14e' }} />
                        <Num className="font-semibold text-sm">{formatRating(rating)}</Num>
                        {enrichment.userRatingCount != null && (
                            <Num className="text-xs opacity-85">({formatCount(enrichment.userRatingCount)})</Num>
                        )}
                    </div>
                )}
            </div>

            <div className="flex-1 flex flex-col p-4 gap-2">
                <p className="meta" style={{ color: tint }}>{blurb}</p>

                <Bidi as="h3" className="display truncate">{place.name}</Bidi>

                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem]" style={{ color: 'var(--ink-2)' }}>
                    {metrics?.distKm != null && (
                        <Num className="font-medium">{formatDistance(metrics.distKm)}</Num>
                    )}
                    {travel && (
                        <span style={{ color: 'var(--ink-3)' }}>
                            <Num>{travel.mins}</Num> min {travel.mode}
                        </span>
                    )}
                </div>

                <div className="flex flex-wrap gap-1.5 mt-0.5">
                    {place.cuisines.slice(0, 3).map((c) => (
                        <span
                            key={c}
                            className="text-[0.6875rem] px-2 py-0.5 rounded-full"
                            style={{ background: 'var(--surface-2)', color: 'var(--ink-2)', border: '1px solid var(--line)' }}
                        >
                            <Bidi>{cuisineLabel(c)}</Bidi>
                        </span>
                    ))}
                </div>

                {/* Facts that come from OSM, so they survive with no API key. */}
                {(hours || place.tags?.takeaway === 'yes' || place.tags?.outdoor_seating === 'yes') && (
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[0.75rem]" style={{ color: 'var(--ink-3)' }}>
                        {hours && (
                            <span className="inline-flex items-center gap-1">
                                <Clock className="w-3 h-3" /> <Bidi>{hours}</Bidi>
                            </span>
                        )}
                        {place.tags?.takeaway === 'yes' && (
                            <span className="inline-flex items-center gap-1"><ShoppingBag className="w-3 h-3" /> Takeaway</span>
                        )}
                        {place.tags?.outdoor_seating === 'yes' && (
                            <span className="inline-flex items-center gap-1"><Sun className="w-3 h-3" /> Outdoor</span>
                        )}
                    </div>
                )}

                <div className="mt-auto pt-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => onVote?.(place, 1)}
                            aria-label="More like this"
                            aria-pressed={userVote === 1}
                            className="btn grid place-items-center w-9 h-9"
                            style={{
                                color: userVote === 1 ? 'var(--accent)' : 'var(--ink-3)',
                                background: userVote === 1 ? 'var(--surface-2)' : 'transparent',
                            }}
                        >
                            <ThumbsUp className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => onVote?.(place, -1)}
                            aria-label="Less like this"
                            aria-pressed={userVote === -1}
                            className="btn grid place-items-center w-9 h-9"
                            style={{
                                color: userVote === -1 ? 'var(--danger)' : 'var(--ink-3)',
                                background: userVote === -1 ? 'var(--surface-2)' : 'transparent',
                            }}
                        >
                            <ThumbsDown className="w-4 h-4" />
                        </button>
                    </div>

                    <a
                        href={mapHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => onChoose?.(place)}
                        tabIndex={dragging ? -1 : 0}
                        className="btn inline-flex items-center gap-1.5 px-4 py-2 text-sm"
                        style={{ background: 'var(--ink)', color: 'var(--paper)' }}
                    >
                        Go <Navigation className="w-3.5 h-3.5" />
                    </a>
                </div>
            </div>
        </article>
    );
};

export default PlaceCard;
