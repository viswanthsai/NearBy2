// Global variables
let map;
let service;
let userMarker;
let userLocation;
let markers = [];
let places = [];
let searchRadius = 5000; // Default: 5km
let radiusCircle;
let customLocationMode = false;
let filterFakePlaces = true;
let emergencyMode = false;

// Place categories
const placeCategories = [
    { type: "hospital", icon: "fa-hospital", label: "Hospitals", color: "#ef4444" },
    { type: "police", icon: "fa-building-shield", label: "Police Stations", color: "#3b82f6" },
    { type: "fire_station", icon: "fa-fire-extinguisher", label: "Fire Stations", color: "#f97316" },
    { type: "pharmacy", icon: "fa-prescription-bottle-medical", label: "Pharmacies", color: "#22c55e" },
    { type: "school", icon: "fa-school", label: "Schools", color: "#f97316" },
    { type: "bank", icon: "fa-landmark", label: "Banks", color: "#6366f1" },
    { type: "restaurant", icon: "fa-utensils", label: "Restaurants", color: "#ec4899" },
    { type: "supermarket", icon: "fa-shopping-cart", label: "Grocery Stores", color: "#14b8a6" },
    { type: "airport", icon: "fa-plane", label: "Airports", color: "#8b5cf6", specialRadius: true },
    { type: "train_station", icon: "fa-train", label: "Train Stations", color: "#f59e0b", specialRadius: true }
];

// Initialize app
function initApp() {
    console.log("App initializing");
    
    // Set up event listeners
    document.getElementById('search-btn').addEventListener('click', updateRadius);
    document.getElementById('recenter-btn').addEventListener('click', recenterMap);
    document.getElementById('custom-location-btn').addEventListener('click', toggleCustomLocationMode);
    document.getElementById('sort-select').addEventListener('change', function(e) {
        sortPlaces(e.target.value);
    });
    document.getElementById('fake-filter').addEventListener('change', function(e) {
        filterFakePlaces = e.target.checked;
        findNearbyPlaces();
    });
    document.getElementById('about-btn').addEventListener('click', showAbout);
    document.getElementById('location-search-btn').addEventListener('click', searchLocation);
    document.getElementById('location-search').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') searchLocation();
    });
    document.querySelector('.close-btn').addEventListener('click', closeModal);
    
    // Set up emergency buttons
    document.getElementById('emergency-hospital').addEventListener('click', function() {
        handleEmergencySearch('hospital');
    });
    document.getElementById('emergency-police').addEventListener('click', function() {
        handleEmergencySearch('police');
    });
    document.getElementById('emergency-fire').addEventListener('click', function() {
        handleEmergencySearch('fire_station');
    });
    
    // Set up filter options
    setupFilterOptions();
    
    // Initialize map
    if (typeof google !== 'undefined' && typeof google.maps !== 'undefined') {
        initializeMap();
        
        // Start map health monitoring after a delay
        setTimeout(() => {
            if (window.mapFix && window.mapFix.monitorMapHealth) {
                window.mapFix.monitorMapHealth();
            }
        }, 3000);
    } else {
        document.querySelector('#results-list').innerHTML = 
            '<div class="flex flex-col items-center justify-center text-gray-500 h-full"><i class="fas fa-exclamation-triangle text-3xl mb-4 text-yellow-500"></i><span>Google Maps failed to load. Please check your internet connection and reload.</span></div>';
    }

    // Add toggle results button for mobile
    document.getElementById('toggle-results-btn').addEventListener('click', function() {
        const resultsContainer = document.getElementById('results-container');
        resultsContainer.classList.toggle('hidden');
    });
}

// Handle emergency search - fixed implementation
function handleEmergencySearch(serviceType) {
    console.log(`Emergency search for: ${serviceType}`); // Debug log
    
    // Enter emergency mode
    emergencyMode = true;
    
    // Visual feedback - show pulsing effect
    const emergencyContainer = document.querySelector('.emergency-container');
    emergencyContainer.classList.add('pulsing');
    
    // Update results header to indicate emergency mode
    document.querySelector('#results-container h2').innerHTML = `
        <span class="flex items-center gap-2 text-red-600">
            <i class="fas fa-exclamation-triangle"></i> 
            Emergency: Finding ${serviceType === 'fire_station' ? 'Fire Stations' : 
                              serviceType === 'hospital' ? 'Hospitals' : 'Police Stations'}
        </span>
    `;
    
    // Show loading indicator
    document.querySelector('#results-list').innerHTML = `
        <div class="flex flex-col items-center justify-center text-red-500 h-full">
            <i class="fas fa-spinner fa-spin text-3xl mb-4"></i>
            <span>Locating nearest ${serviceType === 'fire_station' ? 'fire stations' : 
                              serviceType === 'hospital' ? 'hospitals' : 'police stations'}...</span>
        </div>
    `;
    
    // Clear existing places and markers
    places = [];
    clearMarkers();
    
    // Use a larger radius for emergency services and DISABLE the rankBy parameter
    // You cannot use both radius and rankBy:DISTANCE together
    const emergencyRadius = 10000; // 10km for emergency services
    
    // Create places service
    service = new google.maps.places.PlacesService(map);
    
    // Perform the search for emergency services
    service.nearbySearch({
        location: userLocation,
        radius: emergencyRadius,
        type: serviceType
        // Removed rankBy parameter - it conflicts with radius
    }, function(results, status) {
        console.log(`Emergency search results for ${serviceType}:`, status, results ? results.length : 0); // Debug log
        
        // Reset pulsing effect
        emergencyContainer.classList.remove('pulsing');
        
        if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
            console.log(`Found ${results.length} emergency ${serviceType} locations`);
            
            // Process all results and sort by distance
            results.forEach(place => {
                const category = placeCategories.find(c => c.type === serviceType);
                if (!category) return;
                
                const distance = google.maps.geometry.spherical.computeDistanceBetween(
                    new google.maps.LatLng(userLocation.lat, userLocation.lng),
                    place.geometry.location
                );
                
                places.push({
                    id: place.place_id,
                    name: place.name,
                    location: place.geometry.location,
                    distance: distance,
                    category: category.type,
                    categoryLabel: category.label,
                    categoryIcon: category.icon,
                    categoryColor: category.color,
                    rating: place.rating || 0,
                    vicinity: place.vicinity,
                    photos: place.photos,
                    user_ratings_total: place.user_ratings_total || 0,
                    isEmergency: true // Mark as emergency service
                });
            });
            
            // Sort by distance
            places.sort((a, b) => a.distance - b.distance);
            
            // Display results
            displayEmergencyResults(serviceType);
            
        } else {
            console.warn(`Emergency ${serviceType} search failed:`, status);
            document.querySelector('#results-list').innerHTML = `
                <div class="flex flex-col items-center justify-center text-gray-500 h-full">
                    <i class="fas fa-exclamation-triangle text-3xl mb-4 text-red-500"></i>
                    <span>No ${serviceType === 'fire_station' ? 'fire stations' : 
                              serviceType === 'hospital' ? 'hospitals' : 'police stations'} found nearby.</span>
                    <button id="expand-emergency-radius" class="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg">
                        Search Wider Area
                    </button>
                </div>
            `;
            
            document.getElementById('expand-emergency-radius').addEventListener('click', function() {
                // Double the radius and try again
                const newRadius = emergencyRadius * 2;
                handleEmergencySearchWithRadius(serviceType, newRadius);
            });
        }
    });
}

