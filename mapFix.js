/**
 * Map Recovery and Stability System
 * This file contains mechanisms to prevent and recover from map rendering issues
 */

// Keep track of map state
let mapIsLoaded = false;
let mapBlankCounter = 0;
let mapRecoveryAttempts = 0;
const MAX_RECOVERY_ATTEMPTS = 5;

// Monitor map visibility and recover if needed
function monitorMapHealth() {
    console.log("Starting map health monitoring...");
    
    // Check the map every 2 seconds
    const mapHealthCheck = setInterval(() => {
        const mapDiv = document.getElementById('map');
        if (!mapDiv) {
            console.error("Map container not found");
            return;
        }
        
        // Check if map div is empty (potential blank map)
        if (mapIsLoaded && mapDiv.childElementCount === 0) {
            mapBlankCounter++;
            console.warn(`Map appears blank (${mapBlankCounter}/3)`);
            
            // After 3 consecutive blank checks, try to recover
            if (mapBlankCounter >= 3 && mapRecoveryAttempts < MAX_RECOVERY_ATTEMPTS) {
                recoverMap();
            }
        } else {
            mapBlankCounter = 0; // Reset counter if map seems okay
        }
        
    }, 2000);

    // Return the interval ID in case we want to stop monitoring
    return mapHealthCheck;
}

// Try to recover a blank map
function recoverMap() {
    console.log(`Attempting map recovery (attempt ${mapRecoveryAttempts + 1}/${MAX_RECOVERY_ATTEMPTS})`);
    mapRecoveryAttempts++;
    
    try {
        // Show recovery message
        showMapMessage("Map is recovering... please wait");
        
        // Force rebuild the map
        setTimeout(() => {
            if (window.rebuildMap && typeof window.rebuildMap === 'function') {
                window.rebuildMap();
                console.log("Map rebuilt");
                
                // Clear message after successful recovery
                setTimeout(() => clearMapMessage(), 1500);
            }
        }, 500);
        
    } catch (e) {
        console.error("Map recovery failed:", e);
        
        if (mapRecoveryAttempts >= MAX_RECOVERY_ATTEMPTS) {
            showMapMessage("Map cannot be loaded. Please try refreshing the page.");
        }
    }
}

// Show a message on the map
function showMapMessage(message) {
    const mapDiv = document.getElementById('map');
    if (!mapDiv) return;
    
    // Remove any existing message
    clearMapMessage();
    
    // Create message overlay
    const messageOverlay = document.createElement('div');
    messageOverlay.id = 'map-message-overlay';
    messageOverlay.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(255,255,255,0.8); display: flex; align-items: center; justify-content: center; z-index: 999; text-align: center; padding: 20px;';
    messageOverlay.innerHTML = `
        <div>
            <div style="font-size: 24px; margin-bottom: 10px;"><i class="fas fa-circle-notch fa-spin"></i></div>
            <div>${message}</div>
            <button id="refresh-map-btn" style="background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 4px; margin-top: 15px; cursor: pointer;">Refresh Map</button>
        </div>
    `;
    
    mapDiv.style.position = 'relative';
    mapDiv.appendChild(messageOverlay);
    
    // Add event listener to refresh button
    document.getElementById('refresh-map-btn').addEventListener('click', function() {
        if (window.rebuildMap && typeof window.rebuildMap === 'function') {
            window.rebuildMap();
        }
    });
}

// Clear map message
function clearMapMessage() {
    const existingOverlay = document.getElementById('map-message-overlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }
}

// Map was successfully loaded
function mapLoaded() {
    console.log("Map loaded successfully");
    mapIsLoaded = true;
    mapBlankCounter = 0;
}

// Export for global access
window.mapFix = {
    monitorMapHealth,
    mapLoaded,
    recoverMap,
    showMapMessage,
    clearMapMessage
};
