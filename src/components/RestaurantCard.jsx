import React from 'react';
import { motion } from 'framer-motion';
import { Star, MapPin, ThumbsUp, ThumbsDown, Navigation, RefreshCw, Ban } from 'lucide-react';
import { clsx } from 'clsx';

const RestaurantCard = ({ place, type, onVote, votedState, onSwap }) => {
    if (!place) return null;

    const {
        name,
        rating,
        user_ratings_total,
        photos,
        vicinity,
        place_id
    } = place;

    const photoUrl = photos && photos.length > 0
        ? photos[0].getUrl({ maxWidth: 400 })
        : 'https://via.placeholder.com/400x300?text=No+Image';

    const mapLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=${place_id}`;

    const badgeColors = {
        bestRated: 'bg-gold text-white',
        hiddenGem: 'bg-emerald-600 text-white',
        wildcard: 'bg-indigo-600 text-white',
    };

    const badgeLabels = {
        bestRated: 'Best Rated',
        hiddenGem: 'Hidden Gem',
        wildcard: 'Wildcard',
    };

    const badgeDescriptions = {
        bestRated: 'Trusted by many. High rating & popularity.',
        hiddenGem: 'Excellent food, but fewer reviews. A secret spot!',
        wildcard: 'Feeling lucky? A random pick to mix things up.',
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="card-timeless flex flex-col h-full relative group"
        >
            {/* Badge */}
            <div className={clsx(
                "absolute top-4 left-4 flex items-center space-x-2 z-10"
            )}>
                <div className={clsx(
                    "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-md",
                    badgeColors[type]
                )}>
                    {badgeLabels[type]}
                </div>
            </div>

            <div className="absolute top-4 right-4 flex space-x-2 z-20">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onSwap();
                    }}
                    className="p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-sm hover:bg-white hover:text-gold transition-colors text-gray-400"
                    title="Swap this option"
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onBan();
                    }}
                    className="p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-sm hover:bg-red-50 hover:text-red-500 transition-colors text-gray-400"
                    title="Veto (Don't show again)"
                >
                    <Ban className="w-4 h-4" />
                </button>
            </div>

            {/* Image Area */}
            <div className="h-48 overflow-hidden relative">
                <img
                    src={photoUrl}
                    alt={name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

                {/* Rating Overlay */}
                <div className="absolute bottom-3 left-4 text-white flex items-center space-x-1">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-bold">{rating}</span>
                    <span className="text-xs opacity-80">({user_ratings_total})</span>
                </div>
            </div>

            {/* Content */}
            <div className="p-5 flex-1 flex flex-col">
                <div className="mb-2">
                    <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md inline-block">
                        {badgeDescriptions[type]}
                    </span>
                </div>
                <h3 className="text-xl font-serif font-bold text-ink mb-1 leading-tight">{name}</h3>
                <p className="text-sm text-gray-500 mb-4 line-clamp-1">{vicinity}</p>

                <div className="mt-auto flex items-center justify-between">
                    {/* Voting */}
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); onVote(place, 1); }}
                            className={clsx(
                                "p-2 rounded-full transition-colors hover:bg-green-100",
                                votedState === 1 ? "text-green-600 bg-green-50" : "text-gray-400"
                            )}
                        >
                            <ThumbsUp className="w-5 h-5" />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onVote(place, -1); }}
                            className={clsx(
                                "p-2 rounded-full transition-colors hover:bg-red-100",
                                votedState === -1 ? "text-red-600 bg-red-50" : "text-gray-400"
                            )}
                        >
                            <ThumbsDown className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Go Button */}
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