// New function with explicit radius parameter
function handleEmergencySearchWithRadius(serviceType, radius) {
    console.log(`Emergency search with custom radius: ${serviceType}, ${radius}m`); // Debug log
    
    // Show loading indicator
    document.querySelector('#results-list').innerHTML = `
        <div class="flex flex-col items-center justify-center text-red-500 h-full">
            <i class="fas fa-spinner fa-spin text-3xl mb-4"></i>
            <span>Searching wider area for ${serviceType === 'fire_station' ? 'fire stations' : 
                              serviceType === 'hospital' ? 'hospitals' : 'police stations'}...</span>
        </div>
    `;
    
    // Clear existing places and markers
    places = [];
    clearMarkers();
    
    // Create places service
    service = new google.maps.places.PlacesService(map);
    
    // Perform the search with custom radius
    service.nearbySearch({
        location: userLocation,
        radius: radius,
        type: serviceType
    }, function(results, status) {
        console.log(`Wide area search results for ${serviceType}:`, status, results ? results.length : 0);
        
        if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
            console.log(`Found ${results.length} emergency ${serviceType} locations in wider area`);
            
            // Process all results and sort by distance
            results.forEach(place => {
                const category = placeCategories.find(c => c.type === serviceType);
                if (!category) return;
                
                const distance = google.maps.geometry.spherical.computeDistanceBetween(
                    new google.maps.LatLng(userLocation.lat, userLocation.lng),
                    place.geometry.location
                );
                
                places.push({
                    id: place.place_id,
                    name: place.name,
                    location: place.geometry.location,
                    distance: distance,
                    category: category.type,
                    categoryLabel: category.label,
                    categoryIcon: category.icon,
                    categoryColor: category.color,
                    rating: place.rating || 0,
                    vicinity: place.vicinity,
                    photos: place.photos,
                    user_ratings_total: place.user_ratings_total || 0,
                    isEmergency: true
                });
            });
            
            // Sort by distance
            places.sort((a, b) => a.distance - b.distance);
            
            // Display results
            displayEmergencyResults(serviceType);
            
        } else {
            document.querySelector('#results-list').innerHTML = `
                <div class="flex flex-col items-center justify-center text-gray-500 h-full">
                    <i class="fas fa-exclamation-triangle text-3xl mb-4 text-red-500"></i>
                    <span>Still couldn't find any ${serviceType === 'fire_station' ? 'fire stations' : 
                              serviceType === 'hospital' ? 'hospitals' : 'police stations'} in this area.</span>
                    <button id="exit-emergency-mode-btn" class="mt-4 bg-gray-600 text-white px-4 py-2 rounded-lg">
                        Exit Emergency Mode
                    </button>
                </div>
            `;
            
            document.getElementById('exit-emergency-mode-btn').addEventListener('click', exitEmergencyMode);
        }
    });
}

