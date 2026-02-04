import { getPreferenceScore } from '../services/storage';

export const pickSelections = (places) => {
    if (!places || places.length < 3) return null; // Need at least 3 places to play

    // limit pool size to avoid heavy processing if we found 60 results
    // But we want to process them all to find the gems.

    // 1. Calculate an "Adaptive Score" for every place
    const scoredPlaces = places.map(p => {
        const prefScore = getPreferenceScore(p.types);
        // Base score is rating, boosted by preference
        // A preference of +1 adds roughly 0.5 to the "effective rating" for sorting purposes
        const effectiveRating = (p.rating || 0) + (prefScore * 0.5);

        return {
            ...p,
            effectiveRating,
            prefScore
        };
    });

    // Helper to shuffle array
    const shuffle = (array) => array.sort(() => Math.random() - 0.5);

    // --- SELECTION 1: BEST RATED (Safe Bet) ---
    // Sort by effective rating desc, then review count desc
    const sortedByBest = [...scoredPlaces].sort((a, b) => {
        if (b.effectiveRating !== a.effectiveRating) return b.effectiveRating - a.effectiveRating;
        return (b.user_ratings_total || 0) - (a.user_ratings_total || 0);
    });
    // Pick one of the top 3 best rated to add variety if user spins again
    const bestRatedPool = sortedByBest.slice(0, 5);
    const bestRated = shuffle(bestRatedPool)[0];


    // --- SELECTION 2: HIDDEN GEM ---
    // High rating, but lower review count (e.g. < 100, or bottom 50% of review counts)
    // And MUST NOT be the same as bestRated
    const sortedByHidden = [...scoredPlaces].filter(p =>
        p.place_id !== bestRated.place_id &&
        p.user_ratings_total < 150 &&
        p.user_ratings_total > 10 // avoid completely unknown places
    ).sort((a, b) => b.effectiveRating - a.effectiveRating);

    let hiddenGem = sortedByHidden.length > 0 ? sortedByHidden[0] : null;

    // Fallback if no specific "Hidden Gem" found (e.g. all have high reviews), just pick 2nd best
    if (!hiddenGem) {
        const remaining = sortedByBest.filter(p => p.place_id !== bestRated.place_id);
        hiddenGem = remaining[0];
    }


    // --- SELECTION 3: WILDCARD (Trending / Something different) ---
    // Random pick from the remaining, but weighted towards positive preferences
    const remainingPool = scoredPlaces.filter(p =>
        p.place_id !== bestRated.place_id &&
        p.place_id !== hiddenGem?.place_id
    );

    // Simple random for pure wildcard, or weighted random? 
    // Let's do a weighted random towards things with positive prefScore > 0
    let wildcard = null;
    if (remainingPool.length > 0) {
        // Boost chance of "Liked" types appearing in wildcard
        const positiveCandidates = remainingPool.filter(p => p.prefScore > 0);
        const candidates = Math.random() > 0.3 && positiveCandidates.length > 0
            ? positiveCandidates
            : remainingPool;

        wildcard = shuffle(candidates)[0];
    }

    return {
        bestRated,
        hiddenGem,
        wildcard
    };
};
