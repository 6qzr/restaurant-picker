import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, Users, Trophy } from 'lucide-react';
import Sheet from './primitives/Sheet.jsx';
import { boardToUrl } from '../share/codec.js';
import { Bidi } from './primitives/Bidi.jsx';
import { springSet } from '../motion/springs.js';

export const ShareSheet = ({
    open, onClose, board, center, radiusKm, temperature, adventure, chips, seed,
    voters, votes, revealed, onAddVoter, onCastVote, onReveal, onResetVoting, reduced, tally,
}) => {
    const [copied, setCopied] = useState(false);
    const [name, setName] = useState('');

    const url = useMemo(() => {
        if (!board) return '';
        return boardToUrl({
            center: { lat: center?.lat ?? 0, lon: center?.lon ?? 0 },
            radiusKm, temperature, adventure, chips, seed: seed ?? 0,
            placeIds: board.slots.map((s) => s.place?.id).filter(Boolean),
        });
    }, [board, center, radiusKm, temperature, adventure, chips, seed]);

    const copy = async () => {
        try {
            if (navigator.share) {
                await navigator.share({ title: "Chef's Choice", text: 'Where should we eat?', url });
                return;
            }
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch {
            /* user dismissed the share sheet */
        }
    };

    const winner = revealed ? tally[0] : null;

    return (
        <Sheet open={open} onClose={onClose} title="Decide together" reduced={reduced}>
            <button type="button" onClick={copy}
                className="btn w-full h-11 mb-2 inline-flex items-center justify-center gap-2 text-sm"
                style={{ background: 'var(--ink)', color: 'var(--paper)' }}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Link copied' : 'Send these three to a friend'}
            </button>
            <p className="text-xs mb-5" style={{ color: 'var(--ink-3)' }}>
                They see exactly these three places, even without a key of their own.
            </p>

            <div className="border-t pt-4" style={{ borderColor: 'var(--line)' }}>
                <p className="meta mb-3 inline-flex items-center gap-1.5" style={{ color: 'var(--ink-3)' }}>
                    <Users className="w-3.5 h-3.5" /> Or pass the phone around
                </p>

                <form
                    onSubmit={(e) => { e.preventDefault(); if (name.trim()) { onAddVoter(name.trim()); setName(''); } }}
                    className="flex gap-2 mb-3"
                >
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Add a name"
                        className="flex-1 h-10 px-3 rounded-xl border text-sm"
                        style={{ borderColor: 'var(--line)', background: 'var(--surface-2)', color: 'var(--ink)' }}
                    />
                    <button type="submit" className="btn px-4 h-10 text-sm border"
                        style={{ borderColor: 'var(--line)' }}>Add</button>
                </form>

                {voters.length > 0 && board && (
                    <div className="space-y-3">
                        {voters.map((v) => (
                            <div key={v}>
                                <p className="text-sm font-medium mb-1.5"><Bidi>{v}</Bidi></p>
                                <div className="flex gap-2">
                                    {board.slots.filter((s) => s.place).map((s) => {
                                        const on = votes[`${v}:${s.lane}`];
                                        return (
                                            <button
                                                key={s.lane}
                                                type="button"
                                                onClick={() => onCastVote(v, s.lane, !on)}
                                                aria-pressed={Boolean(on)}
                                                className="btn flex-1 px-2 py-2 text-xs border truncate"
                                                style={{
                                                    borderColor: on ? 'var(--accent)' : 'var(--line)',
                                                    background: on ? 'var(--accent)' : 'var(--surface)',
                                                    color: on ? '#fff' : 'var(--ink-2)',
                                                }}
                                            >
                                                <Bidi>{s.place.name}</Bidi>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}

                        <div className="flex gap-2 pt-1">
                            <button type="button" onClick={onReveal}
                                className="btn flex-1 h-11 text-sm"
                                style={{ background: 'var(--ink)', color: 'var(--paper)' }}>
                                Reveal the winner
                            </button>
                            <button type="button" onClick={onResetVoting}
                                className="btn px-4 h-11 text-sm border" style={{ borderColor: 'var(--line)' }}>
                                Reset
                            </button>
                        </div>
                    </div>
                )}

                <AnimatePresence>
                    {winner && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.96 }}
                            animate={{ opacity: 1, scale: 1.02 }}
                            transition={springSet(reduced).momentum}
                            className="card mt-4 p-4 flex items-center gap-3"
                        >
                            <Trophy className="w-5 h-5 shrink-0" style={{ color: 'var(--gold)' }} />
                            <div className="min-w-0">
                                <p className="meta" style={{ color: 'var(--ink-3)' }}>
                                    {winner.approvals} of {voters.length} approved
                                </p>
                                <Bidi as="p" className="font-semibold truncate">{winner.slot.place.name}</Bidi>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </Sheet>
    );
};

export default ShareSheet;
