import { circleBBox, haversineKm } from '../geo.js';
import { TILES } from '../../config.js';

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
 * Tiles covering a circle, ordered by ring (centre outwards) so a ring-lazy
 * sweep can stop early once it has found enough without leaving a hole in
 * the middle.
 */
export const coveringTiles = (lat, lon, radiusKm, z = TILES.zoom) => {
    const bb = circleBBox(lat, lon, radiusKm);
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
    return out.slice(0, TILES.maxTiles);
};