// Display emergency results with enhanced UI
function displayEmergencyResults(serviceType) {
    // Clear results container
    const resultsContainer = document.getElementById('results-list');
    resultsContainer.innerHTML = '';
    resultsContainer.classList.add('emergency-mode');
    
    if (places.length === 0) {
        resultsContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center text-gray-500 h-full">
                <i class="fas fa-exclamation-triangle text-3xl mb-4 text-red-500"></i>
                <span>No ${serviceType === 'fire_station' ? 'fire stations' : 
                          serviceType === 'hospital' ? 'hospitals' : 'police stations'} found nearby.</span>
            </div>
        `;
        return;
    }
    
    // Add exit emergency mode button with enhanced styling
    const exitButton = document.createElement('div');
    exitButton.className = 'bg-red-50 p-3 mb-4 rounded-lg flex justify-between items-center border border-red-200 shadow-sm';
    exitButton.innerHTML = `
        <span class="text-red-600 font-medium flex items-center gap-2">
            <i class="fas fa-exclamation-circle"></i> Emergency Mode
        </span>
        <button id="exit-emergency-mode" class="text-sm bg-white hover:bg-gray-100 px-3 py-1 rounded-lg shadow-sm">
            Exit
        </button>
    `;
    resultsContainer.appendChild(exitButton);
    
    document.getElementById('exit-emergency-mode').addEventListener('click', function() {
        exitEmergencyMode();
    });
    
    // Create section for emergency places
    const emergencySection = document.createElement('div');
    emergencySection.className = 'mb-6';
    
    // Get category info
    const category = placeCategories.find(c => c.type === serviceType);
    
    // Choose appropriate colors based on service type
    let headerBgColor, headerTextColor, headerBorderColor;
    
    if (serviceType === 'hospital') {
        headerBgColor = 'bg-red-50';
        headerTextColor = 'text-red-700';
        headerBorderColor = 'border-red-200';
    } else if (serviceType === 'police') {
        headerBgColor = 'bg-blue-50';
        headerTextColor = 'text-blue-700';
        headerBorderColor = 'border-blue-200';
    } else if (serviceType === 'fire_station') {
        headerBgColor = 'bg-orange-50';
        headerTextColor = 'text-orange-700';
        headerBorderColor = 'border-orange-200';
    }
    
    // Add category header with service-specific styling
    const categoryHeader = document.createElement('div');
    categoryHeader.className = `flex items-center gap-2 pb-2 mb-3 border-b ${headerBorderColor} ${headerBgColor} p-2 rounded-t-lg`;
    
    const iconColor = category ? category.color : '#ef4444';
    let iconClass = category ? category.icon : 'fa-exclamation-circle';
    
    categoryHeader.innerHTML = `
        <div class="w-9 h-9 rounded-full flex items-center justify-center" style="background-color: ${iconColor}20; color: ${iconColor}">
            <i class="fas ${iconClass} text-lg"></i>
        </div>
        <h3 class="font-medium ${headerTextColor}">Nearest ${category ? category.label : 'Emergency Services'} (${places.length})</h3>
    `;
    emergencySection.appendChild(categoryHeader);
    
    // Add places
    places.forEach((place, index) => {
        // Create place card with enhanced styling
        const placeCard = document.createElement('div');
        placeCard.className = 'bg-white p-3 mb-3 rounded-lg shadow-sm border-l-4 hover:shadow-md transition-shadow cursor-pointer emergency-place';
        placeCard.setAttribute('data-type', place.category);
        
        // Set border color based on service type
        if (place.category === 'hospital') {
            placeCard.style.borderLeftColor = 'var(--hospital-color)';
        } else if (place.category === 'police') {
            placeCard.style.borderLeftColor = 'var(--police-color)';
        } else if (place.category === 'fire_station') {
            placeCard.style.borderLeftColor = 'var(--fire-color)';
        } else {
            placeCard.style.borderLeftColor = 'var(--emergency-color)';
        }
        
        // Add distance badge for closest place
        const distanceBadge = index === 0 ? 
            `<span class="absolute top-2 right-2 bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded-full">Closest</span>` : '';
        
        // Add place details with enhanced UI
        placeCard.innerHTML = `
            <div class="relative">
                ${distanceBadge}
                <h4 class="font-medium text-gray-800 pr-16">${place.name}</h4>
                <div class="flex items-center gap-2 mt-1">
                    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        <i class="fas fa-map-marker-alt text-red-500 mr-1"></i> ${formatDistance(place.distance)}
                    </span>
                    ${place.rating ? `
                        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800">
                            <i class="fas fa-star text-amber-500 mr-1"></i> ${place.rating.toFixed(1)}
                        </span>
                    ` : ''}
                </div>
                <p class="text-sm text-gray-600 flex items-center gap-1 mt-2">
                    <i class="fas fa-location-dot"></i> ${place.vicinity || 'Address not available'}
                </p>
                <div class="flex justify-between items-center mt-3">
                    <button class="call-btn text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded flex items-center gap-1 hover:bg-gray-200">
                        <i class="fas fa-phone"></i> Call
                    </button>
                    <button class="directions-btn text-xs bg-green-600 text-white px-3 py-1.5 rounded flex items-center gap-1 hover:bg-green-700">
                        <i class="fas fa-directions"></i> Get Directions
                    </button>
                </div>
            </div>
        `;
        
        // Add click event
        placeCard.addEventListener('click', function() {
            showPlaceDetails(place.id);
        });
        
        // Add directions button click
        placeCard.querySelector('.directions-btn').addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent the card click event
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(place.name)}&destination_place_id=${place.id}`, '_blank');
        });
        
        // Add to category section
        emergencySection.appendChild(placeCard);
        
        // Add marker to map
        addEmergencyMarker(place);
    });
    
    // Add emergency section to results
    resultsContainer.appendChild(emergencySection);
    
    // If we have at least one result, center map on the closest one
    if (places.length > 0) {
        map.panTo(places[0].location);
        map.setZoom(15); // Zoom in a bit more
        
        // Open info window for closest location
        if (markers.length > 0) {
            const closestMarker = markers[0]; // First marker is closest
            const infoContent = `
                <div style="padding: 10px; max-width: 240px; font-family: Arial, sans-serif;">
                    <div style="font-weight: bold; font-size: 14px; margin-bottom: 5px; color: #111827;">${places[0].name}</div>
                    <div style="font-size: 12px; margin-bottom: 8px; color: #4b5563;">${places[0].vicinity}</div>
                    <div style="display: flex; align-items: center; margin-bottom: 10px;">
                        <div style="background-color: #10b981; color: white; font-size: 10px; padding: 1px 6px; border-radius: 10px; margin-right: 6px;">CLOSEST</div>
                        <div style="font-size: 12px; color: #4b5563;">${formatDistance(places[0].distance)} away</div>
                    </div>
                    <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(places[0].name)}&destination_place_id=${places[0].id}" target="_blank" 
                        style="display: block; text-align: center; background: #16a34a; color: white; padding: 8px 12px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 500;">
                        Get Directions
                    </a>
                </div>
            `;
            
            const infoWindow = new google.maps.InfoWindow({
                content: infoContent
            });
            
            infoWindow.open(map, closestMarker);
        }
    }
}

// Add emergency marker to map with improved symbols
function addEmergencyMarker(place) {
    let icon;
    
    // Create custom icons based on emergency type
    if (place.category === 'police') {
        // Enhanced police station icon
        icon = {
            path: 'M 0,0 m -12,-30 h 24 v 24 h -24 z M 0,-18 c -9,0 -9,9 0,9 9,0 9,-9 0,-9 M -11,-9 v 9 h 22 v -9 z',
            fillColor: '#3b82f6', // Blue for police
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            scale: 0.9,
            anchor: new google.maps.Point(0, 0)
        };
    } else if (place.category === 'hospital') {
        // Enhanced hospital icon (cross symbol)
        icon = {
            path: 'M -10,-30 h 20 v 10 h 10 v 20 h -10 v 10 h -20 v -10 h -10 v -20 h 10 z',
            fillColor: '#ef4444', // Red for hospital
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            scale: 0.7,
            anchor: new google.maps.Point(0, 0)
        };
    } else if (place.category === 'fire_station') {
        // Enhanced fire station icon (flame-like)
        icon = {
            path: 'M -8,-30 c 0,0 8,10 8,16 0,5 -8,5 -8,0 -4,7 -4,14 0,14 8,0 16,-10 16,-20 0,-5 -3,-10 -8,-10 z',
            fillColor: '#f97316', // Orange for fire station
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            scale: 0.9,
            anchor: new google.maps.Point(0, 0)
        };
    } else {
        // Default pin for other emergency services
        icon = {
            path: 'M 0,0 C -2,-20 -10,-22 -10,-30 A 10,10 0 1,1 10,-30 C 10,-22 2,-20 0,0 z',
            fillColor: '#ef4444', // Red for default emergency
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 2,
            scale: 1.2 // Slightly larger for emergency markers
        };
    }
    
    const marker = new google.maps.Marker({
        map: map,
        position: place.location,
        title: place.name,
        icon: icon,
        animation: google.maps.Animation.DROP,
        zIndex: 1000 // Make emergency markers appear above other markers
    });
    
    // Add click listener
    marker.addListener('click', function() {
        showPlaceDetails(place.id);
    });
    
    // Store marker
    markers.push(marker);
}

