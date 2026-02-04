export const GOOGLE_MAPS_LIBRARIES = ['places', 'geometry'];

export const checkMapsLoaded = () => {
    return window.google && window.google.maps && window.google.maps.places;
};

// We will use the PlacesService for nearby search
// Note: In a real/newer implementation we might use the new Places Library (Place class),
// but strict cost control + "searchNearby" is often easier with the JS SDK Service for now.
export const searchNearbyPlaces = async (mapInstance, center, radiusMeters) => {
    if (!mapInstance) throw new Error("Map instance not ready");

    const service = new window.google.maps.places.PlacesService(mapInstance);

    const request = {
        location: center,
        radius: radiusMeters,
        type: ['restaurant', 'cafe', 'bakery', 'meal_takeaway'],
    };

    return new Promise((resolve, reject) => {
        service.nearbySearch(request, (results, status) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
                // Filter results to ensure they have photos and ratings (vital for our UI)
                const validResults = results.filter(p =>
                    p.photos &&
                    p.photos.length > 0 &&
                    p.rating &&
                    p.user_ratings_total > 5
                );
                resolve(validResults);
            } else if (status === window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
                resolve([]);
            } else {
                reject(status);
            }
        });
    });
};
