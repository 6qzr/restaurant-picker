# Chef's Choice

Three places to eat near you — and never the same three twice.

Hit one button and get a **Safe Bet**, **Something New**, and a **Long Shot**.
Swipe away anything you don't want. It remembers what it has already shown you,
so tomorrow is different from today.

---

## Why it was rebuilt

The original version kept suggesting the same handful of restaurants. That
wasn't a tuning problem — it was structural:

Google's `Place.searchNearby` returns **at most 20 results, has no pagination,
and ranks by popularity**. After filtering to rated places, the app's entire
universe was ~15 rows, and "Best Rated" picked randomly from the top 3 of those.
"Hidden Gem" required fewer than 150 reviews, which a popularity-ranked result
set almost never contains, so it silently fell back to the *same* best-rated
pool — two of the three cards were the same tier. Vetoes lived in `useState`
and were forgotten on every reload.

Measured over a 60-day simulation (one spin per day, real Muscat data):

| | unique places / 180 slots | most-repeated place | mean gap | two cards, same cuisine |
|---|---|---|---|---|
| **Before** | **19 (11%)** | **50 of 60 days** | 4.8 days | 43% |
| Old algorithm, given the full pool | 64 (36%) | 28 days | 3.7 days | 27% |
| **After** | **149 (83%)** | **3 days** | 32 days | 0% |

The middle row matters: widening the data alone only reaches 64. Both the data
and the sampler had to change.

## How it works now

**Discovery runs on OpenStreetMap, not Google.** A tiled Overpass sweep of
Muscat at 5 km finds **505 places** where Google's cap allowed 20 — including
the Arabic-named local spots (`مطعم الجود اللبناني`, `شاي العقيد`, `عصير تايم`)
that popularity ranking buries under the chains. Results are cached in
IndexedDB, so a repeat visit fills the pool in about 10 ms and the app works
fully offline.

**Google is used only to decorate the three cards you actually see** — a rating
and a photo each. That is roughly 3 calls per spin, against up to 50 before
(the old radius slider fired a billed search on every tick of the drag).

**The ranking engine is built to avoid repeats.** Novelty decays with a 10-day
half-life and *multiplies* the score rather than adding to it, so somewhere you
saw yesterday drops out of contention without being banished forever. Selection
uses Gumbel-top-k sampling at a temperature you control (Safe → Chaos), with a
diversity constraint that stops the board showing three pizza places.

## Running it

```bash
npm install
npm run dev
```

That's the whole setup. **No API key is required** — without one you get every
place, every filter, distances, opening hours and offline support, just no star
ratings or photos.

To add ratings and photos, copy `.env.example` to `.env` and set
`VITE_GOOGLE_MAPS_API_KEY`, or paste a key in the app's setup screen.

> Anything prefixed `VITE_` is inlined into the built JavaScript, so a key in
> `.env` is **public on any deployed build**. That is only acceptable if you
> also restrict the key in Google Cloud Console — by HTTP referrer to your own
> domain, and to the **Places API (New)** alone. The setup screen shows you the
> exact referrer string to paste.

## Commands

| | |
|---|---|
| `npm run dev` | dev server |
| `npm run build` | production build (PWA, service worker, icons) |
| `npm run lint` | ESLint |
| `node test/sweep-live.mjs [lat] [lon] [km]` | live Overpass sweep; touches no Google quota |
| `node test/repetition.mjs` | the before/after repetition report above |

`VITE_ENRICH_MODE=mock` returns deterministic synthetic ratings, so the UI can
be developed against realistic-looking data at zero API spend.

## Notes

**Overpass reliability.** The public instances are free and occasionally
overloaded. The sweep tiles its queries, rotates mirrors, backs off, records
failed tiles for a later retry, and never blocks the UI — a tile that fails
today is simply re-attempted next session, and the cache covers the gap. Two
things that matter if you touch the query builder: Overpass cost scales with
*statement count* rather than area, and regex tag matching (`~`) can't use the
tag index, so exact `=` unions are dramatically faster.

**Data terms.** OpenStreetMap data is ODbL and cached indefinitely, with
attribution in the footer. Google Place IDs may also be stored indefinitely and
have their own store. Google ratings, photos and display names have no caching
exception in Google's terms, so they are held in memory for the session only —
there is deliberately no code path in the data layer capable of writing them to
disk.

## Stack

React 18 · Vite 5 · Zustand · Tailwind 3 · framer-motion · idb ·
OpenStreetMap (Overpass) · Google Places API (New), optional

Place data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).

## License

MIT.