// Exit emergency mode
function exitEmergencyMode() {
    emergencyMode = false;
    
    // Reset UI
    document.querySelector('#results-container h2').textContent = 'Nearby Places';
    document.getElementById('results-list').classList.remove('emergency-mode');
    
    // Return to normal search
    findNearbyPlaces();
}

// Set up filter options
function setupFilterOptions() {
    const filterContainer = document.getElementById('filter-options');
    if (!filterContainer) return;
    
    // Clear existing options
    filterContainer.innerHTML = '';
    
    // Add "All" option
    const allChip = document.createElement('div');
    allChip.className = 'px-3 py-1 rounded-full bg-blue-100 text-primary border border-blue-200 cursor-pointer hover:bg-blue-200 transition-colors';
    allChip.dataset.category = 'all';
    allChip.textContent = 'All';
    allChip.addEventListener('click', function() {
        document.querySelectorAll('#filter-options > div').forEach(c => 
            c.className = 'px-3 py-1 rounded-full bg-gray-100 text-gray-700 border border-transparent cursor-pointer hover:bg-gray-200 transition-colors'
        );
        this.className = 'px-3 py-1 rounded-full bg-blue-100 text-primary border border-blue-200 cursor-pointer hover:bg-blue-200 transition-colors';
        filterPlacesByCategory('all');
    });
    filterContainer.appendChild(allChip);
    
    // Add each category
    placeCategories.forEach(category => {
        const chip = document.createElement('div');
        chip.className = 'px-3 py-1 rounded-full bg-gray-100 text-gray-700 border border-transparent cursor-pointer hover:bg-gray-200 transition-colors';
        chip.dataset.category = category.type;
        chip.textContent = category.label;
        chip.addEventListener('click', function() {
            document.querySelectorAll('#filter-options > div').forEach(c => 
                c.className = 'px-3 py-1 rounded-full bg-gray-100 text-gray-700 border border-transparent cursor-pointer hover:bg-gray-200 transition-colors'
            );
            this.className = 'px-3 py-1 rounded-full bg-blue-100 text-primary border border-blue-200 cursor-pointer hover:bg-blue-200 transition-colors';
            filterPlacesByCategory(category.type);
        });
        filterContainer.appendChild(chip);
    });
}

// Initialize map
function initializeMap() {
    document.querySelector('#results-list').innerHTML = 
        '<div class="flex flex-col items-center justify-center text-gray-500 h-full"><i class="fas fa-spinner fa-spin text-3xl mb-4 text-primary"></i><span>Getting your location...</span></div>';
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                // Success callback
                userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                createMap(userLocation);
            },
            function(error) {
                // Error callback - use default location
                document.querySelector('#results-list').innerHTML = 
                    '<div class="flex flex-col items-center justify-center text-gray-500 h-full"><i class="fas fa-exclamation-triangle text-3xl mb-4 text-yellow-500"></i><span>Could not access your location. Using default.</span></div>';
                userLocation = { lat: 40.7128, lng: -74.0060 }; // Default: New York
                createMap(userLocation);
            }
        );
    } else {
        // Geolocation not supported
        document.querySelector('#results-list').innerHTML = 
            '<div class="flex flex-col items-center justify-center text-gray-500 h-full"><i class="fas fa-exclamation-triangle text-3xl mb-4 text-yellow-500"></i><span>Geolocation not supported. Using default location.</span></div>';
        userLocation = { lat: 40.7128, lng: -74.0060 }; // Default: New York
        createMap(userLocation);
    }
}

// Create map - update with recovery functionality
function createMap(center) {
    try {
        console.log("Creating map with center:", center);
        
        // Store the center for map recovery
        window.lastMapCenter = center;
        
        // Create map with error handling
        map = new google.maps.Map(document.getElementById('map'), {
            center: center,
            zoom: 14,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            gestureHandling: 'greedy', // Improves mobile experience
            minZoom: 3, // Prevent zooming out too far
            maxZoom: 18 // Prevent zooming in too far
        });
        
        // Add event handlers for map stability
        google.maps.event.addListenerOnce(map, 'idle', function() {
            console.log("Map idle event fired");
            if (window.mapFix) window.mapFix.mapLoaded();
        });
        
        google.maps.event.addListenerOnce(map, 'tilesloaded', function() {
            console.log("Map tiles loaded");
        });
        
        // Add recovery function to window object
        window.rebuildMap = function() {
            const mapDiv = document.getElementById('map');
            
            // Clear the existing map
            mapDiv.innerHTML = '';
            
            // Recreate the map
            try {
                map = new google.maps.Map(mapDiv, {
                    center: window.lastMapCenter || center,
                    zoom: 14,
                    mapTypeControl: false,
                    streetViewControl: false,
                    fullscreenControl: false,
                    gestureHandling: 'greedy'
                });
                
                // Re-add markers
                if (userMarker) {
                    userMarker.setMap(map);
                }
                
                if (radiusCircle) {
                    radiusCircle.setMap(map);
                }
                
                // Re-add all place markers
                markers.forEach(marker => {
                    marker.setMap(map);
                });
                
                if (window.mapFix) window.mapFix.clearMapMessage();
            } catch (e) {
                console.error("Failed to rebuild map:", e);
            }
        };
        
        // Add user marker
        userMarker = new google.maps.Marker({
            position: center,
            map: map,
            title: "Your location",
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8, // Reduced from 10
                fillColor: "#3b82f6",
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 2
            },
            zIndex: 1000
        });
        
        // Add radius circle
        radiusCircle = new google.maps.Circle({
            strokeColor: "#3b82f6",
            strokeOpacity: 0.2, // Reduced opacity
            strokeWeight: 1, // Thinner stroke
            fillColor: "#3b82f6",
            fillOpacity: 0.08, // Reduced opacity
            map: map,
            center: center,
            radius: searchRadius,
            clickable: false
        });
        
        // Add click listener for custom location
        map.addListener('click', function(event) {
            if (customLocationMode) {
                setCustomLocation(event.latLng);
            }
        });
        
        // Ensure full rendering before searching for places
        setTimeout(() => {
            // Search for nearby places
            findNearbyPlaces();
        }, 800);
        
    } catch (error) {
        console.error("Error creating map:", error);
        document.querySelector('#results-list').innerHTML = 
            '<div class="flex flex-col items-center justify-center text-gray-500 h-full">' +
            '<i class="fas fa-exclamation-triangle text-3xl mb-4 text-yellow-500"></i>' +
            '<span>Error creating map. Try refreshing the page.</span>' +
            '<button onclick="window.location.reload()" class="mt-4 bg-primary text-white px-4 py-2 rounded-lg">Refresh Page</button>' +
            '</div>';
    }
}

