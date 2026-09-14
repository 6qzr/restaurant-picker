import { useCallback, useEffect } from 'react';
import { useStore } from '../store/index.js';

const CACHE_KEY = 'cc_last_location';

export const useGeolocation = () => {
    const location = useStore((s) => s.location);
    const error = useStore((s) => s.locationError);
    const setLocation = useStore((s) => s.setLocation);
    const setError = useStore((s) => s.setLocationError);

    const request = useCallback(() => {
        if (!navigator.geolocation) {
            setError('This browser cannot share your location.');
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
                setLocation(loc);
                try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(loc)); } catch { /* ignore */ }
            },
            (err) => {
                setError(
                    err.code === err.PERMISSION_DENIED
                        ? 'Location permission denied. Chef’s Choice needs it to find places near you.'
                        : 'Could not get your location. Try again?'
                );
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
        );
    }, [setLocation, setError]);

    useEffect(() => {
        if (location) return;
        try {
            const cached = sessionStorage.getItem(CACHE_KEY);
            if (cached) {
                setLocation(JSON.parse(cached));
                return;
            }
        } catch { /* ignore */ }
        request();
        // Intentionally runs once: request() is stable and setLocation ends it.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { location, error, request };
};
