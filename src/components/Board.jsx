import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Compass, Plus } from 'lucide-react';
import SwipeableCard from './SwipeableCard.jsx';
import { springSet } from '../motion/springs.js';

/** Every card reserves the same height.
 *
 *  Measured: cards came in exactly two heights, 26px apart, depending on
 *  whether the place had OSM opening hours or a takeaway tag. In one column
 *  that means swapping a card moved everything below it by 26px and left it
 *  there, which reads as the layout coming apart rather than as one card
 *  changing. Reserving the taller height costs nothing -- the footer is
 *  bottom-pinned, so the slack lands where nobody looks. */
const CARD_MIN_H = 'min-h-[24rem]';

/** Explicit emptiness beats a duplicate tier.
 *
 *  The old app filled an unfillable "Hidden Gem" slot from the best-rated pool,
 *  so two cards silently showed the same kind of place. A lane that genuinely
 *  cannot be filled now says so, and offers the one action that fixes it. */
const EmptyLane = ({ slot, onWiden }) => (
    <div
        className={`card h-full ${CARD_MIN_H} flex flex-col items-center justify-center text-center gap-3 p-6`}
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
    </div>
);

export const Board = ({
    board, enrichments, votes, reduced, onVote, onSwap, onVeto, onChoose, onWiden,
    newSincePick, onRespin,
}) => {
    const S = springSet(reduced);

    /** A whole new board reveals on a stagger; a single swapped card should not
     *  wait its turn behind cards that are not moving. `swapLane` keeps the
     *  seed, so the seed is what separates the two. */
    const lastSeed = useRef(board?.seed);
    const wholeBoard = lastSeed.current !== board?.seed;
    useEffect(() => {
        lastSeed.current = board?.seed;
    });

    if (!board) return null;

    return (
        <div className="w-full">
            <div className="grid gap-4 md:gap-5 grid-cols-1 md:grid-cols-3">
                {board.slots.map((slot, i) => (
                    /* One cell per lane, mounted for the life of the board.
                       Keying the grid children by place id instead meant a swap
                       put FOUR cards in the grid for ~450ms while the old one
                       exited, so the surviving cards were re-laid-out twice --
                       once to make room and once to close the gap. The cell
                       stays; only its contents change. */
                    <div key={slot.lane} className={`relative h-full ${CARD_MIN_H}`}>
                        <AnimatePresence initial={false} mode="popLayout">
                            <motion.div
                                key={slot.place?.id ?? 'empty'}
                                className="h-full"
                                initial={{ opacity: 0, y: reduced ? 0 : 18, scale: reduced ? 1 : 0.96 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, scale: reduced ? 1 : 0.94 }}
                                transition={{
                                    ...S.momentum,
                                    delay: reduced || !wholeBoard ? 0 : i * 0.09,
                                }}
                            >
                                {slot.empty ? (
                                    <EmptyLane slot={slot} onWiden={onWiden} />
                                ) : (
                                    <SwipeableCard
                                        slot={slot}
                                        enrichment={enrichments.get(slot.place.id)}
                                        userVote={votes?.[slot.place.id]}
                                        reduced={reduced}
                                        onVote={onVote}
                                        onSwap={onSwap}
                                        onVeto={onVeto}
                                        onChoose={onChoose}
                                    />
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                ))}
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