// Find nearby places - Added more default categories
function findNearbyPlaces() {
    clearResults();
    
    // Make userLocation visible to debug script
    window.userLocation = userLocation;
    
    document.getElementById('results-list').innerHTML = 
        '<div class="flex flex-col items-center justify-center text-gray-500 h-full"><i class="fas fa-spinner fa-spin text-3xl mb-4 text-primary"></i><span>Finding nearby places...</span></div>';
    
    // Output debugging information
    console.log("Searching for places near:", userLocation);
    console.log("Search radius:", searchRadius);
    
    // Create places service
    service = new google.maps.places.PlacesService(map);
    
    // MODIFIED: Include more categories in default search
    const essentialCategories = placeCategories.filter(cat => 
        ['hospital', 'pharmacy', 'police', 'bank', 'restaurant', 'supermarket'].includes(cat.type)
    );
    
    console.log("Searching for categories:", essentialCategories.map(cat => cat.label));
    
    // Track completion
    let completedRequests = 0;
    let totalRequests = essentialCategories.length;
    let hasFoundAnyResults = false;
    
    // Use a smaller radius to reduce load but ensure visibility
    const effectiveRadius = Math.min(searchRadius, 3000); // Never use more than 3km for API call
    
    // Search for each category
    essentialCategories.forEach(category => {
        const radius = category.specialRadius ? 20000 : effectiveRadius;
        console.log(`Searching for ${category.type} with radius ${radius}m`);
        
        service.nearbySearch({
            location: userLocation,
            radius: radius,
            type: category.type
        }, function(results, status) {
            completedRequests++;
            
            console.log(`${category.type} search status:`, status);
            console.log(`${category.type} results:`, results ? results.length : 0);
            
            if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
                hasFoundAnyResults = true;
                processResults(results, category);
            } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
                console.log(`No ${category.type} found within ${radius}m`);
            } else {
                console.warn(`Places API error for ${category.type}:`, status);
            }
            
            // Check if all requests are complete
            if (completedRequests === totalRequests) {
                if (places.length > 0) {
                    displayPlaces();
                } else {
                    // Try with filter off if needed
                    if (filterFakePlaces && !hasFoundAnyResults) {
                        console.log("No places found with filter ON. Retrying with filter OFF...");
                        filterFakePlaces = false;
                        document.getElementById('fake-filter').checked = false;
                        findNearbyPlaces();
                        return;
                    }
                    
                    document.getElementById('results-list').innerHTML = 
                        '<div class="flex flex-col items-center justify-center text-gray-500 h-full">' + 
                        '<i class="fas fa-info-circle text-3xl mb-4 text-blue-500"></i>' + 
                        '<span>No places found in this area.</span>' +
                        '<button id="expand-radius-btn" class="mt-4 bg-primary text-white px-4 py-2 rounded-lg">Expand search radius</button>' +
                        '</div>';
                    
                    // Add event listener for expand radius button
                    document.getElementById('expand-radius-btn').addEventListener('click', function() {
                        const newRadius = searchRadius * 2;
                        if (newRadius <= 50000) { // Max 50km
                            searchRadius = newRadius;
                            document.getElementById('radius-input').value = searchRadius / 1000;
                            radiusCircle.setRadius(searchRadius);
                            findNearbyPlaces();
                        } else {
                            showToast("Maximum search radius reached");
                        }
                    });
                }
            }
        });
    });
}

// Process search results - reduce to 2 locations per category
function processResults(results, category) {
    console.log(`Processing ${results.length} ${category.type} results`);
    
    // Log all results before filtering
    if (results.length > 0) {
        console.log(`Example ${category.type}:`, results[0].name);
    }
    
    // Filter to places with ratings (but make it less restrictive)
    let filteredResults = results;
    
    // Only apply rating filter for certain categories
    if (['restaurant', 'cafe', 'bar', 'hotel'].includes(category.type)) {
        filteredResults = results.filter(place => place.rating && place.user_ratings_total > 0);
        console.log(`After rating filter: ${filteredResults.length} places`);
    }
    
    // Filter out fake places if enabled
    if (filterFakePlaces) {
        const beforeCount = filteredResults.length;
        filteredResults = filteredResults.filter(place => !isFakePlace(place));
        console.log(`After fake filter: ${filteredResults.length} places (removed ${beforeCount - filteredResults.length})`);
    }
    
    // Get top rated places - CHANGED FROM 5 TO 2 to reduce API load
    let topPlaces;
    if (filteredResults.length > 0) {
        topPlaces = filteredResults
            .sort((a, b) => b.rating - a.rating)
            .slice(0, 2); // REDUCED from 5 to 2
    } else {
        // If no places with ratings, just use the top 2 places
        topPlaces = results.slice(0, 2); // REDUCED from 5 to 2
    }
    
    console.log(`Adding ${topPlaces.length} ${category.type} to results`);
    
    // Add to places array
    topPlaces.forEach(place => {
        const distance = google.maps.geometry.spherical.computeDistanceBetween(
            new google.maps.LatLng(userLocation.lat, userLocation.lng),
            place.geometry.location
        );
        
        places.push({
            id: place.place_id,
            name: place.name,
            location: place.geometry.location,
            distance: distance,
            category: category.type,
            categoryLabel: category.label,
            categoryIcon: category.icon,
            categoryColor: category.color,
            rating: place.rating || 0,
            vicinity: place.vicinity,
            photos: place.photos,
            user_ratings_total: place.user_ratings_total || 0
        });
    });
}

// Make the isFakePlace function less restrictive
function isFakePlace(place) {
    const name = place.name.toLowerCase();
    const vicinity = (place.vicinity || "").toLowerCase();
    
    // Check for obvious suspicious keywords only
    const suspiciousWords = ["test", "fake", "placeholder"];
    if (suspiciousWords.some(word => name === word)) { // Only filter exact matches
        return true;
    }
    
    // No longer checking for perfect ratings or generic names
    // This was too restrictive and filtered legitimate results
    
    return false;
}

