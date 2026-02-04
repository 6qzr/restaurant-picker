import React, { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';

const SlotCard = ({ title, pool }) => {
    const [currentName, setCurrentName] = useState("Thinking...");

    useEffect(() => {
        if (!pool || pool.length === 0) return;

        const interval = setInterval(() => {
            const random = pool[Math.floor(Math.random() * pool.length)];
            setCurrentName(random.name);
        }, 100); // Fast shuffle

        return () => clearInterval(interval);
    }, [pool]);

    return (
        <div className="bg-white p-6 rounded-3xl opacity-80 border-2 border-dashed border-stone-200 flex flex-col items-center justify-center space-y-4 h-full min-h-[300px]">
            <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center animate-spin-slow">
                <Sparkles className="w-8 h-8 text-stone-400" />
            </div>
            <div className="text-center">
                <span className="text-xs font-bold tracking-widest text-stone-400 uppercase mb-2 block">{title}</span>
                <h3 className="text-xl font-serif font-bold text-ink truncate max-w-[200px] mx-auto animate-pulse">
                    {currentName}
                </h3>
            </div>
        </div>
    );
};

const SlotMachine = ({ candidates }) => {
    // We treat the whole candidates list as one big pool for the visual effect
    // But ideally we'd split them into likely buckets if we had them.
    // For now, random noise is fine.

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full opacity-100 transition-opacity duration-500">
            <SlotCard title="Best Rated" pool={candidates} />
            <SlotCard title="Hidden Gem" pool={candidates} />
            <SlotCard title="Wildcard" pool={candidates} />
        </div>
    );
}

export default SlotMachine;
