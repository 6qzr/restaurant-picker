import React, { useState, useEffect, useCallback } from 'react';
import { APIProvider, Map, useMap } from '@vis.gl/react-google-maps';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, MapPin } from 'lucide-react';

import SetupModal from './components/SetupModal';
import TimeSlider from './components/TimeSlider';
import RestaurantCard from './components/RestaurantCard';
import { searchNearbyPlaces } from './services/googleMaps';
import { pickSelections } from './utils/pickerLogic';
import { convertMinutesToRadius } from './utils/geometry';
import { savePreference, getPreferences } from './services/storage';
import { getUsageStats, resetUsage } from './services/usageTracker';

const MAX_RETRIES = 3;

// Inner component to access Map instance
const GameLogic = ({ apiKey, userLocation, maxTime, triggerSpin, onSpinComplete }) => {
    const map = useMap();
    const [allPlaces, setAllPlaces] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    // Search when location or time changes (debounced ideal, but simple for now)
    useEffect(() => {
        if (!map || !userLocation || !apiKey) return;

        const radius = convertMinutesToRadius(maxTime);
        const fetchData = async () => {
            setIsSearching(true);
            try {
                // Initialize/Move map to user location without UI 
                // We don't render the map visible, but we need the instance
                const results = await searchNearbyPlaces(map, userLocation, radius);
                setAllPlaces(results);
            } catch (err) {
                console.error("Search failed", err);
            } finally {
                setIsSearching(false);
            }
        };

        fetchData();
    }, [map, userLocation, maxTime, apiKey]);

    // Handle Spin
    useEffect(() => {
        if (triggerSpin && allPlaces.length > 0) {
            const result = pickSelections(allPlaces);
            // Simulate "Thinking" time for effect
            setTimeout(() => {
                onSpinComplete(result);
            }, 800);
        } else if (triggerSpin && allPlaces.length === 0 && !isSearching) {
            onSpinComplete(null); // No results
        }
    }, [triggerSpin, allPlaces, isSearching, onSpinComplete]);

    return null; // Logic only, no UI
};

const App = () => {
    const [apiKey, setApiKey] = useState(localStorage.getItem('restaurant_picker_api_key') || '');
    const [userLocation, setUserLocation] = useState(null);
    const [maxTime, setMaxTime] = useState(15); // Default 15 mins
    const [spinTrigger, setSpinTrigger] = useState(0);
    const [isSpinning, setIsSpinning] = useState(false);
    const [selections, setSelections] = useState(null);
    const [preferences, setPreferences] = useState(getPreferences());
    const [error, setError] = useState('');
    const [usage, setUsage] = useState(getUsageStats()); // New State

    // Setup Handler
    const handleSetupComplete = (key) => {
        setApiKey(key);
        localStorage.setItem('restaurant_picker_api_key', key);

        // Get Location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                (err) => {
                    setError("Location permission denied. We need it to find food!");
                }
            );
        } else {
            setError("Geolocation not supported by this browser.");
        }
    };

    const handleSpin = () => {
        setIsSpinning(true);
        setSelections(null); // clear old
        setSpinTrigger(prev => prev + 1);
    };

    // Update usage when spinning (since that's when we fetch/track)
    // Actually, the GameLogic does the fetch, so we should sync usage there or poll it?
    // Simplest is to check it after spin complete.
    const handleSpinComplete = useCallback((result) => {
        setIsSpinning(false);
        setUsage(getUsageStats()); // Update stats
        if (!result) {
            setError("No acceptable restaurants found nearby. Try increasing the time radius!");
        } else {
            setSelections(result);
            setError('');
        }
    }, []);

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


    return (
        <div className="min-h-screen bg-paper text-ink p-4 md:p-8 font-sans overflow-x-hidden">
            {!apiKey || !userLocation ? (
                <SetupModal onComplete={handleSetupComplete} />
            ) : (
                <APIProvider apiKey={apiKey}>
                    {/* Invisible Map for Service Access */}
                    <div style={{ display: 'none' }}>
                        <Map center={userLocation} zoom={15} />
                    </div>

                    <GameLogic
                        apiKey={apiKey}
                        userLocation={userLocation}
                        maxTime={maxTime}
                        triggerSpin={spinTrigger}
                        onSpinComplete={handleSpinComplete}
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
                        <div className="mb-12 flex flex-col md:flex-row items-center justify-center space-y-6 md:space-y-0 md:space-x-8">
                            <TimeSlider minutes={maxTime} setMinutes={setMaxTime} />

                            <button
                                onClick={handleSpin}
                                disabled={isSpinning}
                                className={`btn-timeless h-16 w-16 md:w-auto md:px-8 flex items-center justify-center space-x-2 ${isSpinning ? 'animate-pulse' : ''}`}
                            >
                                <RefreshCw className={`w-6 h-6 ${isSpinning ? 'animate-spin-slow' : ''}`} />
                                <span className="hidden md:inline">Spin Again</span>
                            </button>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="max-w-md mx-auto mb-8 p-4 bg-red-50 text-red-600 rounded-xl text-center border border-red-100">
                                {error}
                            </div>
                        )}

                        {/* Cards Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 min-h-[400px]">
                            <AnimatePresence mode="wait">
                                {isSpinning ? (
                                    // Loading Skeletons or Empty State
                                    <motion.div
                                        key="loading"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="col-span-3 flex items-center justify-center h-64"
                                    >
                                        <div className="flex flex-col items-center space-y-4">
                                            <div className="w-12 h-12 border-4 border-gold border-t-transparent rounded-full animate-spin"></div>
                                            <p className="text-gray-500 font-serif italic text-lg">Consulting the culinary gods...</p>
                                        </div>
                                    </motion.div>
                                ) : selections ? (
                                    <>
                                        <RestaurantCard
                                            key={selections.bestRated.place_id}
                                            place={selections.bestRated}
                                            type="bestRated"
                                            onVote={onVoteUI}
                                            votedState={sessionVotes[selections.bestRated.place_id]}
                                        />
                                        <RestaurantCard
                                            key={selections.hiddenGem.place_id}
                                            place={selections.hiddenGem}
                                            type="hiddenGem"
                                            onVote={onVoteUI}
                                            votedState={sessionVotes[selections.hiddenGem.place_id]}
                                        />
                                        <RestaurantCard
                                            key={selections.wildcard ? selections.wildcard.place_id : 'none'}
                                            place={selections.wildcard}
                                            type="wildcard"
                                            onVote={onVoteUI}
                                            votedState={selections.wildcard ? sessionVotes[selections.wildcard.place_id] : 0}
                                        />
                                    </>
                                ) : !error && (
                                    <div className="col-span-3 flex items-center justify-center h-64 text-gray-400">
                                        Ready to choose? Hit the spin button.
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