// Display places on map and in list
function displayPlaces() {
    // Group places by category
    const placesByCategory = {};
    places.forEach(place => {
        if (!placesByCategory[place.category]) {
            placesByCategory[place.category] = [];
        }
        placesByCategory[place.category].push(place);
    });
    
    // Clear results container
    const resultsContainer = document.getElementById('results-list');
    resultsContainer.innerHTML = '';
    
    // Display empty state if no places
    if (places.length === 0) {
        resultsContainer.innerHTML = 
            '<div class="flex flex-col items-center justify-center text-gray-500 h-full"><i class="fas fa-info-circle text-3xl mb-4 text-blue-500"></i><span>No places found in this area.</span></div>';
        return;
    }
    
    // For each category with places
    Object.keys(placesByCategory).forEach(categoryKey => {
        const categoryPlaces = placesByCategory[categoryKey];
        const category = placeCategories.find(c => c.type === categoryKey);
        
        if (!category) return;
        
        // Create category section
        const categorySection = document.createElement('div');
        categorySection.className = 'mb-6';
        
        // Add category header
        const categoryHeader = document.createElement('div');
        categoryHeader.className = 'flex items-center gap-2 pb-2 mb-3 border-b border-gray-200';
        
        const iconColor = category.color;
        const bgColor = `${category.color}20`;
        
        categoryHeader.innerHTML = `
            <div class="w-8 h-8 rounded-full flex items-center justify-center" style="background-color: ${bgColor}; color: ${iconColor}">
                <i class="fas ${category.icon}"></i>
            </div>
            <h3 class="font-medium">${category.label} (${categoryPlaces.length})</h3>
        `;
        categorySection.appendChild(categoryHeader);
        
        // Add places
        categoryPlaces.forEach(place => {
            // Create place card
            const placeCard = document.createElement('div');
            placeCard.className = 'bg-white p-3 mb-3 rounded-lg shadow-sm border-l-4 hover:shadow-md transition-shadow cursor-pointer';
            placeCard.style.borderLeftColor = place.categoryColor;
            
            // Add place details
            placeCard.innerHTML = `
                <h4 class="font-medium text-gray-800">${place.name}</h4>
                <p class="text-sm text-gray-600 flex items-center gap-1"><i class="fas fa-map-marker-alt"></i> ${formatDistance(place.distance)}</p>
                <p class="text-sm text-gray-600 flex items-center gap-1"><i class="fas fa-location-dot"></i> ${place.vicinity || 'Address not available'}</p>
                <div class="flex justify-between items-center mt-2">
                    <div class="flex items-center gap-1">
                        <i class="fas fa-star text-amber-500"></i>
                        <span class="text-gray-700">${place.rating.toFixed(1)}</span>
                        <span class="text-xs text-gray-500">(${place.user_ratings_total})</span>
                    </div>
                </div>
            `;
            
            // Add click event
            placeCard.addEventListener('click', function() {
                showPlaceDetails(place.id);
            });
            
            // Add to category section
            categorySection.appendChild(placeCard);
            
            // Add marker to map
            addMarker(place);
        });
        
        // Add category to results
        resultsContainer.appendChild(categorySection);
    });
}

