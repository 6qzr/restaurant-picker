/** Apple's two-parameter spring model (damping ratio + response), expressed in
 *  framer-motion's bounce/duration terms.
 *
 *  Default is critically damped: overshoot on something that merely appeared
 *  reads as wrong. Bounce is reserved for motion the user's own gesture put
 *  momentum into.
 */
export const springs = {
    ui: { type: 'spring', bounce: 0, duration: 0.35 },
    reposition: { type: 'spring', bounce: 0, duration: 0.4 },
    momentum: { type: 'spring', bounce: 0.2, duration: 0.4 },
    sheet: { type: 'spring', bounce: 0.2, duration: 0.3 },
};

/** Reduced motion means a gentler equivalent, not the absence of feedback. */
export const reducedSprings = {
    ui: { duration: 0.18, ease: 'easeOut' },
    reposition: { duration: 0.18, ease: 'easeOut' },
    momentum: { duration: 0.18, ease: 'easeOut' },
    sheet: { duration: 0.15, ease: 'easeOut' },
};

export const springSet = (reduced) => (reduced ? reducedSprings : springs);
