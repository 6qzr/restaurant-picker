export const calculateHaversineDistance = (loc1, loc2) => {
    if (!loc1 || !loc2) return null;

    const toRad = (value) => (value * Math.PI) / 180;
    const R = 6371; // km

    const lat1 = loc1.lat;
    const lon1 = loc1.lng;
    const lat2 = loc2.lat;
    const lon2 = loc2.lng;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance; // Returns distance in km
};

export const convertMinutesToRadius = (minutes, mode = 'driving') => {
    // Rough estimates for average city speeds
    const speedKmh = mode === 'walking' ? 5 : 30; // 5km/h walk, 30km/h drive
    const distanceKm = (speedKmh * minutes) / 60;
    return distanceKm * 1000; // Return in meters for Google Maps API
};
