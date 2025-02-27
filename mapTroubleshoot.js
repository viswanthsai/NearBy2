/**
 * Map Troubleshooting Script
 * This file handles emergency fixes for map rendering issues
 */

// Wait for document to be fully loaded before attempting fixes
document.addEventListener('DOMContentLoaded', function() {
    console.log("Map troubleshooter activated");
    
    // Add extra initialization check (runs after 3 seconds)
    setTimeout(checkMapInitialization, 3000);
});

// Check if map has been properly initialized
function checkMapInitialization() {
    console.log("Checking map initialization status...");
    
    const mapDiv = document.getElementById('map');
    if (!mapDiv) {
        console.error("Map container not found in DOM");
        return;
    }
    
    // Check if map has any children (Google Maps adds elements when initialized)
    if (mapDiv.childElementCount === 0) {
        console.warn("Map container is empty - attempting emergency fixes");
        
        // Try these emergency fixes:
        applyEmergencyFixes();
    } else {
        console.log("Map appears to be initialized correctly with " + mapDiv.childElementCount + " child elements");
    }
}

// Apply emergency fixes for common map issues
function applyEmergencyFixes() {
    // Fix 1: Try to manually initialize the map if global map variable is undefined
    if (typeof window.map === 'undefined' && typeof google !== 'undefined') {
        console.log("Map variable undefined, attempting manual initialization");
        
        try {
            // Get user location or default to a known location
            const center = { lat: 40.7128, lng: -74.0060 }; // Default to New York
            
            // Manually create the map
            window.map = new google.maps.Map(document.getElementById('map'), {
                center: center,
                zoom: 14,
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: false
            });
            
            console.log("Manual map initialization complete");
            
            // Trigger the rest of the app initialization if possible
            if (typeof findNearbyPlaces === 'function') {
                findNearbyPlaces();
            }
        } catch (e) {
            console.error("Manual map initialization failed:", e);
            showMapError();
        }
    }
    
    // Fix 2: Check if map container has zero height
    const mapContainer = document.getElementById('map-container');
    if (mapContainer) {
        const containerHeight = mapContainer.offsetHeight;
        if (containerHeight < 10) { // If container height is essentially zero
            console.warn("Map container has insufficient height:", containerHeight);
            mapContainer.style.height = "400px"; // Force a reasonable height
            
            // Try to refresh map after fixing height
            if (typeof window.map !== 'undefined') {
                google.maps.event.trigger(window.map, 'resize');
            }
        }
    }
    
    // Fix 3: Check if API key might be missing or invalid
    const scriptTags = document.querySelectorAll('script');
    let mapsApiFound = false;
    
    scriptTags.forEach(script => {
        if (script.src && script.src.includes('maps.googleapis.com')) {
            mapsApiFound = true;
            if (!script.src.includes('key=')) {
                console.error("Google Maps script found but API key appears to be missing");
                showMapError("API key missing");
            }
        }
    });
    
    if (!mapsApiFound) {
        console.error("Google Maps API script not found on page");
        showMapError("Maps API not loaded");
    }
}

// Display user-friendly error message when map fails
function showMapError(reason = "unknown") {
    const mapDiv = document.getElementById('map');
    if (!mapDiv) return;
    
    // Clear any existing content
    mapDiv.innerHTML = '';
    
    // Create error message container
    const errorContainer = document.createElement('div');
    errorContainer.className = 'flex flex-col items-center justify-center h-full bg-gray-100 rounded-lg p-4 text-center';
    errorContainer.innerHTML = `
        <div class="text-red-500 mb-2"><i class="fas fa-exclamation-circle text-3xl"></i></div>
        <h3 class="font-medium mb-2">Map could not be displayed</h3>
        <p class="text-sm text-gray-600 mb-3">There was a problem loading Google Maps</p>
        <button class="px-4 py-2 bg-primary text-white rounded-lg text-sm" 
                onclick="window.location.reload()">Reload Page</button>
    `;
    
    mapDiv.appendChild(errorContainer);
    
    // Also log detailed error for developers
    console.error(`Map failed to load. Reason: ${reason}`);
}
