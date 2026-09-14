import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Loader2 } from 'lucide-react';

import { useStore, tallyVotes } from './store/index.js';
import { useGeolocation } from './hooks/useGeolocation.js';
import { useDiscovery } from './hooks/useDiscovery.js';
import { useBoard } from './hooks/useBoard.js';
import { useUserMotionPrefs } from './hooks/useUserMotionPrefs.js';
import { canSpin as poolCanSpin } from './engine/discovery/sweep.js';
import { urlToBoard } from './share/codec.js';
import { getPlacesByIds } from './data/placesRepo.js';
import { runQuery, buildIdQuery } from './engine/discovery/overpass.js';
import { normalizeElements } from './engine/discovery/osmNormalize.js';
import { SEARCH } from './config.js';

import SetupFlow from './components/SetupFlow.jsx';
import Board from './components/Board.jsx';
import ShareSheet from './components/ShareSheet.jsx';
import SettingsSheet from './components/SettingsSheet.jsx';
import { TopBar, BottomBar } from './components/Chrome.jsx';
import { RadiusDial, SurpriseDial, ModeToggle, CuisineChips } from './components/Controls.jsx';

const App = () => {
    const [setupDone, setSetupDone] = useState(() => localStorage.getItem('cc_setup') === '1');
    const [shareOpen, setShareOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [offline, setOffline] = useState(!navigator.onLine);
    const [votes, setVotes] = useState({});

    const { reducedMotion } = useUserMotionPrefs();

    const s = useStore();
    const { location, error: locError, request: requestLocation } = useGeolocation();
    useDiscovery();
    const { board, spin, veto, swap, vote, choose } = useBoard();

    useEffect(() => {
        const on = () => setOffline(false);
        const off = () => setOffline(true);
        window.addEventListener('online', on);
        window.addEventListener('offline', off);
        return () => {
            window.removeEventListener('online', on);
            window.removeEventListener('offline', off);
        };
    }, []);

    /** A shared link reproduces the exact three places, looking them up locally
     *  first and falling back to one tiny id query. Seed-only reproduction
     *  would silently diverge on a friend's device. */
    useEffect(() => {
        const shared = urlToBoard();
        if (!shared?.placeIds?.length) return;
        setSetupDone(true);
        (async () => {
            let places = await getPlacesByIds(shared.placeIds);
            if (places.length < shared.placeIds.length) {
                try {
                    const ids = shared.placeIds.map((id) => id.split(':')[2]);
                    const { elements } = await runQuery(buildIdQuery(ids));
                    places = normalizeElements(elements, 'shared');
                } catch {
                    /* fall back to whatever was cached locally */
                }
            }
            if (!places.length) return;
            useStore.getState().setLocation(shared.center);
            useStore.getState().setRadius(shared.radiusKm || SEARCH.defaultRadiusKm);
            useStore.getState().addPlaces(places);
            useStore.getState().spin({
                seed: shared.seed,
                shared: true,
                temperature: shared.temperature,
                pool: places,
            });
        })();
    }, []);

    const handleSetup = useCallback((key) => {
        if (key) useStore.getState().setApiKey(key);
        localStorage.setItem('cc_setup', '1');
        setSetupDone(true);
    }, []);

    const handleVote = useCallback(
        (place, weight) => {
            setVotes((p) => ({ ...p, [place.id]: p[place.id] === weight ? 0 : weight }));
            vote(place, weight);
        },
        [vote]
    );

    const tally = useMemo(
        () => tallyVotes(board, s.voters, s.votes),
        [board, s.voters, s.votes]
    );

    if (!setupDone) return <SetupFlow onDone={handleSetup} />;

    if (!location) {
        return (
            <div className="min-h-dvh grid place-items-center p-6 text-center">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
                    className="max-w-sm"
                >
                    <span className="grid place-items-center w-14 h-14 rounded-2xl mx-auto mb-5"
                        style={{ background: 'var(--ink)', color: 'var(--paper)' }}>
                        <MapPin className="w-6 h-6" />
                    </span>
                    <h2 className="display mb-2">Finding you</h2>
                    <p className="text-sm" style={{ color: 'var(--ink-2)' }}>
                        {locError || 'Just a moment…'}
                    </p>
                    {locError && (
                        <button type="button" onClick={requestLocation}
                            className="btn mt-5 px-5 h-11"
                            style={{ background: 'var(--ink)', color: 'var(--paper)' }}>
                            Try again
                        </button>
                    )}
                </motion.div>
            </div>
        );
    }

    const ready = poolCanSpin(s.pool.length);

    return (
        <div className="min-h-dvh flex flex-col">
            <TopBar
                poolSize={s.pool.length}
                sweepPhase={s.sweepPhase}
                offline={offline}
                onOpenSettings={() => setSettingsOpen(true)}
            />

            <main className="flex-1 w-full max-w-5xl mx-auto px-4 pt-4 pb-6 flex flex-col gap-5">
                <section className="card p-4 flex flex-col gap-3.5">
                    <RadiusDial radiusKm={s.radiusKm} onChange={s.setRadius} />
                    <SurpriseDial temperature={s.temperature} onChange={s.setTemperature} />
                    <div className="flex items-center justify-between gap-3">
                        <ModeToggle adventure={s.adventure} onChange={s.setAdventure} />
                    </div>
                </section>

                <CuisineChips chips={s.chips} onToggle={s.toggleChip} />

                {board ? (
                    <Board
                        board={board}
                        enrichments={s.enrichments}
                        votes={votes}
                        reduced={reducedMotion}
                        newSincePick={s.newSincePick}
                        onVote={handleVote}
                        onSwap={swap}
                        onVeto={veto}
                        onChoose={choose}
                        onRespin={() => spin()}
                        onWiden={() => s.setRadius(Math.min(SEARCH.maxRadiusKm, s.radiusKm + 3))}
                    />
                ) : (
                    <div className="flex-1 grid place-items-center text-center py-16">
                        <div className="max-w-xs">
                            {!ready && s.sweepPhase === 'sweeping' ? (
                                <>
                                    <Loader2 className="w-6 h-6 mx-auto mb-3 animate-spin" style={{ color: 'var(--ink-3)' }} />
                                    <p className="text-sm" style={{ color: 'var(--ink-2)' }}>
                                        Mapping every place around you&hellip;
                                    </p>
                                </>
                            ) : (
                                <p className="text-sm" style={{ color: 'var(--ink-2)' }}>
                                    {s.pool.length} places found nearby. Ready when you are.
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </main>

            <BottomBar
                canSpin={ready && !s.isPicking}
                isPicking={s.isPicking}
                hasBoard={Boolean(board)}
                poolSize={s.pool.length}
                sweepPhase={s.sweepPhase}
                onSpin={() => spin()}
                onShare={() => setShareOpen(true)}
            />

            <ShareSheet
                open={shareOpen}
                onClose={() => setShareOpen(false)}
                board={board}
                center={location}
                radiusKm={s.radiusKm}
                temperature={s.temperature}
                adventure={s.adventure}
                chips={s.chips}
                seed={s.seed}
                voters={s.voters}
                votes={s.votes}
                revealed={s.revealed}
                tally={tally}
                reduced={reducedMotion}
                onAddVoter={s.addVoter}
                onCastVote={s.castVote}
                onReveal={s.reveal}
                onResetVoting={s.resetVoting}
            />

            <SettingsSheet
                open={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                reduced={reducedMotion}
                apiKey={s.apiKey}
                showRatings={s.showRatings}
                onShowRatings={s.setShowRatings}
                onSetKey={s.setApiKey}
            />

            <footer className="px-4 pb-4 text-center">
                <p className="text-[0.6875rem]" style={{ color: 'var(--ink-3)' }}>
                    Place data &copy;{' '}
                    <a href="https://www.openstreetmap.org/copyright" target="_blank"
                        rel="noopener noreferrer" className="underline">
                        OpenStreetMap contributors
                    </a>
                </p>
            </footer>
        </div>
    );
};

export default App;
