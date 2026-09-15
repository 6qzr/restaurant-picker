import { circleBBox, haversineKm } from '../geo.js';
import { TILES, SEARCH } from '../../config.js';

/** Web Mercator (slippy map) tiling.
 *
 *  Why tiles rather than `around:` circles: tiles partition the plane, so a node
 *  belongs to exactly one tile and there is zero cross-tile duplication. The
 *  integer z/x/y is also a perfect cache key -- it answers "have I already swept
 *  this rectangle?" as a boolean, which a circle can never do. And because tile
 *  ids are global, a friend opening a share link hits the identical cache keys.
 */

const DEG = Math.PI / 180;

export const lonToTileX = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z);

export const latToTileY = (lat, z) => {
    const r = lat * DEG;
    return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};

export const tileXToLon = (x, z) => (x / 2 ** z) * 360 - 180;

export const tileYToLat = (y, z) => {
    const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
    return (180 / Math.PI) * Math.atan(Math.sinh(n));
};

export const tileId = (z, x, y) => `${z}/${x}/${y}`;

/** Tile bounds. Overpass wants (south, west, north, east). */
export const tileBBox = (z, x, y) => ({
    north: tileYToLat(y, z),
    south: tileYToLat(y + 1, z),
    west: tileXToLon(x, z),
    east: tileXToLon(x + 1, z),
});

export const tileCenter = (z, x, y) => {
    const b = tileBBox(z, x, y);
    return { lat: (b.north + b.south) / 2, lon: (b.west + b.east) / 2 };
};

/** Approximate tile size in km, for sanity-checking that we stay inside the
 *  verified-safe ~2km query envelope. */
export const tileSizeKm = (z, x, y) => {
    const b = tileBBox(z, x, y);
    return {
        width: haversineKm(b.south, b.west, b.south, b.east),
        height: haversineKm(b.south, b.west, b.north, b.west),
    };
};

/**
 * Probes the far field: a fan of tiles spread across both direction and
 * distance, rather than the nearest N.
 *
 * Two failure modes this avoids. Truncating a distance-sorted list hands the
 * whole budget to whichever direction is tiled most densely, so you probe a
 * solid blob on one side of yourself and nothing on the other. Taking the
 * nearest tile in each direction instead fans out correctly but never leaves
 * the inner edge -- every probe lands just past the covered disc, so raising
 * the radius from 20km to 50km changes nothing at all. Bucketing by bearing and
 * then striding across each bucket's distance-sorted list fixes both: every
 * direction is probed, and the probes in a direction are spread over the whole
 * annulus out to its far edge.
 */
const fanSample = (tiles, lat, lon, perSector, sectors = TILES.outerSectors) => {
    if (perSector <= 0 || !tiles.length) return [];

    const buckets = Array.from({ length: sectors }, () => []);
    for (const t of tiles) {
        // Planar bearing is plenty: we only need to know which twelfth of the
        // compass a tile sits in, not to navigate to it.
        const dx = (t.center.lon - lon) * Math.cos(lat * DEG);
        const dy = t.center.lat - lat;
        const angle = Math.atan2(dx, dy); // -PI..PI, 0 = due north
        const i = Math.min(sectors - 1, Math.floor(((angle + Math.PI) / (2 * Math.PI)) * sectors));
        buckets[i].push(t);
    }
    for (const b of buckets) b.sort((a, c) => a.distanceKm - c.distanceKm);

    // Stride by index rather than by kilometre: tile count grows with distance,
    // so even index spacing means each probe stands for a similar AREA.
    const picks = buckets.map((b) => {
        const n = Math.min(perSector, b.length);
        return Array.from({ length: n }, (_, j) => b[Math.floor(((j + 0.5) / n) * b.length)]);
    });

    // Interleaved, so an aborted sweep still has every direction represented.
    const out = [];
    for (let depth = 0; depth < perSector; depth++) {
        for (const p of picks) if (depth < p.length) out.push(p[depth]);
    }
    return out;
};

/**
 * Tiles covering a circle, ordered by ring (centre outwards) so a ring-lazy
 * sweep can stop early once it has found enough without leaving a hole in
 * the middle.
 *
 * Past `TILES.fullCoverageKm` the return value is deliberately NOT full
 * coverage: the inner disc is swept exhaustively and the far field gets a
 * bounded fan of probes (`sampled: true`). Covering a 50km disc at z13 is ~540
 * tiles, and at two concurrent requests with polite spacing that is hours of
 * traffic for an app that needs three places. The sample trades completeness
 * out there for a search that finishes -- so a far-out pick is one of the
 * places we looked at, not the best of every place that exists.
 */
export const coveringTiles = (lat, lon, radiusKm, z = TILES.zoom) => {
    // Clamp before doing any work. A hand-edited share link can name any
    // radius, and the tile grid grows with its square.
    const r = Math.max(0, Math.min(radiusKm, SEARCH.maxRadiusKm));
    const bb = circleBBox(lat, lon, r);
    const xMin = lonToTileX(bb.west, z);
    const xMax = lonToTileX(bb.east, z);
    // y grows southwards, so north edge yields the smaller index.
    const yMin = latToTileY(bb.north, z);
    const yMax = latToTileY(bb.south, z);

    const out = [];
    for (let x = xMin; x <= xMax; x++) {
        for (let y = yMin; y <= yMax; y++) {
            const c = tileCenter(z, x, y);
            out.push({
                id: tileId(z, x, y),
                z,
                x,
                y,
                center: c,
                bbox: tileBBox(z, x, y),
                distanceKm: haversineKm(lat, lon, c.lat, c.lon),
            });
        }
    }

    out.sort((a, b) => a.distanceKm - b.distanceKm);

    if (r <= TILES.fullCoverageKm) return out.slice(0, TILES.maxTiles);

    const core = out.filter((t) => t.distanceKm <= TILES.fullCoverageKm).slice(0, TILES.maxTiles);
    const covered = new Set(core.map((t) => t.id));
    const perSector = Math.min(
        TILES.outerProbesPerSector,
        Math.ceil((r - TILES.fullCoverageKm) / TILES.outerKmPerProbe)
    );
    const outer = fanSample(
        out.filter((t) => !covered.has(t.id)),
        lat,
        lon,
        perSector
    ).map((t) => ({ ...t, sampled: true }));

    return [...core, ...outer];
};
