import { useCallback, useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { X } from 'lucide-react';
import { useDrag } from '../hooks/useDrag.js';
import { useHaptics } from '../hooks/useHaptics.js';
import { project, rubberband } from '../motion/project.js';
import { springSet } from '../motion/springs.js';
import PlaceCard from './PlaceCard.jsx';

/**
 * Swipe a card away to veto it.
 *
 * The gesture rules this implements:
 *  - feedback on pointer DOWN, not on release
 *  - 1:1 tracking the whole way, no easing while the finger is down
 *  - the commit decision uses the PROJECTED resting position, so a fast short
 *    flick vetoes while a slow long drag released on the way back does not
 *  - release velocity is handed to the spring, so there is no seam between
 *    dragging and animating
 *  - grabbing a card mid-flight stops it and re-grabs at its live position
 */
export const SwipeableCard = ({ slot, enrichment, reduced, onVeto, ...cardProps }) => {
    const x = useMotionValue(0);
    const [dragging, setDragging] = useState(false);
    const widthRef = useRef(1);
    const committedRef = useRef(false);
    const haptic = useHaptics();
    const S = springSet(reduced);

    const rotate = useTransform(x, (v) => (reduced ? 0 : Math.max(-9, Math.min(9, v / 22))));
    const vetoOpacity = useTransform(x, [-120, -40, 0, 40, 120], [1, 0, 0, 0, 1]);
    // The replacement behind scales up as you drag, so the outcome is legible
    // before release rather than only after it.
    const behindScale = useTransform(x, (v) => {
        const p = Math.min(1, Math.abs(v) / (widthRef.current * 0.5 || 1));
        return 0.94 + 0.06 * p;
    });

    const handleStart = useCallback(({ width }) => {
        widthRef.current = width;
        committedRef.current = false;
        // Interruptible: grabbing a card in flight stops it where it is.
        x.stop();
        setDragging(true);
        haptic(8);
    }, [x, haptic]);

    const handleMove = useCallback(({ dx, dy, axis, height }) => {
        if (axis === 'x') {
            x.set(dx);
        } else {
            // Vertical is bounded -- resist rather than hard-stop.
            x.set(rubberband(dy, height) * 0.15);
        }
    }, [x]);

    const handleEnd = useCallback(({ vx, axis, width, tapped }) => {
        setDragging(false);
        if (tapped || axis !== 'x') {
            animate(x, 0, { ...S.momentum, velocity: vx });
            return;
        }

        const projected = x.get() + project(vx);
        const commit = Math.abs(projected) > width * 0.5;

        if (commit && !committedRef.current) {
            committedRef.current = true;
            // Visual, haptic and state change land together, on this frame.
            haptic(12);
            const dir = Math.sign(projected) || 1;
            animate(x, dir * window.innerWidth * 1.1, { ...S.momentum, velocity: vx });
            onVeto?.();
            // Reset behind the replacement, which mounts at the same position.
            setTimeout(() => x.set(0), reduced ? 160 : 260);
        } else {
            animate(x, 0, { ...S.momentum, velocity: vx });
        }
    }, [x, S, haptic, onVeto, reduced]);

    const drag = useDrag({ onStart: handleStart, onMove: handleMove, onEnd: handleEnd });

    return (
        <div className="relative h-full">
            {/* Peeking replacement */}
            <motion.div
                className="absolute inset-0 pointer-events-none"
                style={{ scale: behindScale, opacity: useTransform(x, (v) => Math.min(0.6, Math.abs(v) / 160)) }}
                aria-hidden="true"
            >
                <div className="card h-full" />
            </motion.div>

            <motion.div
                {...drag}
                style={{ x, rotate, touchAction: 'pan-y', cursor: dragging ? 'grabbing' : 'grab' }}
                className="relative h-full"
                animate={{ scale: dragging ? 0.985 : 1 }}
                transition={{ duration: 0.1, ease: 'easeOut' }}
            >
                <motion.div
                    className="absolute inset-0 z-10 grid place-items-center pointer-events-none rounded-[var(--radius)]"
                    style={{ opacity: vetoOpacity, background: 'rgba(194,69,47,0.14)' }}
                    aria-hidden="true"
                >
                    <span
                        className="meta flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white"
                        style={{ background: 'var(--danger)' }}
                    >
                        <X className="w-3.5 h-3.5" /> Veto
                    </span>
                </motion.div>

                <PlaceCard slot={slot} enrichment={enrichment} dragging={dragging} onVeto={onVeto} {...cardProps} />
            </motion.div>
        </div>
    );
};

export default SwipeableCard;
