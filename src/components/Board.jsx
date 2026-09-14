import { motion, AnimatePresence } from 'framer-motion';
import { Compass, Plus } from 'lucide-react';
import SwipeableCard from './SwipeableCard.jsx';
import { springSet } from '../motion/springs.js';

/** Explicit emptiness beats a duplicate tier.
 *
 *  The old app filled an unfillable "Hidden Gem" slot from the best-rated pool,
 *  so two cards silently showed the same kind of place. A lane that genuinely
 *  cannot be filled now says so, and offers the one action that fixes it. */
const EmptyLane = ({ slot, onWiden, reduced }) => (
    <motion.div
        layout={!reduced}
        className="card h-full min-h-[22rem] flex flex-col items-center justify-center text-center gap-3 p-6"
        style={{ borderStyle: 'dashed' }}
    >
        <Compass className="w-7 h-7" style={{ color: 'var(--ink-3)' }} />
        <p className="meta" style={{ color: 'var(--ink-3)' }}>{slot.label}</p>
        <p className="text-sm" style={{ color: 'var(--ink-2)' }}>
            {slot.emptyMessage ?? 'Nothing new to show here right now.'}
        </p>
        <button type="button" onClick={onWiden} className="btn px-4 py-2 text-sm mt-1"
            style={{ background: 'var(--ink)', color: 'var(--paper)' }}>
            Search further out
        </button>
    </motion.div>
);

export const Board = ({
    board, enrichments, votes, reduced, onVote, onSwap, onVeto, onChoose, onWiden,
    newSincePick, onRespin,
}) => {
    const S = springSet(reduced);
    if (!board) return null;

    return (
        <div className="w-full">
            <div className="grid gap-4 md:gap-5 grid-cols-1 md:grid-cols-3">
                <AnimatePresence initial={false} mode="popLayout">
                    {board.slots.map((slot, i) => (
                        <motion.div
                            key={slot.lane + (slot.place?.id ?? 'empty')}
                            layout={!reduced}
                            initial={{ opacity: 0, y: reduced ? 0 : 18, scale: reduced ? 1 : 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: reduced ? 1 : 0.94 }}
                            /* 90ms stagger: the reveal is driven by data arriving,
                               not by a fixed timer pretending to think. */
                            transition={{ ...S.momentum, delay: reduced ? 0 : i * 0.09 }}
                        >
                            {slot.empty ? (
                                <EmptyLane slot={slot} onWiden={onWiden} reduced={reduced} />
                            ) : (
                                <SwipeableCard
                                    slot={slot}
                                    enrichment={enrichments.get(slot.place.id)}
                                    userVote={votes?.[slot.place.id]}
                                    reduced={reduced}
                                    onVote={onVote}
                                    onSwap={() => onSwap(slot.lane)}
                                    onVeto={() => onVeto(slot.lane)}
                                    onChoose={onChoose}
                                />
                            )}
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Pool growth is an invitation, never an automatic re-roll. */}
            <AnimatePresence>
                {newSincePick > 12 && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={S.ui}
                        className="flex justify-center mt-4"
                    >
                        <button type="button" onClick={onRespin}
                            className="btn inline-flex items-center gap-1.5 px-4 py-2 text-sm card">
                            <Plus className="w-3.5 h-3.5" />
                            {newSincePick} more places found &mdash; spin again?
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Board;
