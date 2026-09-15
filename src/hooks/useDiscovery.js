import { useEffect, useRef } from 'react';
import { useStore } from '../store/index.js';
import { createSweep } from '../engine/discovery/sweep.js';
import { loadAllSeen } from '../engine/history/seenStore.js';
import { loadPrefs } from '../data/prefsRepo.js';

/** Starts (and restarts) the background sweep when the search area changes.
 *
 *  Deliberately does NOT trigger a pick. The old app re-ran its selection
 *  whenever results arrived, which is how vetoing a place silently replaced the
 *  entire board two seconds later.
 */
export const useDiscovery = () => {
    const location = useStore((s) => s.location);
    const radiusKm = useStore((s) => s.radiusKm);
    const addPlaces = useStore((s) => s.addPlaces);
    const resetPool = useStore((s) => s.resetPool);
    const setSweep = useStore((s) => s.setSweep);
    const setSeen = useStore((s) => s.setSeen);
    const setPrefs = useStore((s) => s.setPrefs);
    const sweepRef = useRef(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const [seen, prefs] = await Promise.all([loadAllSeen(), loadPrefs()]);
            if (!cancelled) {
                setSeen(seen);
                setPrefs(prefs);
            }
        })();
        return () => { cancelled = true; };
    }, [setSeen, setPrefs]);

    useEffect(() => {
        if (!location) return undefined;

        resetPool();
        const sweep = createSweep({
            onBatch: (places) => addPlaces(places),
            onProgress: (p) => setSweep(p),
        });
        sweepRef.current = sweep;
        sweep.start(location, radiusKm).catch((err) => {
            console.warn('[sweep] aborted', err?.message);
            setSweep({ phase: 'error', fetched: 0, toFetch: 0, total: 0 });
        });

        return () => sweep.abort();
    }, [location, radiusKm, addPlaces, resetPool, setSweep]);
};
