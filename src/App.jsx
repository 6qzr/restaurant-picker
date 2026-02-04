import React, { useState, useEffect, useCallback } from 'react';
import { APIProvider, Map, useMap } from '@vis.gl/react-google-maps';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, MapPin, Car, Armchair } from 'lucide-react';

import SetupModal from './components/SetupModal';
import CategoryFilter from './components/CategoryFilter';
import SlotMachine from './components/SlotMachine';
import TimeSlider from './components/TimeSlider';
import RestaurantCard from './components/RestaurantCard';
import { searchNearbyPlaces } from './services/googleMaps';
import { pickSelections } from './utils/pickerLogic';
import { CATEGORY_MAPPINGS } from './utils/categories';
// import { convertMinutesToRadius } from './utils/geometry'; // Not needed if we use KM directly

import { savePreference, getPreferences } from './services/storage';
import { getUsageStats, resetUsage } from './services/usageTracker';

const MAX_RETRIES = 3;

// Inner component to access Map instance
const GameLogic = ({ apiKey, userLocation, radiusKm, selectedCategories, isAdventureMode, bannedIds, triggerSpin, onSpinComplete, onResultsUpdate }) => {
    const map = useMap();
    const [allPlaces, setAllPlaces] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    // Search when location or time or FILTERS changes (debounced ideal, but simple for now)
    useEffect(() => {
        if (!map || !userLocation || !apiKey) return;

        const radiusMeters = radiusKm * 1000;

        // Resolve selected category IDs to actual Google Types
        let searchTypes = [];
        if (selectedCategories.length > 0) {
            selectedCategories.forEach(catId => {
                const cat = CATEGORY_MAPPINGS.find(c => c.id === catId);
                if (cat) {
                    searchTypes = [...searchTypes, ...cat.types];
                }
            });
            // Deduplicate
            searchTypes = [...new Set(searchTypes)];
        }

        const fetchData = async () => {
            setIsSearching(true);
            try {
                // Initialize/Move map to user location without UI 
                // We don't render the map visible, but we need the instance
                const results = await searchNearbyPlaces(map, userLocation, radiusMeters, searchTypes);
                setAllPlaces(results);
            } catch (err) {
                console.error("Search failed", err);
            } finally {
                setIsSearching(false);
            }
        };

        fetchData();
    }, [map, userLocation, radiusKm, apiKey, selectedCategories]);

    // Update parent with candidates for Slot Machine effect
    useEffect(() => {
        if (allPlaces.length > 0) {
            onResultsUpdate(allPlaces);
        }
    }, [allPlaces, onResultsUpdate]);

    // Handle Spin
    useEffect(() => {
        const activePlaces = allPlaces.filter(p => !bannedIds.includes(p.place_id));

        if (triggerSpin && activePlaces.length > 0) {
            const result = pickSelections(activePlaces, userLocation, isAdventureMode);
            // Simulate "Thinking" time for effect (Slot Machine)
            setTimeout(() => {
                onSpinComplete(result);
            }, 2000); // 2 seconds for dramatic effect
        } else if (triggerSpin && activePlaces.length === 0 && !isSearching) {
            onSpinComplete(null);
        }
    }, [triggerSpin, allPlaces, isSearching, onSpinComplete, bannedIds]); // Note: Depend on allPlaces, but filtering happens inside

    return null; // Logic only, no UI
};

