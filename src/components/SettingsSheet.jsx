import { useEffect, useState } from 'react';
import { RotateCcw, Star, KeyRound, AlertTriangle, CheckCircle2, ExternalLink, Stethoscope, Loader2, BookOpen, ChevronRight } from 'lucide-react';
import Sheet from './primitives/Sheet.jsx';
import { Bidi, Num } from './primitives/Bidi.jsx';
import { listVetoed, clearVeto } from '../engine/history/seenStore.js';
import { getBudget, totalCalls } from '../data/budgetRepo.js';
import { enrichmentStatus } from '../engine/enrich/enrichQueue.js';
import { testConnection } from '../engine/enrich/googlePlaces.js';

const Row = ({ label, hint, children }) => (
    <div className="flex items-center justify-between gap-4 py-3 border-b" style={{ borderColor: 'var(--line)' }}>
        <div className="min-w-0">
            <p className="text-sm font-medium">{label}</p>
            {hint && <p className="text-xs mt-0.5" style={{ color: 'var(--ink-3)' }}>{hint}</p>}
        </div>
        <div className="shrink-0">{children}</div>
    </div>
);

const Toggle = ({ on, onChange, label }) => (
    <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
        className="btn relative w-11 h-6 rounded-full transition-colors"
        style={{ background: on ? 'var(--accent)' : 'var(--line)' }}
    >
        <span
            className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
            style={{ insetInlineStart: on ? '1.375rem' : '0.125rem' }}
        />
    </button>
);

