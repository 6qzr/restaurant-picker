import { useCallback, useEffect, useRef } from 'react';
import { useStore } from '../store/index.js';
import { enrichPlaces } from '../engine/enrich/enrichQueue.js';
import { recordShown, recordVeto, recordChosen, loadAllSeen } from '../engine/history/seenStore.js';
import { votePlace, loadPrefs } from '../data/prefsRepo.js';
import { CONFIG_MONTHLY_CAP } from '../config-runtime.js';

/** Board lifecycle: pick, enrich, veto, swap, vote. */
export const useBoard = () => {
    const store = useStore;
    const board = useStore((s) => s.board);
    const enrichmentsRef = useRef(null);

    const enrichBoard = useCallback(async (nextBoard) => {
        const places = nextBoard?.slots.map((s) => s.place).filter(Boolean) ?? [];
        if (!places.length) return;
        const s = store.getState();
        const ac = new AbortController();
        enrichmentsRef.current?.abort();
        enrichmentsRef.current = ac;
        const map = await enrichPlaces(places, {
            apiKey: s.apiKey,
            withRatings: s.showRatings,
            monthlyCap: CONFIG_MONTHLY_CAP,
            signal: ac.signal,
            languageCode: navigator.language?.slice(0, 2),
        });
        store.getState().mergeEnrichments(map);
    }, [store]);

    const spin = useCallback(async (overrides) => {
        const next = store.getState().spin(overrides);
        if (!next) return null;
        const ids = next.slots.map((sl) => sl.place?.id).filter(Boolean);
        if (ids.length) {
            await recordShown(ids);
            store.getState().setSeen(await loadAllSeen());
        }
        enrichBoard(next);
        return next;
    }, [store, enrichBoard]);

    const veto = useCallback(async (laneId) => {
        const s = store.getState();
        const slot = s.board?.slots.find((sl) => sl.lane === laneId);
        if (!slot?.place) return;
        await recordVeto(slot.place.id);
        s.swap(laneId);
        store.getState().setSeen(await loadAllSeen());
        const after = store.getState().board;
        enrichBoard(after);
    }, [store, enrichBoard]);

    const swap = useCallback((laneId) => {
        store.getState().swap(laneId);
        enrichBoard(store.getState().board);
    }, [store, enrichBoard]);

    const vote = useCallback(async (place, weight) => {
        await votePlace(place, weight);
        store.getState().setPrefs(await loadPrefs());
    }, [store]);

    const choose = useCallback(async (place) => {
        await recordChosen(place.id);
        store.getState().setSeen(await loadAllSeen());
    }, [store]);

    useEffect(() => () => enrichmentsRef.current?.abort(), []);

    return { board, spin, veto, swap, vote, choose };
};
