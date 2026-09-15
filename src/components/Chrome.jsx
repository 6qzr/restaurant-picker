import { motion } from 'framer-motion';
import { UtensilsCrossed, Loader2, WifiOff, Share2, Settings, HelpCircle } from 'lucide-react';
import { Num } from './primitives/Bidi.jsx';

/** The header shows POOL SIZE, not a cost gauge.
 *
 *  The old header gave prime real estate to an estimated dollar figure that
 *  changed three times a day and was measured against a free tier that no
 *  longer exists. How many places the app can actually choose between is the
 *  number that matters here. */
/** `poolSize` is what the user can actually be shown right now -- i.e. after
 *  their filters. Showing the unfiltered total was actively misleading: with
 *  the Pizza chip on, the header read "567 places" while the board was choosing
 *  between 15, which is why the variety looked broken rather than narrowed. */
export const TopBar = ({ poolSize, totalSize, sweepPhase, offline, onOpenSettings, onOpenGuide }) => (
    <header
        className="chrome sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-3"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
    >
        <div className="flex items-center gap-2 min-w-0">
            <span className="grid place-items-center w-8 h-8 rounded-xl shrink-0"
                style={{ background: 'var(--ink)', color: 'var(--paper)' }}>
                <UtensilsCrossed className="w-4 h-4" />
            </span>
            <h1 className="text-base font-semibold tracking-[-0.01em] truncate">Chef&rsquo;s Choice</h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
            {offline && (
                <span className="meta inline-flex items-center gap-1 px-2 py-1 rounded-full"
                    style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>
                    <WifiOff className="w-3 h-3" /> Offline
                </span>
            )}
            <span
                className="meta inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                style={{ background: 'var(--surface-2)', color: 'var(--ink-2)' }}
                title={
                    totalSize != null && totalSize !== poolSize
                        ? `${poolSize} of ${totalSize} places match your filters`
                        : undefined
                }
            >
                {sweepPhase === 'sweeping' && <Loader2 className="w-3 h-3 animate-spin" />}
                {totalSize != null && totalSize !== poolSize ? (
                    <>
                        <Num>{poolSize}</Num> of <Num>{totalSize}</Num>
                    </>
                ) : (
                    <>
                        <Num>{poolSize}</Num> places
                    </>
                )}
            </span>
            <button type="button" onClick={onOpenGuide} aria-label="How it works"
                className="btn grid place-items-center w-8 h-8" style={{ color: 'var(--ink-3)' }}>
                <HelpCircle className="w-4 h-4" />
            </button>
            <button type="button" onClick={onOpenSettings} aria-label="Settings"
                className="btn grid place-items-center w-8 h-8" style={{ color: 'var(--ink-3)' }}>
                <Settings className="w-4 h-4" />
            </button>
        </div>
    </header>
);

export const BottomBar = ({ canSpin, isPicking, hasBoard, poolSize, sweepPhase, onSpin, onShare }) => (
    <div
        className="chrome sticky bottom-0 z-30 flex items-center gap-3 px-4 py-3 border-t"
        style={{ borderColor: 'var(--line)', paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
        <motion.button
            type="button"
            onClick={onSpin}
            disabled={!canSpin}
            whileTap={canSpin ? { scale: 0.97 } : undefined}
            className="btn flex-1 h-12 text-base disabled:opacity-45"
            style={{ background: 'var(--ink)', color: 'var(--paper)' }}
        >
            {isPicking
                ? 'Choosing…'
                : !canSpin && sweepPhase === 'sweeping'
                  ? `Finding places… (${poolSize})`
                  : hasBoard
                    ? 'Spin again'
                    : 'Find me somewhere'}
        </motion.button>

        {hasBoard && (
            <button type="button" onClick={onShare} aria-label="Share this board"
                className="btn grid place-items-center w-12 h-12 border"
                style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
                <Share2 className="w-4 h-4" />
            </button>
        )}
    </div>
);
