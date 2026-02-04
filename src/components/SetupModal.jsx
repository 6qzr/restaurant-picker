import React, { useState } from 'react';
import { MapPin, Key } from 'lucide-react';

const SetupModal = ({ onComplete }) => {
    const [apiKey, setApiKey] = useState('');
    const [step, setStep] = useState(1); // 1: Info, 2: Key (if needed)

    // Check if we already have env var
    const hasEnvKey = !!import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

    const handleStart = () => {
        if (hasEnvKey) {
            onComplete(import.meta.env.VITE_GOOGLE_MAPS_API_KEY);
        } else {
            setStep(2);
        }
    };

    const handleKeySubmit = (e) => {
        e.preventDefault();
        if (apiKey.trim()) {
            onComplete(apiKey.trim());
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm">
            <div className="bg-white max-w-md w-full p-8 rounded-3xl shadow-2xl text-center">

                {step === 1 && (
                    <>
                        <div className="w-16 h-16 bg-gold/20 rounded-full flex items-center justify-center mx-auto mb-6">
                            <MapPin className="w-8 h-8 text-gold" />
                        </div>
                        <h2 className="text-2xl font-serif font-bold text-ink mb-3">Restaurant Picker</h2>
                        <p className="text-gray-500 mb-8">
                            Find the best places to eat around you. We'll need your location to find hidden gems nearby.
                        </p>
                        <button
                            onClick={handleStart}
                            className="btn-timeless w-full"
                        >
                            Let's Eat
                        </button>
                    </>
                )}

                {step === 2 && (
                    <form onSubmit={handleKeySubmit}>
                        <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Key className="w-8 h-8 text-stone-400" />
                        </div>
                        <h2 className="text-xl font-bold text-ink mb-3">API Key Required</h2>
                        <p className="text-sm text-gray-500 mb-6">
                            This demo requires a Google Maps API Key to fetch real-world data.
                        </p>

                        <input
                            type="text"
                            placeholder="Paste API Key here..."
                            className="w-full px-4 py-3 rounded-xl border border-stone-200 mb-2 focus:ring-2 focus:ring-gold focus:outline-none"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                        />

                        <p className="text-xs text-gray-400 mb-6 text-left ml-1">
                            Don't have one? <a href="https://developers.google.com/maps/documentation/javascript/get-api-key" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline font-medium">Get a key here</a>
                        </p>

                        <button
                            type="submit"
                            disabled={!apiKey}
                            className="btn-timeless w-full"
                        >
                            Continue
                        </button>
                    </form>
                )}

            </div>
        </div>
    );
};

export default SetupModal;
