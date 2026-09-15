import { useState } from 'react';
import { motion } from 'framer-motion';
import { UtensilsCrossed, Check, Copy, ExternalLink } from 'lucide-react';

/** Setup is skippable by design.
 *
 *  Discovery runs on OpenStreetMap, so the app is fully functional with no
 *  Google key at all -- it simply shows no star ratings or photos. Making that
 *  the obvious default path is what keeps the no-key experience honest. */
export const SetupFlow = ({ onDone }) => {
    const [key, setKey] = useState('');
    const [showKeyStep, setShowKeyStep] = useState(false);
    const [copied, setCopied] = useState(false);

    // No hardcoded fallback origin. A dev URL has no business appearing in the
    // setup copy of a deployed site.
    const origin = globalThis.location?.origin ?? '';
    const referrer = origin ? `${origin}/*` : 'your site address, followed by /*';

    const copyReferrer = async () => {
        try {
            await navigator.clipboard.writeText(referrer);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        } catch {
            /* clipboard blocked; the string is visible on screen anyway */
        }
    };

    return (
        <div className="min-h-dvh grid place-items-center p-6">
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
                className="card w-full max-w-md p-7"
            >
                {!showKeyStep ? (
                    <>
                        <span className="grid place-items-center w-12 h-12 rounded-2xl mb-5"
                            style={{ background: 'var(--ink)', color: 'var(--paper)' }}>
                            <UtensilsCrossed className="w-6 h-6" />
                        </span>
                        <h1 className="display mb-2">Where should we eat?</h1>
                        <p className="text-sm mb-6" style={{ color: 'var(--ink-2)' }}>
                            Three options, chosen from every place around you &mdash; not just the
                            handful everyone already knows. It remembers what it has shown you, so
                            you get somewhere new.
                        </p>

                        <button type="button" onClick={() => onDone('')}
                            className="btn w-full h-12 mb-3"
                            style={{ background: 'var(--ink)', color: 'var(--paper)' }}>
                            Start &mdash; no setup needed
                        </button>

                        <button type="button" onClick={() => setShowKeyStep(true)}
                            className="btn w-full h-11 text-sm border"
                            style={{ borderColor: 'var(--line)', color: 'var(--ink-2)' }}>
                            Add a Google key for ratings &amp; photos
                        </button>

                        <p className="text-xs mt-4" style={{ color: 'var(--ink-3)' }}>
                            Place data from OpenStreetMap. Works offline once loaded.
                        </p>
                    </>
                ) : (
                    <>
                        <h2 className="display mb-2">Optional: ratings</h2>
                        <p className="text-sm mb-5" style={{ color: 'var(--ink-2)' }}>
                            A Google Places key adds star ratings and photos to the three cards you
                            see. Everything else already works without it.
                        </p>

                        <input
                            type="text"
                            value={key}
                            onChange={(e) => setKey(e.target.value)}
                            placeholder="AIza..."
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="none"
                            spellCheck={false}
                            inputMode="text"
                            className="w-full h-11 px-3 rounded-xl border mb-3 text-sm"
                            style={{ borderColor: 'var(--line)', background: 'var(--surface-2)', color: 'var(--ink)' }}
                        />

                        <div className="rounded-xl p-3 mb-4 text-xs"
                            style={{ background: 'var(--surface-2)', color: 'var(--ink-2)' }}>
                            <p className="font-semibold mb-1" style={{ color: 'var(--ink)' }}>
                                Lock the key down first
                            </p>
                            <p className="mb-2">
                                A key in a web app is visible to anyone who opens it. In Google Cloud
                                Console, restrict it to <strong>Places API (New)</strong> and to this
                                HTTP referrer:
                            </p>
                            <button type="button" onClick={copyReferrer}
                                className="btn inline-flex items-center gap-1.5 px-2 py-1 border w-full justify-between"
                                style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
                                <code className="truncate text-[0.7rem]">{referrer}</code>
                                {copied ? <Check className="w-3 h-3 shrink-0" /> : <Copy className="w-3 h-3 shrink-0" />}
                            </button>
                        </div>

                        <button type="button" onClick={() => onDone(key.trim())}
                            className="btn w-full h-12 mb-2"
                            style={{ background: 'var(--ink)', color: 'var(--paper)' }}>
                            {key.trim() ? 'Save and start' : 'Start without a key'}
                        </button>

                        <a href="https://developers.google.com/maps/documentation/places/web-service/get-api-key"
                            target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--ink-3)' }}>
                            How to get a key <ExternalLink className="w-3 h-3" />
                        </a>
                    </>
                )}
            </motion.div>
        </div>
    );
};

export default SetupFlow;
