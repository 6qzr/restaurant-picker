import { motion } from 'framer-motion';
import { Star, ThumbsUp, ThumbsDown, Navigation, RefreshCw, Ban } from 'lucide-react';
import { clsx } from 'clsx';

// Deterministic gradient from the name, so a place with no photo still gets a
// stable, intentional-looking card instead of a broken third-party placeholder.
const gradientFor = (name = '') => {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
    return `linear-gradient(135deg, hsl(${h} 42% 62%), hsl(${(h + 38) % 360} 46% 44%))`;
};

const BADGES = {
    bestRated: {
        label: 'Best Rated',
        color: 'bg-gold text-white',
        description: 'Trusted by many. High rating & popularity.',
    },
    hiddenGem: {
        label: 'Hidden Gem',
        color: 'bg-emerald-600 text-white',
        description: 'Excellent food, but fewer reviews. A secret spot!',
    },
    wildcard: {
        label: 'Wildcard',
        color: 'bg-indigo-600 text-white',
        description: 'Feeling lucky? A random pick to mix things up.',
    },
};

const RestaurantCard = ({ place, type, onVote, userVote, onSwap, onBan }) => {
    if (!place) return null;

    const { name, rating, user_ratings_total, photos, vicinity, place_id } = place;

    const photoUrl = photos && photos.length > 0 ? photos[0].getUrl({ maxWidth: 400 }) : '';
    const badge = BADGES[type] ?? BADGES.wildcard;

    const mapLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        name
    )}&query_place_id=${place_id}`;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="card-timeless flex flex-col h-full relative group"
        >
            {/* Badge */}
            <div className="absolute top-4 left-4 flex items-center space-x-2 z-10">
                <div
                    className={clsx(
                        'px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-md',
                        badge.color
                    )}
                >
                    {badge.label}
                </div>
            </div>

            <div className="absolute top-4 right-4 flex space-x-2 z-20">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onSwap?.();
                    }}
                    className="p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-sm hover:bg-white hover:text-gold transition-colors text-gray-400"
                    title="Swap this option"
                    aria-label="Swap this option"
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onBan?.();
                    }}
                    className="p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-sm hover:bg-red-50 hover:text-red-500 transition-colors text-gray-400"
                    title="Veto (don't show again)"
                    aria-label="Veto this place"
                >
                    <Ban className="w-4 h-4" />
                </button>
            </div>

            {/* Image Area */}
            <div className="h-48 overflow-hidden relative" style={{ background: gradientFor(name) }}>
                {photoUrl && (
                    <img
                        src={photoUrl}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        onError={(e) => {
                            e.currentTarget.style.display = 'none';
                        }}
                    />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

                {rating != null && (
                    <div className="absolute bottom-3 left-4 text-white flex items-center space-x-1">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-bold">{rating}</span>
                        <span className="text-xs opacity-80">({user_ratings_total})</span>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-5 flex-1 flex flex-col">
                <div className="mb-2">
                    <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md inline-block">
                        {badge.description}
                    </span>
                </div>
                <h3 className="text-xl font-serif font-bold text-ink mb-1 leading-tight">
                    <bdi dir="auto">{name}</bdi>
                </h3>
                <p className="text-sm text-gray-500 mb-4 line-clamp-1">
                    <bdi dir="auto">{vicinity}</bdi>
                </p>

                <div className="mt-auto flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onVote(place, 1);
                            }}
                            aria-label="I like this kind of place"
                            aria-pressed={userVote === 1}
                            className={clsx(
                                'p-2 rounded-full transition-colors hover:bg-green-100',
                                userVote === 1 ? 'text-green-600 bg-green-50' : 'text-gray-400'
                            )}
                        >
                            <ThumbsUp className="w-5 h-5" />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onVote(place, -1);
                            }}
                            aria-label="Not my kind of place"
                            aria-pressed={userVote === -1}
                            className={clsx(
                                'p-2 rounded-full transition-colors hover:bg-red-100',
                                userVote === -1 ? 'text-red-600 bg-red-50' : 'text-gray-400'
                            )}
                        >
                            <ThumbsDown className="w-5 h-5" />
                        </button>
                    </div>

                    <a
                        href={mapLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-1 px-4 py-2 bg-ink text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                        <span>Go</span>
                        <Navigation className="w-3 h-3" />
                    </a>
                </div>
            </div>
        </motion.div>
    );
};

export default RestaurantCard;
