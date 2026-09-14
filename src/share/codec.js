/**
 * Share-link encoding.
 *
 * Seed-only reproduction does NOT work: a friend's Overpass sweep can return a
 * slightly different set (different mirror, newer OSM data) and their seen-history
 * is entirely their own, so the same seed would yield different cards and the
 * feature would silently break. We therefore encode the three chosen place ids
 * directly, plus enough context to re-spin together.
 *
 * Layout (31 bytes -> 42 base64url chars):
 *   0      version
 *   1-3    lat   uint24   (lat + 90) * 93206     ~1.2 m
 *   4-6    lon   uint24   (lon + 180) * 46603    ~2.4 m
 *   7      radius, 0.5 km steps
 *   8      temperature, 0-255
 *   9      flags: bit0 adventure, bit1 ratingsOff
 *   10-11  cuisine chip mask uint16
 *   12-15  seed uint32
 *   16-30  three place refs, 5 bytes each: 2 bits type + 38 bits osm id
 */

import { CUISINE_CHIPS } from '../utils/cuisine.js';

export const VERSION = 1;
const LAT_SCALE = 93206;
const LON_SCALE = 46603;
const TYPE_CODES = { n: 0, w: 1, r: 2 };
const TYPE_CHARS = ['n', 'w', 'r'];

const toB64Url = (bytes) => {
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    const b64 =
        typeof btoa === 'function'
            ? btoa(bin)
            : globalThis.Buffer.from(bytes).toString('base64');
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromB64Url = (str) => {
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    if (typeof atob === 'function') {
        const bin = atob(pad);
        return Uint8Array.from(bin, (c) => c.charCodeAt(0));
    }
    return new Uint8Array(globalThis.Buffer.from(pad, 'base64'));
};

const writeUint = (view, offset, value, bytes) => {
    for (let i = bytes - 1; i >= 0; i--) {
        view[offset + i] = value & 0xff;
        value = Math.floor(value / 256);
    }
};

const readUint = (view, offset, bytes) => {
    let v = 0;
    for (let i = 0; i < bytes; i++) v = v * 256 + view[offset + i];
    return v;
};

/** 'osm:n:123456' -> {type:'n', id:123456} */
export const parsePlaceId = (placeId) => {
    const [, type, id] = String(placeId).split(':');
    return { type: type ?? 'n', id: Number(id) };
};

export const formatPlaceId = (type, id) => `osm:${type}:${id}`;

export const encodeBoard = ({
    center,
    radiusKm,
    temperature = 0.45,
    adventure = false,
    ratingsOff = false,
    chips = [],
    seed = 0,
    placeIds = [],
}) => {
    const buf = new Uint8Array(31);
    buf[0] = VERSION;
    writeUint(buf, 1, Math.round((center.lat + 90) * LAT_SCALE), 3);
    writeUint(buf, 4, Math.round((center.lon + 180) * LON_SCALE), 3);
    buf[7] = Math.max(0, Math.min(255, Math.round(radiusKm * 2)));
    buf[8] = Math.max(0, Math.min(255, Math.round(temperature * 255)));
    buf[9] = (adventure ? 1 : 0) | (ratingsOff ? 2 : 0);

    let mask = 0;
    chips.forEach((id) => {
        const i = CUISINE_CHIPS.findIndex((c) => c.id === id);
        if (i >= 0) mask |= 1 << i;
    });
    writeUint(buf, 10, mask, 2);
    writeUint(buf, 12, seed >>> 0, 4);

    for (let i = 0; i < 3; i++) {
        const raw = placeIds[i];
        if (!raw) continue;
        const { type, id } = parsePlaceId(raw);
        const code = TYPE_CODES[type] ?? 0;
        // 2-bit type in the top bits of a 40-bit field, 38 bits for the id.
        writeUint(buf, 16 + i * 5, code * 2 ** 38 + id, 5);
    }

    return toB64Url(buf);
};

export const decodeBoard = (str) => {
    const buf = fromB64Url(str);
    if (buf.length < 31) throw new Error('share link too short');
    if (buf[0] !== VERSION) throw new Error(`unsupported share link version ${buf[0]}`);

    const mask = readUint(buf, 10, 2);
    const chips = CUISINE_CHIPS.filter((_, i) => mask & (1 << i)).map((c) => c.id);

    const placeIds = [];
    for (let i = 0; i < 3; i++) {
        const packed = readUint(buf, 16 + i * 5, 5);
        if (packed === 0) continue;
        const code = Math.floor(packed / 2 ** 38);
        const id = packed - code * 2 ** 38;
        placeIds.push(formatPlaceId(TYPE_CHARS[code] ?? 'n', id));
    }

    return {
        version: buf[0],
        center: {
            lat: readUint(buf, 1, 3) / LAT_SCALE - 90,
            lon: readUint(buf, 4, 3) / LON_SCALE - 180,
        },
        radiusKm: buf[7] / 2,
        temperature: buf[8] / 255,
        adventure: Boolean(buf[9] & 1),
        ratingsOff: Boolean(buf[9] & 2),
        chips,
        seed: readUint(buf, 12, 4),
        placeIds,
    };
};

/** Hash fragments are never sent to a server -- keeping the user's coordinates
 *  out of hosting logs, CDN logs and Referer headers. Never use a query string. */
export const boardToUrl = (board, origin = globalThis.location?.origin ?? '') =>
    `${origin}/#s=${encodeBoard(board)}`;

export const urlToBoard = (url = globalThis.location?.hash ?? '') => {
    const m = String(url).match(/[#&]s=([A-Za-z0-9_-]+)/);
    if (!m) return null;
    try {
        return decodeBoard(m[1]);
    } catch {
        return null;
    }
};
