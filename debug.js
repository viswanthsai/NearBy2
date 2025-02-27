/**
 * Debug helper functions for the Nearby Essentials app
 */

// Log Places API status codes with descriptions
const placesStatusCodes = {
    'OK': 'The API request was successful.',
    'ZERO_RESULTS': 'The search was successful but returned no results.',
    'OVER_QUERY_LIMIT': 'You are over your quota or rate limit.',
    'REQUEST_DENIED': 'The request was denied, possibly due to invalid API key or restrictions.',
    'INVALID_REQUEST': 'The API request was invalid, check parameters.',
    'UNKNOWN_ERROR': 'Unknown server error.',
    'NOT_FOUND': 'The referenced location was not found.'
};

// Output detailed info about Places API responses
function logPlacesResponse(type, status, results) {
    const statusInfo = placesStatusCodes[status] || 'Status code not recognized';
    
    console.group(`Places API Response: ${type}`);
    console.log(`Status: ${status} - ${statusInfo}`);
    console.log(`Results: ${results ? results.length : 0}`);
    
    if (results && results.length > 0) {
        console.log('First result:', {
            name: results[0].name,
            vicinity: results[0].vicinity,
            types: results[0].types,
            rating: results[0].rating,
            user_ratings_total: results[0].user_ratings_total
        });
    }
    
    if (status !== 'OK' && status !== 'ZERO_RESULTS') {
        console.error('API Error! Check API key and quota.');
    }
    
    console.groupEnd();
}

// Test a specific place search directly
function testPlaceSearch(placeType) {
    if (!map || !userLocation) {
        console.error('Map or user location not available');
        return;
    }
    
    console.log(`Testing place search for: ${placeType}`);
    const service = new google.maps.places.PlacesService(map);
    
    service.nearbySearch({
        location: userLocation,
        radius: 10000,
        type: placeType
    }, function(results, status) {
        logPlacesResponse(`TEST ${placeType}`, status, results);
    });
}

// Expose debug functions to global scope
window.debugApp = {
    testPlaceSearch,
    logPlacesResponse
};

// Add debug shortcuts
document.addEventListener('keydown', function(e) {
    // Ctrl+Shift+D to test hospital search
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        console.log('Debug: Testing hospital search');
        testPlaceSearch('hospital');
    }
    
    // Ctrl+Shift+P to test police search
    if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        console.log('Debug: Testing police search');
        testPlaceSearch('police');
    }
    
    // Ctrl+Shift+F to test fire station search
    if (e.ctrlKey && e.shiftKey && e.key === 'F') {
        console.log('Debug: Testing fire_station search');
        testPlaceSearch('fire_station');
    }
});

// Function to verify Google API key is properly working
function checkApiKey() {
    const scriptTags = document.querySelectorAll('script');
    let apiKeyFound = false;
    let apiKeyScript;
    
    // Check script tags for the Google Maps API key
    scriptTags.forEach(script => {
        if (script.src && script.src.includes('maps.googleapis.com') && script.src.includes('key=')) {
            apiKeyFound = true;
            apiKeyScript = script.src;
        }
    });
    
    if (apiKeyFound) {
        console.log('Google Maps API script found with key');
        // Test if key works with a simple geocoding request
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ address: 'New York' }, function(results, status) {
            if (status === google.maps.GeocoderStatus.OK) {
                console.log('API Key appears to be valid (geocoding works)');
            } else {
                console.error('API Key may have issues. Geocoding failed with status:', status);
                console.warn('Please check your API key and ensure it has the proper API services enabled.');
            }
        });
    } else {
        console.error('No Google Maps API script with key found in the document');
    }
}

// Run API key check when script loads
checkApiKey();