// Filter places by category
function filterPlacesByCategory(category) {
    // Clear existing markers
    clearMarkers();
    
    // Get filtered places
    const filtered = category === 'all' ? 
        places : places.filter(place => place.category === category);
    
    // Update results container
    const resultsContainer = document.getElementById('results-list');
    resultsContainer.innerHTML = '';
    
    if (filtered.length === 0) {
        resultsContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center text-gray-500 h-full">
                <i class="fas fa-info-circle text-3xl mb-4 text-blue-500"></i>
                <span>No ${category !== 'all' ? placeCategories.find(c => c.type === category).label : 'places'} found.</span>
            </div>
        `;
        return;
    }
    
    // Group by category
    const placesByCategory = {};
    filtered.forEach(place => {
        if (!placesByCategory[place.category]) {
            placesByCategory[place.category] = [];
        }
        placesByCategory[place.category].push(place);
    });
    
    // Display places by category
    Object.keys(placesByCategory).forEach(categoryKey => {
        const categoryPlaces = placesByCategory[categoryKey];
        const categoryInfo = placeCategories.find(c => c.type === categoryKey);
        
        // Create category section
        const categorySection = document.createElement('div');
        categorySection.className = 'mb-6';
        
        // Add category header
        const categoryHeader = document.createElement('div');
        categoryHeader.className = 'flex items-center gap-2 pb-2 mb-3 border-b border-gray-200';
        
        const iconColor = categoryInfo.color;
        const bgColor = `${categoryInfo.color}20`;
        
        categoryHeader.innerHTML = `
            <div class="w-8 h-8 rounded-full flex items-center justify-center" style="background-color: ${bgColor}; color: ${iconColor}">
                <i class="fas ${categoryInfo.icon}"></i>
            </div>
            <h3 class="font-medium">${categoryInfo.label} (${categoryPlaces.length})</h3>
        `;
        categorySection.appendChild(categoryHeader);
        
        // Add places
        categoryPlaces.forEach(place => {
            // Create place card
            const placeCard = document.createElement('div');
            placeCard.className = 'bg-white p-3 mb-3 rounded-lg shadow-sm border-l-4 hover:shadow-md transition-shadow cursor-pointer';
            placeCard.style.borderLeftColor = place.categoryColor;
            
            // Add place details
            placeCard.innerHTML = `
                <h4 class="font-medium text-gray-800">${place.name}</h4>
                <p class="text-sm text-gray-600 flex items-center gap-1"><i class="fas fa-map-marker-alt"></i> ${formatDistance(place.distance)}</p>
                <p class="text-sm text-gray-600 flex items-center gap-1"><i class="fas fa-location-dot"></i> ${place.vicinity || 'Address not available'}</p>
                <div class="flex justify-between items-center mt-2">
                    <div class="flex items-center gap-1">
                        <i class="fas fa-star text-amber-500"></i>
                        <span class="text-gray-700">${place.rating.toFixed(1)}</span>
                        <span class="text-xs text-gray-500">(${place.user_ratings_total})</span>
                    </div>
                </div>
            `;
            
            // Add click event
            placeCard.addEventListener('click', function() {
                showPlaceDetails(place.id);
            });
            
            // Add to category section
            categorySection.appendChild(placeCard);
            
            // Add marker to map
            addMarker(place);
        });
        
        // Add category to results
        resultsContainer.appendChild(categorySection);
    });
}

// Add marker to map
function addMarker(place) {
    const marker = new google.maps.Marker({
        map: map,
        position: place.location,
        title: place.name,
        icon: {
            path: 'M 0,0 C -2,-20 -10,-22 -10,-30 A 10,10 0 1,1 10,-30 C 10,-22 2,-20 0,0 z',
            fillColor: place.categoryColor,
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 2,
            scale: 1
        }
    });
    
    // Add click listener
    marker.addListener('click', function() {
        showPlaceDetails(place.id);
    });
    
    // Store marker
    markers.push(marker);
}

// Toggle custom location mode
function toggleCustomLocationMode() {
    customLocationMode = !customLocationMode;
    
    const button = document.getElementById('custom-location-btn');
    if (customLocationMode) {
        button.classList.add('bg-primary', 'text-white');
        button.classList.remove('bg-white', 'text-gray-700');
        document.getElementById('map').style.cursor = 'crosshair';
        showToast("Click anywhere on the map to set a custom location");
    } else {
        button.classList.add('bg-white', 'text-gray-700');
        button.classList.remove('bg-primary', 'text-white');
        document.getElementById('map').style.cursor = '';
    }
}

// Show toast function - update for Tailwind
function showToast(message) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'fixed bottom-4 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg hidden';
        document.body.appendChild(toast);
    }
    
    toast.textContent = message;
    toast.classList.remove('hidden');
    
    setTimeout(function() {
        toast.classList.add('hidden');
    }, 3000);
}

// Show modal function - update for Tailwind
function showModal(title, content) {
    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modal-body');
    
    // Set title and content
    modalBody.innerHTML = content;
    
    // Show modal
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

// Close modal function - update for Tailwind
function closeModal() {
    document.getElementById('modal').classList.add('hidden');
    document.getElementById('modal').classList.remove('flex');
}

// Helper functions
function clearResults() {
    places = [];
    clearMarkers();
    document.getElementById('results-list').innerHTML = 
        '<div class="flex flex-col items-center justify-center text-gray-500 h-full"><i class="fas fa-spinner fa-spin text-3xl mb-4 text-primary"></i><span>Finding nearby places...</span></div>';
}

// Format distance helper
function formatDistance(meters) {
    if (meters < 1000) {
        return `${Math.round(meters)} m`;
    } else {
        return `${(meters / 1000).toFixed(1)} km`;
    }
}

// Set custom location
function setCustomLocation(latLng) {
    userLocation = {
        lat: latLng.lat(),
        lng: latLng.lng()
    };
    
    // Update marker position
    userMarker.setPosition(userLocation);
    
    // Update circle position
    radiusCircle.setCenter(userLocation);
    
    // Exit custom location mode
    customLocationMode = false;
    const button = document.getElementById('custom-location-btn');
    button.classList.add('bg-white', 'text-gray-700');
    button.classList.remove('bg-primary', 'text-white');
    document.getElementById('map').style.cursor = '';
    
    // Find places at new location
    findNearbyPlaces();
    
    showToast("Custom location set");
}

// Search for a location
function searchLocation() {
    const input = document.getElementById('location-search').value;
    if (!input.trim()) return;
    
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: input }, function(results, status) {
        if (status === google.maps.GeocoderStatus.OK && results[0]) {
            const location = results[0].geometry.location;
            
            // Center map on location
            map.setCenter(location);
            
            // Set as custom location
            setCustomLocation(location);
            
            // Update search box with formatted address
            document.getElementById('location-search').value = results[0].formatted_address;
        } else {
            showToast("Location not found. Try a more specific name.");
        }
    });
}

// Update search radius
function updateRadius() {
    const input = document.getElementById('radius-input');
    const radius = parseInt(input.value);
    
    if (isNaN(radius) || radius < 1 || radius > 50) {
        showToast("Please enter a radius between 1 and 50 km");
        return;
    }
    
    searchRadius = radius * 1000; // Convert to meters
    
    // Update radius circle
    if (radiusCircle) {
        radiusCircle.setRadius(searchRadius);
    }
    
    // Search with new radius
    findNearbyPlaces();
}

// Recenter map
function recenterMap() {
    if (map && userMarker) {
        map.setCenter(userMarker.getPosition());
        map.setZoom(14);
    }
}

// Sort places
function sortPlaces(sortBy) {
    if (!places.length) return;
    
    let filtered = [...places];
    
    // Apply current category filter
    const activeCategory = document.querySelector('#filter-options > div.px-3.py-1.rounded-full.bg-blue-100.text-primary').dataset.category;
    if (activeCategory !== 'all') {
        filtered = filtered.filter(place => place.category === activeCategory);
    }
    
    // Sort by selected criteria
    if (sortBy === 'distance') {
        filtered.sort((a, b) => a.distance - b.distance);
    } else if (sortBy === 'rating') {
        filtered.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === 'name') {
        filtered.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    // Clear and redisplay
    clearMarkers();
    
    // Group by category
    const placesByCategory = {};
    filtered.forEach(place => {
        if (!placesByCategory[place.category]) {
            placesByCategory[place.category] = [];
        }
        placesByCategory[place.category].push(place);
    });
    
    // Update display
    const resultsContainer = document.getElementById('results-list');
    resultsContainer.innerHTML = '';
    
    if (filtered.length === 0) {
        resultsContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center text-gray-500 h-full">
                <i class="fas fa-info-circle text-3xl mb-4 text-blue-500"></i>
                <span>No places found matching your criteria.</span>
            </div>
        `;
        return;
    }
    
    // Display places by category
    Object.keys(placesByCategory).forEach(categoryKey => {
        const categoryPlaces = placesByCategory[categoryKey];
        const categoryInfo = placeCategories.find(c => c.type === categoryKey);
        
        // Create category section
        const categorySection = document.createElement('div');
        categorySection.className = 'mb-6';
        
        // Add category header
        const categoryHeader = document.createElement('div');
        categoryHeader.className = 'flex items-center gap-2 pb-2 mb-3 border-b border-gray-200';
        
        const iconColor = categoryInfo.color;
        const bgColor = `${categoryInfo.color}20`;
        
        categoryHeader.innerHTML = `
            <div class="w-8 h-8 rounded-full flex items-center justify-center" style="background-color: ${bgColor}; color: ${iconColor}">
                <i class="fas ${categoryInfo.icon}"></i>
            </div>
            <h3 class="font-medium">${categoryInfo.label} (${categoryPlaces.length})</h3>
        `;
        categorySection.appendChild(categoryHeader);
        
        // Add places
        categoryPlaces.forEach(place => {
            // Create place card
            const placeCard = document.createElement('div');
            placeCard.className = 'bg-white p-3 mb-3 rounded-lg shadow-sm border-l-4 hover:shadow-md transition-shadow cursor-pointer';
            placeCard.style.borderLeftColor = place.categoryColor;
            
            // Add place details
            placeCard.innerHTML = `
                <h4 class="font-medium text-gray-800">${place.name}</h4>
                <p class="text-sm text-gray-600 flex items-center gap-1"><i class="fas fa-map-marker-alt"></i> ${formatDistance(place.distance)}</p>
                <p class="text-sm text-gray-600 flex items-center gap-1"><i class="fas fa-location-dot"></i> ${place.vicinity || 'Address not available'}</p>
                <div class="flex justify-between items-center mt-2">
                    <div class="flex items-center gap-1">
                        <i class="fas fa-star text-amber-500"></i>
                        <span class="text-gray-700">${place.rating.toFixed(1)}</span>
                        <span class="text-xs text-gray-500">(${place.user_ratings_total})</span>
                    </div>
                </div>
            `;
            
            // Add click event
            placeCard.addEventListener('click', function() {
                showPlaceDetails(place.id);
            });
            
            // Add to category section
            categorySection.appendChild(placeCard);
            
            // Add marker to map
            addMarker(place);
        });
        
        // Add category to results
        resultsContainer.appendChild(categorySection);
    });
}

