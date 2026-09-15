import { useCallback } from 'react';
import { useStore } from '../store/index.js';

/** Haptics fire on the same frame as the decision they describe -- not when an
 *  animation ends. Latency between the senses is what destroys the illusion. */
export const useHaptics = () => {
    const enabled = useStore((s) => s.haptics !== false);
    return useCallback(
        (ms = 10) => {
            if (!enabled) return;
            try {
                navigator.vibrate?.(ms);
            } catch {
                /* unsupported (iOS Safari): silent no-op */
            }
        },
        [enabled]
    );
};
