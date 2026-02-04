import { getPreferenceScore } from '../services/storage';

export const pickSelections = (places, userLocation, isAdventureMode = false) => {
    if (!places || places.length < 3) return null; // Need at least 3 places to play

    // limit pool size to avoid heavy processing if we found 60 results
    // But we want to process them all to find the gems.

    // Helper for distance (Haversine)
    const getDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371; // Radius of the earth in km
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distance in km
    };

    // 1. Calculate an "Adaptive Score" for every place
    // 1. Calculate an "Adaptive Score" for every place
    const scoredPlaces = places.map(p => {
        const prefScore = getPreferenceScore(p.types);

        // DISTANCE FACTOR
        let distanceModifier = 0;
        if (userLocation && p.geometry && p.geometry.location) {
            // p.geometry.location might be a Google Maps LatLng object OR a plain object depending on mapping
            // Our mapping in googleMaps.js passed the API object directly? 
            // New API returns LatLng class usually.
            const pLat = typeof p.geometry.location.lat === 'function' ? p.geometry.location.lat() : p.geometry.location.lat;
            const pLng = typeof p.geometry.location.lng === 'function' ? p.geometry.location.lng() : p.geometry.location.lng;

            const distKm = getDistance(userLocation.lat, userLocation.lng, pLat, pLng);

            // Penalty: -0.1 per km. 
            // 5km away = -0.5 score
            // 10km away = -1.0 score

            if (isAdventureMode) {
                // Adventure Mode: Further is better (up to a point? or just generally boost distance)
                // Boost: +0.15 per km. 10km = +1.5. 
                // We make it slightly stronger than penalty to really force far options
                distanceModifier = distKm * 0.15;
            } else {
                // Standard: Closer is better
                // Penalty: -0.1 per km
                distanceModifier = -(distKm * 0.1);
            }
        }

        // OLD LOGIC: (p.rating || 0) + (prefScore * 0.5);
        // NEW LOGIC: Weighted Score with Distance Decay

        const reviewConfidence = Math.min(Math.log10(p.user_ratings_total || 1) * 0.2, 1.0);
        const baseRating = p.rating || 0;

        // Final Score
        const effectiveRating = (baseRating + reviewConfidence + (prefScore * 0.5)) + distanceModifier;

        return {
            ...p,
            effectiveRating,
            prefScore,
            reviewConfidence
        };
    });

    // Helper to shuffle array
    const shuffle = (array) => array.sort(() => Math.random() - 0.5);

    // --- SELECTION 1: BEST RATED (The "Trusty" Choice) ---
    // Strictly sort by our new robust effectiveRating
    const sortedByBest = [...scoredPlaces].sort((a, b) => b.effectiveRating - a.effectiveRating);

    // UX IMPROVEMENT: Don't just pick #1. Pick randomly from the top 3 (or top 10% if list is long)
    // This allows "Spin Again" to actually give variety while still guaranteeing a top-tier choice.
    const bestRatedPoolSize = Math.min(3, sortedByBest.length);
    const bestRatedPool = sortedByBest.slice(0, bestRatedPoolSize);
    const bestRated = shuffle(bestRatedPool)[0];


    // --- SELECTION 2: HIDDEN GEM ---
    // High rating, but lower review count (e.g. < 150)
    // And MUST NOT be the same as bestRated
    const sortedByHidden = [...scoredPlaces].filter(p =>
        p.place_id !== bestRated.place_id &&
        p.user_ratings_total < 150 &&
        p.user_ratings_total > 5
    ).sort((a, b) => b.rating - a.rating); // Sort by raw rating

    // UX IMPROVEMENT: Pick from top 5 hidden gems to ensure variety
    const hiddenPoolSize = Math.min(5, sortedByHidden.length);
    const hiddenPool = sortedByHidden.slice(0, hiddenPoolSize);

    let hiddenGem = hiddenPool.length > 0 ? shuffle(hiddenPool)[0] : null;

    // Fallback: If no hidden gem, just pick the next best rated that isn't the winner
    if (!hiddenGem) {
        const remaining = sortedByBest.filter(p => p.place_id !== bestRated.place_id);
        if (remaining.length > 0) {
            // different random fallback
            hiddenGem = shuffle(remaining.slice(0, 3))[0];
        }
    }


    // --- SELECTION 3: WILDCARD (Trending / Something different) ---
    // Random pick from the remaining
    const remainingPool = scoredPlaces.filter(p =>
        p.place_id !== bestRated.place_id &&
        p.place_id !== (hiddenGem ? hiddenGem.place_id : '')
    );

    // Boost chance of "Liked" types appearing in wildcard
    let wildcard = null;
    if (remainingPool.length > 0) {
        const positiveCandidates = remainingPool.filter(p => p.prefScore > 0);
        // 50% chance to respect preference, 50% pure chaos
        const candidates = Math.random() > 0.5 && positiveCandidates.length > 0
            ? positiveCandidates
            : remainingPool;

        wildcard = shuffle(candidates)[0];
    }

    return {
        selections: {
            bestRated,
            hiddenGem,
            wildcard
        },
        pools: {
            bestRated: sortedByBest,
            hiddenGem: sortedByHidden,
            wildcard: remainingPool
        }
    };
};