// Show place details
function showPlaceDetails(placeId) {
    const service = new google.maps.places.PlacesService(map);
    
    service.getDetails({
        placeId: placeId,
        fields: ['name', 'formatted_address', 'formatted_phone_number', 'website', 
                'rating', 'user_ratings_total', 'photos', 'url', 'opening_hours']
    }, function(place, status) {
        if (status === google.maps.places.PlacesServiceStatus.OK && place) {
            let content = `<div class="space-y-4">`;
            
            // Add photo if available
            if (place.photos && place.photos.length > 0) {
                content += `
                    <div class="w-full">
                        <img src="${place.photos[0].getUrl({maxWidth: 400, maxHeight: 300})}" alt="${place.name}" class="w-full h-48 object-cover rounded-lg">
                    </div>
                `;
            }
            
            // Basic info
            content += `
                <h3 class="text-xl font-medium">${place.name}</h3>
                <p class="flex items-center gap-2 text-gray-600"><i class="fas fa-map-marker-alt"></i> ${place.formatted_address || 'Address not available'}</p>
            `;
            
            // Phone if available
            if (place.formatted_phone_number) {
                content += `<p class="flex items-center gap-2 text-gray-600"><i class="fas fa-phone"></i> ${place.formatted_phone_number}</p>`;
            }
            
            // Rating
            if (place.rating) {
                content += `
                    <div class="flex items-center gap-2">
                        <i class="fas fa-star text-amber-500"></i>
                        <span>${place.rating.toFixed(1)}</span>
                        <span class="text-sm text-gray-500">(${place.user_ratings_total} reviews)</span>
                    </div>
                `;
            }
            
            // Opening hours
            if (place.opening_hours && place.opening_hours.weekday_text) {
                content += `
                    <div class="mt-4">
                        <h4 class="font-medium mb-2">Opening Hours</h4>
                        <ul class="space-y-1 text-sm text-gray-600">
                `;
                
                place.opening_hours.weekday_text.forEach(day => {
                    content += `<li>${day}</li>`;
                });
                
                content += `
                        </ul>
                    </div>
                `;
            }
            
            // Actions
            content += `
                <div class="flex gap-3 mt-6">
                    <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(place.name)}&destination_place_id=${place.place_id}" target="_blank" 
                       class="bg-primary text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2">
                        <i class="fas fa-directions"></i> Directions
                    </a>
            `;
            
            if (place.website) {
                content += `
                    <a href="${place.website}" target="_blank" 
                       class="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2">
                        <i class="fas fa-globe"></i> Website
                    </a>
                `;
            }
            
            content += `
                </div>
            </div>`;
            
            showModal(place.name, content);
        } else {
            showToast("Couldn't load place details");
        }
    });
}

// Clear markers
function clearMarkers() {
    markers.forEach(marker => marker.setMap(null));
    markers = [];
}

// Show about
function showAbout() {
    const content = `
        <div class="space-y-4">
            <p>Nearby Essentials helps you find important places around your location.</p>
            <p>This app shows you the highest-rated places in each category.</p>
            <h4 class="font-medium text-lg mt-4">Features:</h4>
            <ul class="list-disc pl-5 space-y-1">
                <li>Find essential places near your current location</li>
                <li>Search for any location by name</li>
                <li>Set a custom location by clicking on the map</li>
                <li>Filter places by category</li>
                <li>Sort places by distance, rating or name</li>
                <li>Filter out potentially fake listings</li>
                <li>Get directions to any place with one click</li>
            </ul>
            <p class="mt-4"><strong>Note:</strong> This app works best with location services enabled.</p>
        </div>
    `;
    
    showModal('About Nearby Essentials', content);
}

// Add event listener for reset button
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('reset-btn')) {
        document.getElementById('reset-btn').addEventListener('click', function() {
            // Reset all filters
            document.querySelectorAll('#filter-options > div').forEach(c => 
                c.className = 'px-3 py-1 rounded-full bg-gray-100 text-gray-700 border border-transparent cursor-pointer hover:bg-gray-200 transition-colors'
            );
            document.querySelector('#filter-options > div[data-category="all"]').className = 'px-3 py-1 rounded-full bg-blue-100 text-primary border border-blue-200 cursor-pointer hover:bg-blue-200 transition-colors';
            
            // Reset sort
            document.getElementById('sort-select').value = 'distance';
            
            // Reset radius
            document.getElementById('radius-input').value = '5';
            searchRadius = 5000;
            
            if (radiusCircle) {
                radiusCircle.setRadius(searchRadius);
            }
            
            // Reset fake places filter
            document.getElementById('fake-filter').checked = true;
            filterFakePlaces = true;
            
            // If we have user's geolocation, reset to that
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    function(position) {
                        userLocation = {
                            lat: position.coords.latitude,
                            lng: position.coords.longitude
                        };
                        
                        // Update marker and circle
                        userMarker.setPosition(userLocation);
                        radiusCircle.setCenter(userLocation);
                        
                        // Center map
                        map.setCenter(userLocation);
                        map.setZoom(14);
                        
                        // Find places
                        findNearbyPlaces();
                    },
                    function(error) {
                        // Just search at current location
                        findNearbyPlaces();
                    }
                );
            } else {
                // Just search at current location
                findNearbyPlaces();
            }
            
            showToast("App reset to default settings");
        });
    }
});