const PREFS_KEY = 'restaurant_picker_prefs';

export const getPreferences = () => {
    try {
        const stored = localStorage.getItem(PREFS_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch (e) {
        console.warn('Failed to load preferences', e);
        return {};
    }
};

export const savePreference = (tags, weight) => {
    // tags is an array of strings (e.g. ['cafe', 'food'])
    // weight is +1 (like) or -1 (dislike)
    const prefs = getPreferences();

    tags.forEach(tag => {
        // We normalize tags to lower case just in case
        const key = tag.toLowerCase();

        // Impact decay: older preferences matter, but we don't want to go infinite.
        // We just clamp between -10 and 10 to prevent extreme bias.
        const current = prefs[key] || 0;
        let next = current + weight;

        // Clamp
        if (next > 10) next = 10;
        if (next < -10) next = -10;

        prefs[key] = next;
    });

    try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch (e) {
        console.warn('Failed to save preferences', e);
    }
};

// Helper to calculate a score boost for a place based on its types
export const getPreferenceScore = (placeTypes) => {
    const prefs = getPreferences();
    let score = 0;

    if (!placeTypes || !placeTypes.length) return 0;

    placeTypes.forEach(type => {
        const val = prefs[type.toLowerCase()];
        if (val) score += val;
    });

    return score;
};
