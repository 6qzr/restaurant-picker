import React from 'react';
import { Clock } from 'lucide-react';

const TimeSlider = ({ minutes, setMinutes }) => {
    // Config: 5 mins to 60 mins
    const min = 5;
    const max = 60;

    // Visual fill calculation
    const percentage = ((minutes - min) / (max - min)) * 100;

    return (
        <div className="w-full max-w-sm mx-auto bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2 text-ink">
                    <Clock className="w-5 h-5 text-gold" />
                    <span className="font-semibold text-lg">Travel Time</span>
                </div>
                <div className="text-2xl font-serif font-bold text-ink">
                    {minutes} <span className="text-sm font-sans font-normal text-gray-500">mins</span>
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
                    step={5}
                    value={minutes}
                    onChange={(e) => setMinutes(Number(e.target.value))}
                    className="absolute w-full h-full opacity-0 cursor-pointer z-10"
                />

                {/* Thumb (Visual Only - centered by calculation if we wanted custom thumb, 
            but native thumb is often better for a11y. 
            We'll stick to native behavior with custom track for now, 
            or use a styled div follower if requested. 
            For simplicity and robustness, native input is used invisible on top.) 
        */}
                <div
                    className="absolute h-6 w-6 bg-white border-2 border-gold rounded-full shadow-md pointer-events-none transition-all duration-150 ease-out"
                    style={{
                        left: `calc(${percentage}% - 12px)`
                    }}
                />
            </div>

            <p className="text-xs text-center text-gray-400 mt-3">
                Est. Radius: {((minutes * 30) / 60).toFixed(1)} km (Driving)
            </p>
        </div>
    );
};

export default TimeSlider;
