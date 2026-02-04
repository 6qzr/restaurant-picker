import { trackApiCall } from './usageTracker';

export const GOOGLE_MAPS_LIBRARIES = ['places', 'geometry'];

export const checkMapsLoaded = () => {
    return window.google && window.google.maps && window.google.maps.places && window.google.maps.places.Place;
};

// Migrate to the new Places Library (Place class)
// Reference: https://developers.google.com/maps/documentation/javascript/places#place_search_nearby
export const searchNearbyPlaces = async (mapInstance, center, radiusMeters, customTypes = []) => {
    if (!window.google.maps.places.Place) {
        throw new Error("Google Maps Places Library (New) not loaded. Ensure libraries=['places'] is set.");
    }

    const defaultTypes = ['restaurant', 'cafe', 'bakery', 'meal_takeaway'];
    // Use custom types if provided, otherwise default to broad food search
    const includedTypes = customTypes.length > 0 ? customTypes : defaultTypes;

    // New API Request Object
    const request = {
        fields: ['displayName', 'rating', 'userRatingCount', 'id', 'shortFormattedAddress', 'types', 'photos', 'location'],
        locationRestriction: {
            center: center,
            radius: radiusMeters,
        },
        includedPrimaryTypes: includedTypes,
        maxResultCount: 20, // Strict limit for cost comparison to old 'nearbySearch' 20 limit
    };

    // Track it!
    trackApiCall();

    console.log("Searching with New Places API:", request);

    try {
        const { places } = await window.google.maps.places.Place.searchNearby(request);

        console.log("New API Raw Places:", places.length);

        // Map New API 'Place' objects to the 'Old' schema expected by our App
        // to avoid rewriting the entire UI layer.
        const mappedResults = places.map(p => {
            return {
                place_id: p.id,
                name: p.displayName, // Accessor returns string
                rating: p.rating,
                user_ratings_total: p.userRatingCount,
                vicinity: p.shortFormattedAddress,
                types: p.types,
                geometry: {
                    location: p.location
                },
                // Bridge the Photo object
                // In New API, p.photos is array of PlacePhoto.
                // We need to match the expected interface: photos[0].getUrl({ maxWidth })
                photos: p.photos ? p.photos.map(photo => ({
                    getUrl: (options) => {
                        try {
                            // New API: photo.getURI({ maxWidth, maxHeight })
                            // Note: methods on PlacePhoto might differ slightly, but standard methods usually align or we can use getURI if available.
                            // Actually, let's try standard getURI if it exists, or fallback.
                            if (typeof photo.getURI === 'function') {
                                return photo.getURI(options);
                            }
                            return "";
                        } catch (e) {
                            console.warn("Photo URL gen failed", e);
                            return "";
                        }
                    }
                })) : []
            };
        });

        const validResults = mappedResults.filter(p =>
            p.rating &&
            p.user_ratings_total > 0
        );

        console.log("Filtered Valid Results:", validResults.length);
        return validResults;

    } catch (error) {
        console.error("Place.searchNearby failed:", error);
        // Handle ZERO_RESULTS equivalent (api throws error? or returns empty?)
        // Usually returns empty list or throws.
        return [];
    }
};
