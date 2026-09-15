/** Geographic helpers. Replaces the dead src/utils/geometry.js and the copy of
 *  haversine that was inlined inside pickerLogic.js. */

const R_EARTH_KM = 6371;
const DEG = Math.PI / 180;

/** Great-circle distance in kilometres. */
export const haversineKm = (aLat, aLon, bLat, bLon) => {
    const dLat = (bLat - aLat) * DEG;
    const dLon = (bLon - aLon) * DEG;
    const s =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(aLat * DEG) * Math.cos(bLat * DEG) * Math.sin(dLon / 2) ** 2;
    return 2 * R_EARTH_KM * Math.asin(Math.min(1, Math.sqrt(s)));
};

export const distanceKm = (a, b) => haversineKm(a.lat, a.lon ?? a.lng, b.lat, b.lon ?? b.lng);

/** Bounding box of a circle. Longitude degrees shrink with latitude. */
export const circleBBox = (lat, lon, radiusKm) => {
    const dLat = radiusKm / 111.32;
    const cos = Math.cos(lat * DEG);
    const dLon = radiusKm / (111.32 * Math.max(cos, 1e-6));
    return {
        south: Math.max(-85.05, lat - dLat),
        north: Math.min(85.05, lat + dLat),
        west: lon - dLon,
        east: lon + dLon,
    };
};

export const formatDistance = (km) =>
    km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(km < 10 ? 1 : 0)} km`;
