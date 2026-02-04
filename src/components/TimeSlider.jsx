import React from 'react';
import { MapPin } from 'lucide-react';

const TimeSlider = ({ radiusKm, setRadiusKm }) => {
    // Config: 1km to 50km
    const min = 1;
    const max = 50;

    // Visual fill calculation
    const percentage = ((radiusKm - min) / (max - min)) * 100;

    return (
        <div className="w-full max-w-sm mx-auto bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2 text-ink">
                    <MapPin className="w-5 h-5 text-gold" />
                    <span className="font-semibold text-lg">Search Radius</span>
                </div>
                <div className="text-2xl font-serif font-bold text-ink">
                    {radiusKm} <span className="text-sm font-sans font-normal text-gray-500">km</span>
                </div>
            </div>

            <div className="relative h-6 flex items-center">
                {/* Track Background */}
                <div className="absolute w-full h-2 bg-stone-200 rounded-full overflow-hidden">
                    {/* Fill */}
                    <div
                        className="h-full bg-gold transition-all duration-150 ease-out"
                        style={{ width: `${percentage}%` }}
                    />
                </div>

                {/* Input */}
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={1}
                    value={radiusKm}
                    onChange={(e) => setRadiusKm(Number(e.target.value))}
                    className="absolute w-full h-full opacity-0 cursor-pointer z-10"
                />

                {/* Thumb */}
                <div
                    className="absolute h-6 w-6 bg-white border-2 border-gold rounded-full shadow-md pointer-events-none transition-all duration-150 ease-out"
                    style={{
                        left: `calc(${percentage}% - 12px)`
                    }}
                />
            </div>

            <p className="text-xs text-center text-gray-400 mt-3">
                Roughly {Math.round((radiusKm / 30) * 60)} mins drive
            </p>
        </div>
    );
};

export default TimeSlider;