const App = () => {
    const [apiKey, setApiKey] = useState(localStorage.getItem('restaurant_picker_api_key') || '');
    const [userLocation, setUserLocation] = useState(null);
    const [radiusKm, setRadiusKm] = useState(5); // Default 5 km
    const [selectedFilters, setSelectedFilters] = useState([]); // Category IDs
    const [isAdventureMode, setIsAdventureMode] = useState(false); // New Adventure State
    const [spinTrigger, setSpinTrigger] = useState(0);
    const [isSpinning, setIsSpinning] = useState(false);
    const [selections, setSelections] = useState(null);
    const [pools, setPools] = useState(null); // New state for swapping
    const [preferences, setPreferences] = useState(getPreferences());
    const [error, setError] = useState('');
    const [usage, setUsage] = useState(getUsageStats()); // New State
    const [bannedIds, setBannedIds] = useState([]); // Session Bans
    const [candidatePlaces, setCandidatePlaces] = useState([]); // For Slot Machine visual

    // Geolocation Helper
    const requestLocation = useCallback(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const loc = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    setUserLocation(loc);
                    sessionStorage.setItem('last_location', JSON.stringify(loc));
                },
                (err) => {
                    setError("Location permission denied. We need it to find food!");
                }
            );
        } else {
            setError("Geolocation not supported by this browser.");
        }
    }, []);

    // Auto-login / Auto-location
    useEffect(() => {
        // Try to restore location from session first (instant)
        const cached = sessionStorage.getItem('last_location');
        if (cached && !userLocation) {
            setUserLocation(JSON.parse(cached));
        }

        // If we have a key but no location, ask for it automatically
        if (apiKey && !userLocation && !cached) {
            requestLocation();
        }
    }, [apiKey, userLocation, requestLocation]);

    // Setup Handler
    const handleSetupComplete = (key) => {
        setApiKey(key);
        localStorage.setItem('restaurant_picker_api_key', key);
        requestLocation();
    };

    const handleSpin = () => {
        setIsSpinning(true);
        setSelections(null); // clear old
        setPools(null);
        setSpinTrigger(prev => prev + 1);
    };

    // Update usage when spinning (since that's when we fetch/track)
    // Actually, the GameLogic does the fetch, so we should sync usage there or poll it?
    // Simplest is to check it after spin complete.
    const handleSpinComplete = useCallback((result) => {
        setIsSpinning(false);
        setUsage(getUsageStats()); // Update stats
        if (!result) {
            setError("No acceptable restaurants found nearby. Try increasing the search radius!");
        } else {
            // Fix: result now contains { selections, pools }
            setSelections(result.selections);
            setPools(result.pools);
            setError('');
        }
    }, []);

    const handleSwap = (type) => {
        if (!pools || !pools[type] || pools[type].length === 0) return;

        // Get current selection
        const current = selections[type];

        // Find next candidate in pool that isn't currently selected in ANY slot
        const usedIds = [
            selections.bestRated?.place_id,
            selections.hiddenGem?.place_id,
            selections.wildcard?.place_id
        ].filter(Boolean);

        const candidates = pools[type].filter(p => !usedIds.includes(p.place_id) && !bannedIds.includes(p.place_id));

        if (candidates.length > 0) {
            // Pick random next one or just the next one? Random is fun.
            // But let's just rotate through for stability if they keep clicking.
            // Actually, let's just pick index 0 of the candidates.
            const next = candidates[0];

            setSelections(prev => ({
                ...prev,
                [type]: next
            }));
        } else {
            // Shake effect or toast? No candidates left.
            console.log("No more swap candidates for", type);
        }
    };

    const handleBan = (placeId, type) => {
        setBannedIds(prev => [...prev, placeId]);
        // Immediately swap out the banned card
        // We need to wait for state update? No, handleSwap reads from 'pools' which is stable, 
        // but it checks bannedIds which is state. 
        // We can pass the new banned list or just use a timeout/effect?
        // Simpler: Just force a swap but ensure the swap logic sees the new ban.
        // Actually, let's update local banned list for the swap call directly OR 
        // since setState is async, we might swap to the same one if we aren't careful.

        // Better: We update the state, AND we manually find the next one here to setSelection immediately.

        // 1. Add to ban list
        const newBanned = [...bannedIds, placeId];
        setBannedIds(newBanned);

        // 2. Perform Swap using the NEW ban list
        if (!pools || !pools[type]) return;

        const usedIds = [
            selections.bestRated?.place_id,
            selections.hiddenGem?.place_id,
            selections.wildcard?.place_id
        ].filter(Boolean);

        const candidates = pools[type].filter(p => !usedIds.includes(p.place_id) && !newBanned.includes(p.place_id));

        if (candidates.length > 0) {
            const next = candidates[0];
            setSelections(prev => ({ ...prev, [type]: next }));
        } else {
            // No replacements
            setSelections(prev => ({ ...prev, [type]: null }));
        }
    };

    const handleVote = (place, value) => {
        // Save preference
        // Extract types, maybe top 3 types
        if (place.types) {
            savePreference(place.types, value);
            // Update local state to trigger any UI if needed, though mostly invisible
            setPreferences(getPreferences());
        }
    };

    // Track voted state per session for UI feedback
    const [sessionVotes, setSessionVotes] = useState({});
    const onVoteUI = (place, val) => {
        handleVote(place, val);
        setSessionVotes(prev => ({ ...prev, [place.place_id]: val }));
    };


    const LIBRARIES = ['places'];

    const toggleFilter = (id) => {
        setSelectedFilters(prev => {
            if (prev.includes(id)) return prev.filter(x => x !== id);
            return [...prev, id];
        });
    };

    return (
        <div className="min-h-screen bg-paper text-ink p-4 md:p-8 font-sans overflow-x-hidden">
            {!apiKey ? (
                <SetupModal onComplete={handleSetupComplete} />
            ) : !userLocation ? (
                /* Locating Splash */
                <div className="fixed inset-0 flex flex-col items-center justify-center bg-paper z-50">
                    <div className="w-16 h-16 bg-ink text-white p-3 rounded-2xl mb-6 shadow-xl animate-bounce">
                        <MapPin className="w-full h-full" />
                    </div>
                    <h2 className="text-2xl font-serif font-bold mb-2">Locating you...</h2>
                    <p className="text-stone-400 italic">Chef's Choice is finding your current position.</p>
                    {error && (
                        <div className="mt-8 p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 max-w-sm text-center">
                            {error}
                            <button
                                onClick={() => requestLocation()}
                                className="block w-full mt-2 text-sm font-bold underline"
                            >
                                Try Again
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <APIProvider apiKey={apiKey} libraries={LIBRARIES}>
                    {/* Invisible Map for Service Access */}
                    <div style={{ display: 'none' }}>
                        <Map center={userLocation} zoom={15} />
                    </div>

                    <GameLogic
                        apiKey={apiKey}
                        userLocation={userLocation}
                        radiusKm={radiusKm}
                        selectedCategories={selectedFilters}
                        isAdventureMode={isAdventureMode}
                        bannedIds={bannedIds}
                        triggerSpin={spinTrigger}
                        onSpinComplete={handleSpinComplete}
                        onResultsUpdate={setCandidatePlaces}
                    />

                    <header className="max-w-4xl mx-auto flex items-center justify-between mb-8">
                        <div className="flex items-center space-x-3">
                            <div className="bg-ink text-white p-2 rounded-lg">
                                <MapPin className="w-6 h-6" />
                            </div>
                            <h1 className="text-2xl font-serif font-bold">Chef's Choice</h1>
                        </div>

                        {/* Usage Tracker */}
                        <div className="bg-white px-4 py-2 rounded-full shadow-sm border border-stone-100 flex items-center space-x-3 text-xs md:text-sm cursor-help" title="Estimated cost against free tier">
                            <div className="flex flex-col items-end">
                                <span className="font-bold text-ink">${usage.cost.toFixed(2)} / $200</span>
                                <span className="text-gray-400">{usage.calls} calls</span>
                            </div>
                            <div className="w-8 h-8 relative">
                                <svg className="w-full h-full transform -rotate-90">
                                    <circle cx="16" cy="16" r="14" stroke="#e5e7eb" strokeWidth="3" fill="none" />
                                    <circle cx="16" cy="16" r="14" stroke={usage.percentUsed > 80 ? '#ef4444' : '#22c55e'} strokeWidth="3" fill="none" strokeDasharray="88" strokeDashoffset={88 - (88 * usage.percentUsed) / 100} />
                                </svg>
                            </div>
                        </div>
                    </header>

                    <main className="max-w-6xl mx-auto">
                        {/* Controls */}
                        <div className="mb-8 flex flex-col items-center space-y-6">

                            <div className="w-full max-w-2xl px-4 flex flex-col items-center">
                                <TimeSlider radiusKm={radiusKm} setRadiusKm={setRadiusKm} />

                                {/* Adventure Toggle */}
                                <button
                                    onClick={() => {
                                        setIsAdventureMode(prev => !prev);
                                        if (selections) handleSpin();
                                    }}
                                    className={`mt-4 flex items-center space-x-2 px-4 py-2 rounded-full border transition-colors duration-300 ${isAdventureMode ? 'bg-amber-100 border-amber-300 text-amber-800' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}
                                >
                                    {isAdventureMode ? <Car className="w-5 h-5" /> : <Armchair className="w-5 h-5" />}
                                    <span className="text-sm font-medium">
                                        {isAdventureMode ? "Adventure Mode: ON (Go Far)" : "Standard Mode (Stay Close)"}
                                    </span>
                                </button>
                            </div>

                            <div className="w-full max-w-3xl">
                                <CategoryFilter
                                    selectedCategories={selectedFilters}
                                    onToggle={toggleFilter}
                                />
                            </div>

                            <button
                                onClick={handleSpin}
                                disabled={isSpinning}
                                className={`btn-timeless h-16 w-16 md:w-auto md:px-8 flex items-center justify-center space-x-2 ${isSpinning ? 'animate-pulse' : ''}`}
                            >
                                <RefreshCw className={`w-6 h-6 ${isSpinning ? 'animate-spin-slow' : ''}`} />
                                <span className="hidden md:inline">
                                    {spinTrigger === 0 ? "Spin" : "Spin Again"}
                                </span>
                            </button>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="max-w-md mx-auto mb-8 p-4 bg-red-50 text-red-600 rounded-xl text-center border border-red-100">
                                {error}
                            </div>
                        )}

                        {/* Cards Grid */}
                        <div className="w-full min-h-[400px]">
                            <AnimatePresence mode="wait">
                                {isSpinning ? (
                                    // Loading Skeletons or Empty State
                                    <SlotMachine candidates={candidatePlaces} />
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                        <AnimatePresence mode="wait">
                                            {isSpinning ? (
                                                <SlotMachine candidates={candidatePlaces} />
                                            ) : (
                                                <>
                                                    {selections?.bestRated && (
                                                        <RestaurantCard
                                                            key="best"
                                                            place={selections.bestRated}
                                                            type="Best Rated"
                                                            description="The local favorite. High ratings and plenty of reviews."
                                                            onVote={onVoteUI}
                                                            userVote={sessionVotes[selections.bestRated.place_id]}
                                                            userLocation={userLocation}
                                                            onSwap={() => handleSwap('bestRated')}
                                                            onBan={() => handleBan(selections.bestRated.place_id, 'bestRated')}
                                                        />
                                                    )}
                                                    {selections?.hiddenGem && (
                                                        <RestaurantCard
                                                            key="hidden"
                                                            place={selections.hiddenGem}
                                                            type="Hidden Gem"
                                                            description="Great ratings but under the radar. A discovery waiting to happen."
                                                            onVote={onVoteUI}
                                                            userVote={sessionVotes[selections.hiddenGem.place_id]}
                                                            userLocation={userLocation}
                                                            onSwap={() => handleSwap('hiddenGem')}
                                                            onBan={() => handleBan(selections.hiddenGem.place_id, 'hiddenGem')}
                                                        />
                                                    )}
                                                    {selections?.wildcard && (
                                                        <RestaurantCard
                                                            key="wild"
                                                            place={selections.wildcard}
                                                            type="Wildcard"
                                                            description="Something different. Shake up your routine!"
                                                            onVote={onVoteUI}
                                                            userVote={sessionVotes[selections.wildcard.place_id]}
                                                            userLocation={userLocation}
                                                            onSwap={() => handleSwap('wildcard')}
                                                            onBan={() => handleBan(selections.wildcard.place_id, 'wildcard')}
                                                        />
                                                    )}
                                                </>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )}
                            </AnimatePresence>
                        </div>
                    </main>
                </APIProvider>
            )}
        </div>
    );
};

export default App;
