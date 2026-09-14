import { useEffect, useState } from 'react';

const query = (q) => (typeof matchMedia === 'function' ? matchMedia(q) : null);

const useMedia = (q) => {
    const [on, setOn] = useState(() => query(q)?.matches ?? false);
    useEffect(() => {
        const mq = query(q);
        if (!mq) return undefined;
        const handler = (e) => setOn(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, [q]);
    return on;
};

/** Three independent signals, each with its own gentler equivalent rather than
 *  a blanket "turn everything off". */
export const useUserMotionPrefs = () => ({
    reducedMotion: useMedia('(prefers-reduced-motion: reduce)'),
    reducedTransparency: useMedia('(prefers-reduced-transparency: reduce)'),
    moreContrast: useMedia('(prefers-contrast: more)'),
});
