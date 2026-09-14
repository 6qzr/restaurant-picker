import { useCallback, useRef } from 'react';
import { velocityFrom } from '../motion/project.js';

/**
 * 1:1 pointer tracking on Pointer Events.
 *
 * framer-motion's own `drag` is deliberately not used: it gives no control over
 * the grab offset, no velocity history we own, rubber-banding that is not
 * Apple's curve, and it hides the release decision we need to make ourselves.
 * The gesture layer is ours; the spring engine stays framer's.
 */
export const useDrag = ({ onStart, onMove, onEnd, axisLockPx = 10 } = {}) => {
    const state = useRef(null);

    const handlePointerDown = useCallback(
        (e) => {
            if (e.button != null && e.button !== 0) return;
            const el = e.currentTarget;
            el.setPointerCapture?.(e.pointerId);
            const rect = el.getBoundingClientRect();
            state.current = {
                id: e.pointerId,
                // Respect where they actually grabbed it -- snapping to the
                // centre breaks the illusion instantly.
                grabX: e.clientX - rect.left,
                grabY: e.clientY - rect.top,
                startX: e.clientX,
                startY: e.clientY,
                axis: null,
                width: rect.width,
                height: rect.height,
                samples: [{ x: e.clientX, y: e.clientY, t: performance.now() }],
            };
            onStart?.({ width: rect.width, height: rect.height });
        },
        [onStart]
    );

    const handlePointerMove = useCallback(
        (e) => {
            const s = state.current;
            if (!s || e.pointerId !== s.id) return;

            const dx = e.clientX - s.startX;
            const dy = e.clientY - s.startY;

            // Both recognizers stay armed until intent is clear, then the loser
            // is cancelled -- rather than committing on the first pixel.
            if (!s.axis && Math.hypot(dx, dy) > axisLockPx) {
                s.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
            }

            s.samples.push({ x: e.clientX, y: e.clientY, t: performance.now() });
            if (s.samples.length > 6) s.samples.shift();

            if (s.axis) onMove?.({ dx, dy, axis: s.axis, width: s.width, height: s.height });
        },
        [onMove, axisLockPx]
    );

    const finish = useCallback(
        (e) => {
            const s = state.current;
            if (!s || (e.pointerId != null && e.pointerId !== s.id)) return;
            state.current = null;

            const dx = e.clientX - s.startX;
            const dy = e.clientY - s.startY;
            const vx = velocityFrom(s.samples.map((p) => ({ x: p.x, t: p.t })));
            const vy = velocityFrom(s.samples.map((p) => ({ x: p.y, t: p.t })));

            onEnd?.({
                dx,
                dy,
                vx,
                vy,
                axis: s.axis,
                width: s.width,
                height: s.height,
                tapped: !s.axis && Math.hypot(dx, dy) < axisLockPx,
            });
        },
        [onEnd, axisLockPx]
    );

    return {
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: finish,
        onPointerCancel: finish,
    };
};
