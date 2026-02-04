const USAGE_KEY = 'restaurant_picker_usage';

// Google Maps Pricing (Approximate)
// Nearby Search: ~$0.032 per call (with field masking, otherwise ~$0.04)
// We use a safe estimate of $0.04 to be conservative.
const COST_PER_CALL = 0.04;
const FREE_TIER_CREDIT = 200.00; // Monthly free credit

export const getUsageStats = () => {
    try {
        const stored = localStorage.getItem(USAGE_KEY);
        const stats = stored ? JSON.parse(stored) : { calls: 0, cost: 0, lastReset: Date.now() };

        // Auto-reset if it's been more than 30 days? 
        // For simplicity, let's keep it manual or simple perpetual counter for now.
        // Or checking month match could work, but let's stick to simple "Usage since X".

        return {
            ...stats,
            limit: FREE_TIER_CREDIT,
            percentUsed: (stats.cost / FREE_TIER_CREDIT) * 100,
            remainingCalls: Math.floor((FREE_TIER_CREDIT - stats.cost) / COST_PER_CALL)
        };
    } catch (e) {
        return { calls: 0, cost: 0, limit: 200, percentUsed: 0 };
    }
};

export const trackApiCall = () => {
    const stats = getUsageStats();
    stats.calls += 1;
    stats.cost += COST_PER_CALL;

    // Safety cap - although we can't stop the key from working, we can warn the user locally
    localStorage.setItem(USAGE_KEY, JSON.stringify(stats));
    return stats;
};

export const resetUsage = () => {
    const fresh = { calls: 0, cost: 0, lastReset: Date.now() };
    localStorage.setItem(USAGE_KEY, JSON.stringify(fresh));
    return fresh;
};
