import { useState, useEffect, useCallback, useRef } from 'react';
import { APIProvider, Map, useMap } from '@vis.gl/react-google-maps';
import { AnimatePresence } from 'framer-motion';
import { RefreshCw, MapPin, Car, Armchair } from 'lucide-react';

import SetupModal from './components/SetupModal';
import CategoryFilter from './components/CategoryFilter';
import SlotMachine from './components/SlotMachine';
import TimeSlider from './components/TimeSlider';
import RestaurantCard from './components/RestaurantCard';
import { searchNearbyPlaces } from './services/googleMaps';
import { pickSelections } from './utils/pickerLogic';
import { CATEGORY_MAPPINGS } from './utils/categories';
import { savePreference } from './services/storage';
import { getUsageStats } from './services/usageTracker';

// Hoisted: re-creating this inside render gave APIProvider a new array identity
// on every render, churning the loader.
const LIBRARIES = ['places'];
const BANNED_KEY = 'restaurant_picker_banned';
const LANES = ['bestRated', 'hiddenGem', 'wildcard'];

const loadBanned = () => {
    try {
        const raw = localStorage.getItem(BANNED_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
};

/** Debounce a rapidly-changing value. The radius slider fires on every tick of a
 *  native range input; without this, dragging 1 -> 50 fired up to 50 billed searches. */
const useDebouncedValue = (value, delay) => {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
};

// Inner component to access Map instance
const GameLogic = ({
    apiKey,
    userLocation,
    radiusKm,
    selectedCategories,
    isAdventureMode,
    bannedIds,
    triggerSpin,
    onSpinComplete,
    onResultsUpdate,
}) => {
    const map = useMap();
    const [allPlaces, setAllPlaces] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    // Which spin trigger we have already acted on. Without this the effect below
    // re-ran whenever `allPlaces` or `bannedIds` changed -- silently re-rolling a
    // board the user had already swapped and vetoed.
    const handledSpin = useRef(0);

    // Latest values, so the spin effect can read them without depending on them.
    const latest = useRef({});
    latest.current = { allPlaces, bannedIds, userLocation, isAdventureMode, isSearching };

    useEffect(() => {
        if (!map || !userLocation || !apiKey) return;

        const radiusMeters = radiusKm * 1000;

        let searchTypes = [];
        if (selectedCategories.length > 0) {
            selectedCategories.forEach((catId) => {
                const cat = CATEGORY_MAPPINGS.find((c) => c.id === catId);
                if (cat) searchTypes = [...searchTypes, ...cat.types];
            });
            searchTypes = [...new Set(searchTypes)];
        }

        let cancelled = false;
        const fetchData = async () => {
            setIsSearching(true);
            try {
                const results = await searchNearbyPlaces(map, userLocation, radiusMeters, searchTypes);
                if (!cancelled) setAllPlaces(results);
            } catch (err) {
                console.error('Search failed', err);
            } finally {
                if (!cancelled) setIsSearching(false);
            }
        };

        fetchData();
        return () => {
            cancelled = true;
        };
    }, [map, userLocation, radiusKm, apiKey, selectedCategories]);

    useEffect(() => {
        if (allPlaces.length > 0) onResultsUpdate(allPlaces);
    }, [allPlaces, onResultsUpdate]);

    // Handle Spin -- fires only when the trigger actually advances.
    useEffect(() => {
        if (!triggerSpin || triggerSpin === handledSpin.current) return;

        const {
            allPlaces: places,
            bannedIds: banned,
            userLocation: loc,
            isAdventureMode: adventure,
            isSearching: searching,
        } = latest.current;

        const activePlaces = places.filter((p) => !banned.includes(p.place_id));

        if (activePlaces.length === 0) {
            if (!searching) {
                handledSpin.current = triggerSpin;
                onSpinComplete(null);
            }
            return;
        }

        handledSpin.current = triggerSpin;
        const result = pickSelections(activePlaces, loc, adventure);

        // Brief pause so the reveal reads as a deliberate beat, not a stutter.
        const timer = setTimeout(() => onSpinComplete(result), 900);
        return () => clearTimeout(timer);
    }, [triggerSpin, allPlaces, isSearching, onSpinComplete]);

    return null;
};

const App = () => {
    const [apiKey, setApiKey] = useState(() => localStorage.getItem('restaurant_picker_api_key') || '');
    const [userLocation, setUserLocation] = useState(null);
    const [radiusKm, setRadiusKm] = useState(5);
    const [selectedFilters, setSelectedFilters] = useState([]);
    const [isAdventureMode, setIsAdventureMode] = useState(false);
    const [spinTrigger, setSpinTrigger] = useState(0);
    const [isSpinning, setIsSpinning] = useState(false);
    const [selections, setSelections] = useState(null);
    const [pools, setPools] = useState(null);
    const [error, setError] = useState('');
    const [usage, setUsage] = useState(getUsageStats());
    const [bannedIds, setBannedIds] = useState(loadBanned);
    const [candidatePlaces, setCandidatePlaces] = useState([]);
    const [sessionVotes, setSessionVotes] = useState({});

    // Per-lane cursor, so repeated Swap clicks walk the list instead of
    // returning candidates[0] forever.
    const swapCursor = useRef({ bestRated: 0, hiddenGem: 0, wildcard: 0 });

    const debouncedRadius = useDebouncedValue(radiusKm, 400);

    useEffect(() => {
        try {
            localStorage.setItem(BANNED_KEY, JSON.stringify(bannedIds));
        } catch {
            /* storage full or blocked; bans stay session-only */
        }
    }, [bannedIds]);

    const requestLocation = useCallback(() => {
        if (!navigator.geolocation) {
            setError('Geolocation not supported by this browser.');
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
                setUserLocation(loc);
                sessionStorage.setItem('last_location', JSON.stringify(loc));
                setError('');
            },
            () => setError('Location permission denied. We need it to find food!')
        );
    }, []);

    useEffect(() => {
        const cached = sessionStorage.getItem('last_location');
        if (cached && !userLocation) {
            setUserLocation(JSON.parse(cached));
            return;
        }
        if (apiKey && !userLocation && !cached) requestLocation();
    }, [apiKey, userLocation, requestLocation]);

    const handleSetupComplete = (key) => {
        setApiKey(key);
        localStorage.setItem('restaurant_picker_api_key', key);
        requestLocation();
    };

    const handleSpin = () => {
        setIsSpinning(true);
        setSelections(null);
        setPools(null);
        swapCursor.current = { bestRated: 0, hiddenGem: 0, wildcard: 0 };
        setSpinTrigger((prev) => prev + 1);
    };

    const handleSpinComplete = useCallback((result) => {
        setIsSpinning(false);
        setUsage(getUsageStats());
        if (!result) {
            setError('No acceptable restaurants found nearby. Try increasing the search radius!');
        } else {
            setSelections(result.selections);
            setPools(result.pools);
            setError('');
        }
    }, []);

    /** Next candidate for a lane, honouring the lane cursor so repeat clicks advance. */
    const nextCandidate = (type, currentSelections, banned) => {
        if (!pools || !pools[type]) return null;
        const usedIds = LANES.map((l) => currentSelections?.[l]?.place_id).filter(Boolean);
        const candidates = pools[type].filter(
            (p) => !usedIds.includes(p.place_id) && !banned.includes(p.place_id)
        );
        if (candidates.length === 0) return null;
        const idx = swapCursor.current[type] % candidates.length;
        swapCursor.current[type] = idx + 1;
        return candidates[idx];
    };

    const handleSwap = (type) => {
        setSelections((prev) => {
            const next = nextCandidate(type, prev, bannedIds);
            return next ? { ...prev, [type]: next } : prev;
        });
    };

    const handleBan = (placeId, type) => {
        const newBanned = [...bannedIds, placeId];
        setBannedIds(newBanned);
        setSelections((prev) => ({ ...prev, [type]: nextCandidate(type, prev, newBanned) }));
    };

    const onVoteUI = (place, val) => {
        if (place.types) savePreference(place.types, val);
        setSessionVotes((prev) => ({ ...prev, [place.place_id]: val }));
    };

    const toggleFilter = (id) => {
        setSelectedFilters((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    const renderCard = (lane, key) =>
        selections?.[lane] && (
            <RestaurantCard
                key={key}
                place={selections[lane]}
                type={lane}
                onVote={onVoteUI}
                userVote={sessionVotes[selections[lane].place_id]}
                onSwap={() => handleSwap(lane)}
                onBan={() => handleBan(selections[lane].place_id, lane)}
            />
        );

    return (
        <div className="min-h-screen bg-paper text-ink p-4 md:p-8 font-sans overflow-x-hidden">
            {!apiKey ? (
                <SetupModal onComplete={handleSetupComplete} />
            ) : !userLocation ? (
                <div className="fixed inset-0 flex flex-col items-center justify-center bg-paper z-50">
                    <div className="w-16 h-16 bg-ink text-white p-3 rounded-2xl mb-6 shadow-xl animate-bounce">
                        <MapPin className="w-full h-full" />
                    </div>
                    <h2 className="text-2xl font-serif font-bold mb-2">Locating you&hellip;</h2>
                    <p className="text-stone-400 italic">
                        Chef&rsquo;s Choice is finding your current position.
                    </p>
                    {error && (
                        <div className="mt-8 p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 max-w-sm text-center">
                            {error}
                            <button
                                onClick={requestLocation}
                                className="block w-full mt-2 text-sm font-bold underline"
                            >
                                Try Again
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <APIProvider apiKey={apiKey} libraries={LIBRARIES}>
                    <div style={{ display: 'none' }}>
                        <Map center={userLocation} zoom={15} />
                    </div>

                    <GameLogic
                        apiKey={apiKey}
                        userLocation={userLocation}
                        radiusKm={debouncedRadius}
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
                            <h1 className="text-2xl font-serif font-bold">Chef&rsquo;s Choice</h1>
                        </div>

                        <div
                            className="bg-white px-4 py-2 rounded-full shadow-sm border border-stone-100 flex items-center space-x-3 text-xs md:text-sm cursor-help"
                            title="Estimated cost against free tier"
                        >
                            <div className="flex flex-col items-end">
                                <span className="font-bold text-ink">
                                    ${usage.cost.toFixed(2)} / $200
                                </span>
                                <span className="text-gray-400">{usage.calls} calls</span>
                            </div>
                            <div className="w-8 h-8 relative">
                                <svg className="w-full h-full transform -rotate-90">
                                    <circle cx="16" cy="16" r="14" stroke="#e5e7eb" strokeWidth="3" fill="none" />
                                    <circle
                                        cx="16"
                                        cy="16"
                                        r="14"
                                        stroke={usage.percentUsed > 80 ? '#ef4444' : '#22c55e'}
                                        strokeWidth="3"
                                        fill="none"
                                        strokeDasharray="88"
                                        strokeDashoffset={88 - (88 * usage.percentUsed) / 100}
                                    />
                                </svg>
                            </div>
                        </div>
                    </header>

                    <main className="max-w-6xl mx-auto">
                        <div className="mb-8 flex flex-col items-center space-y-6">
                            <div className="w-full max-w-2xl px-4 flex flex-col items-center">
                                <TimeSlider radiusKm={radiusKm} setRadiusKm={setRadiusKm} />

                                <button
                                    onClick={() => {
                                        setIsAdventureMode((prev) => !prev);
                                        if (selections) handleSpin();
                                    }}
                                    aria-pressed={isAdventureMode}
                                    className={`mt-4 flex items-center space-x-2 px-4 py-2 rounded-full border transition-colors duration-300 ${
                                        isAdventureMode
                                            ? 'bg-amber-100 border-amber-300 text-amber-800'
                                            : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                                    }`}
                                >
                                    {isAdventureMode ? (
                                        <Car className="w-5 h-5" />
                                    ) : (
                                        <Armchair className="w-5 h-5" />
                                    )}
                                    <span className="text-sm font-medium">
                                        {isAdventureMode
                                            ? 'Adventure Mode: ON (Go Far)'
                                            : 'Standard Mode (Stay Close)'}
                                    </span>
                                </button>
                            </div>

                            <div className="w-full max-w-3xl">
                                <CategoryFilter selectedCategories={selectedFilters} onToggle={toggleFilter} />
                            </div>

                            <button
                                onClick={handleSpin}
                                disabled={isSpinning}
                                className={`btn-timeless h-16 w-16 md:w-auto md:px-8 flex items-center justify-center space-x-2 ${
                                    isSpinning ? 'animate-pulse' : ''
                                }`}
                            >
                                <RefreshCw className={`w-6 h-6 ${isSpinning ? 'animate-spin-slow' : ''}`} />
                                <span className="hidden md:inline">
                                    {spinTrigger === 0 ? 'Spin' : 'Spin Again'}
                                </span>
                            </button>
                        </div>

                        {error && (
                            <div className="max-w-md mx-auto mb-8 p-4 bg-red-50 text-red-600 rounded-xl text-center border border-red-100">
                                {error}
                            </div>
                        )}

                        <div className="w-full min-h-[400px]">
                            <AnimatePresence mode="wait">
                                {isSpinning ? (
                                    <SlotMachine key="slots" candidates={candidatePlaces} />
                                ) : (
                                    <div key="board" className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                        {renderCard('bestRated', 'best')}
                                        {renderCard('hiddenGem', 'hidden')}
                                        {renderCard('wildcard', 'wild')}
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