export const SettingsSheet = ({ open, onClose, reduced, apiKey, showRatings, onShowRatings, onSetKey, onOpenGuide }) => {
    const [vetoed, setVetoed] = useState([]);
    const [budget, setBudget] = useState(null);
    const [keyInput, setKeyInput] = useState('');
    const [status, setStatus] = useState(null);
    const [testing, setTesting] = useState(false);

    useEffect(() => {
        if (!open) return;
        listVetoed().then(setVetoed).catch(() => setVetoed([]));
        getBudget().then(setBudget).catch(() => setBudget(null));
        setStatus(enrichmentStatus());
        setKeyInput('');
    }, [open]);

    /** One real call, so "no ratings" stops being a guessing game.
     *  Takes the key explicitly: after a save, the prop is still the old value
     *  for this tick, and testing the key the user just replaced is exactly the
     *  bug this is here to prevent. */
    const runTest = async (key = apiKey) => {
        setTesting(true);
        setStatus(null);
        const result = await testConnection(key);
        setStatus({ code: result.code, hint: result.hint, docsUrl: result.docsUrl, detail: result.detail, at: Date.now() });
        setTesting(false);
    };

    const saveKey = async (raw) => {
        const key = raw.trim();
        if (!key) return;
        onSetKey(key);
        setKeyInput('');
        // Verify immediately. Previously the banner kept showing the PREVIOUS
        // key's failure, so replacing a bad key with a good one looked like the
        // good one had been rejected too.
        await runTest(key);
    };

    const unVeto = async (id) => {
        await clearVeto(id);
        setVetoed(await listVetoed());
    };


    const OK_CODES = ['ok', 'idle', 'working'];
    const showBanner = status && !OK_CODES.includes(status.code);

    return (
        <Sheet open={open} onClose={onClose} title="Settings" reduced={reduced}>
            {/* A bring-your-own-key app that fails silently is unusable -- the
                user cannot tell a wrong key from a disabled API. Say which. */}
            {showBanner && (
                <div
                    className="rounded-xl p-3 mb-4 flex gap-2.5 text-xs"
                    style={{
                        background: status.code === 'no-key' ? 'var(--surface-2)' : 'rgba(194,69,47,0.10)',
                        color: 'var(--ink-2)',
                    }}
                >
                    <AlertTriangle
                        className="w-4 h-4 shrink-0 mt-0.5"
                        style={{ color: status.code === 'no-key' ? 'var(--ink-3)' : 'var(--danger)' }}
                    />
                    <div className="min-w-0">
                        <p style={{ color: 'var(--ink)' }}>{status.hint}</p>
                        {status.detail && (
                            <p
                                className="mt-1.5 opacity-70 break-words"
                                style={{
                                    fontSize: '0.6875rem',
                                    fontFamily: 'var(--mono)',
                                }}
                            >
                                Google said: {status.detail}
                            </p>
                        )}
                        {status.docsUrl && (
                            <a
                                href={status.docsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 mt-1.5 underline"
                                style={{ color: 'var(--gold)' }}
                            >
                                Enable it in Google Cloud <ExternalLink className="w-3 h-3" />
                            </a>
                        )}
                    </div>
                </div>
            )}

            {status?.code === 'ok' && (
                <div className="rounded-xl p-3 mb-4 flex gap-2.5 text-xs"
                    style={{ background: 'var(--surface-2)', color: 'var(--ink-2)' }}>
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
                    <p>Connected to Google. Ratings and photos are loading.</p>
                </div>
            )}

            <button
                type="button"
                onClick={onOpenGuide}
                className="btn w-full flex items-center justify-between gap-4 py-3 border-b text-start"
                style={{ borderColor: 'var(--line)' }}
            >
                <span className="flex items-center gap-2.5 min-w-0">
                    <BookOpen className="w-4 h-4 shrink-0" style={{ color: 'var(--ink-3)' }} />
                    <span className="min-w-0">
                        <span className="block text-sm font-medium">How it works</span>
                        <span className="block text-xs mt-0.5" style={{ color: 'var(--ink-3)' }}>
                            The three cards, the dials, and the gestures.
                        </span>
                    </span>
                </span>
                <ChevronRight className="w-4 h-4 shrink-0" style={{ color: 'var(--ink-3)' }} />
            </button>

            <Row
                label="Show ratings"
                hint={
                    apiKey
                        ? 'Star ratings cost more per lookup than photos alone.'
                        : 'Needs a Google key. Everything else works without one.'
                }
            >
                <Toggle on={showRatings && Boolean(apiKey)} onChange={onShowRatings} label="Show ratings" />
            </Row>

            <Row
                label="Google key"
                hint={apiKey ? 'Saved on this device only.' : 'Not set — running on OpenStreetMap alone.'}
            >
                <KeyRound className="w-4 h-4" style={{ color: apiKey ? 'var(--accent)' : 'var(--ink-3)' }} />
            </Row>

            {apiKey && (
                <button
                    type="button"
                    onClick={() => runTest()}
                    disabled={testing}
                    className="btn w-full h-10 my-3 inline-flex items-center justify-center gap-2 text-sm border disabled:opacity-50"
                    style={{ borderColor: 'var(--line)' }}
                >
                    {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Stethoscope className="w-4 h-4" />}
                    {testing ? 'Asking Google…' : 'Test my key'}
                </button>
            )}

            <form
                    className="flex gap-2 py-3"
                    onSubmit={(e) => {
                        e.preventDefault();
                        saveKey(keyInput);
                    }}
                >
                    <input
                        // Deliberately NOT type="password": you cannot see a
                        // truncated or autocorrected paste in a masked field,
                        // and password managers offer to fill it. The key is
                        // already visible in the user's own console.
                        type="text"
                        value={keyInput}
                        onChange={(e) => setKeyInput(e.target.value)}
                        placeholder={apiKey ? 'Paste a different key to replace it' : 'Paste a Places API key'}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        inputMode="text"
                        className="flex-1 h-10 px-3 rounded-xl border text-sm"
                        style={{
                            borderColor: 'var(--line)',
                            background: 'var(--surface-2)',
                            color: 'var(--ink)',
                            fontFamily: 'var(--mono)',
                        }}
                    />
                <button
                    type="submit"
                    disabled={testing || !keyInput.trim()}
                    className="btn px-4 h-10 text-sm border disabled:opacity-50"
                    style={{ borderColor: 'var(--line)' }}
                >
                    {testing ? 'Checking…' : 'Save'}
                </button>
                {apiKey && (
                    <button
                        type="button"
                        onClick={() => { onSetKey(''); setKeyInput(''); setStatus(null); }}
                        className="btn px-3 h-10 text-sm border"
                        style={{ borderColor: 'var(--line)', color: 'var(--danger)' }}
                    >
                        Remove
                    </button>
                )}
            </form>

            {budget && (
                <Row label="Google lookups this month" hint="Only the cards you actually see are looked up.">
                    <Num className="text-sm font-semibold tabular-nums">{totalCalls(budget)}</Num>
                </Row>
            )}

            <div className="pt-4">
                <p className="meta mb-2" style={{ color: 'var(--ink-3)' }}>
                    Vetoed places ({vetoed.length})
                </p>
                {vetoed.length === 0 ? (
                    <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
                        Nothing vetoed. Swipe a card away to hide it for a few months.
                    </p>
                ) : (
                    <ul className="space-y-1 max-h-48 overflow-y-auto">
                        {vetoed.map((v) => (
                            <li key={v.id} className="flex items-center justify-between gap-3 text-sm">
                                <Bidi className="truncate" style={{ color: 'var(--ink-2)' }}>{v.name ?? v.id}</Bidi>
                                <button
                                    type="button"
                                    onClick={() => unVeto(v.id)}
                                    className="btn inline-flex items-center gap-1 px-2 py-1 text-xs border shrink-0"
                                    style={{ borderColor: 'var(--line)' }}
                                >
                                    <RotateCcw className="w-3 h-3" /> Restore
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <p className="text-xs mt-5 flex items-start gap-1.5" style={{ color: 'var(--ink-3)' }}>
                <Star className="w-3 h-3 mt-0.5 shrink-0" />
                Ratings and photos come from Google and are kept only for this session.
                Place data comes from OpenStreetMap and is stored on your device.
            </p>
        </Sheet>
    );
};

export default SettingsSheet;
