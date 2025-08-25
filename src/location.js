// Location module
// Handles driver position tracking, throttling, and Firestore publishing

import { calculateHeading, estimateHeadingFromHistory } from './directions.js';

let positionWatcher = null;
let lastPosition = null;
let positionHistory = [];
let lastPublishTime = 0;
let isTracking = false;

// Configuration
const THROTTLE_INTERVAL = 1500; // 1.5 seconds
const MIN_DISTANCE_THRESHOLD = 8; // 8 meters
const MIN_HEADING_CHANGE = 5; // 5 degrees
const MAX_HISTORY_SIZE = 10;

// Watch driver position with throttling
function watchDriverPosition({ onUpdate, onError }) {
    if (isTracking) {
        console.warn('Position tracking already active');
        return null;
    }

    if (!navigator.geolocation) {
        const error = new Error('Geolocation not supported');
        if (onError) onError(error);
        return null;
    }

    isTracking = true;
    positionHistory = [];
    lastPublishTime = 0;

    const options = {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 5000
    };

    positionWatcher = navigator.geolocation.watchPosition(
        (position) => handlePositionUpdate(position, onUpdate),
        (error) => handlePositionError(error, onError),
        options
    );

    console.log('Started position tracking');
    return positionWatcher;
}

// Handle position updates with throttling
function handlePositionUpdate(position, onUpdate) {
    const now = Date.now();
    const currentPosition = {
        coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            heading: position.coords.heading,
            speed: position.coords.speed
        },
        timestamp: position.timestamp
    };

    // Add to history
    positionHistory.push(currentPosition);
    if (positionHistory.length > MAX_HISTORY_SIZE) {
        positionHistory.shift();
    }

    // Check if we should publish this position
    if (shouldPublishPosition(currentPosition, now)) {
        // Estimate heading if not available
        if (!currentPosition.coords.heading && positionHistory.length >= 2) {
            currentPosition.coords.heading = estimateHeadingFromHistory(
                positionHistory.slice(-2).map(p => ({
                    lat: p.coords.latitude,
                    lng: p.coords.longitude
                }))
            );
        }

        // Call update callback
        if (onUpdate) {
            onUpdate(currentPosition);
        }

        lastPosition = currentPosition;
        lastPublishTime = now;
    }
}

// Handle position errors
function handlePositionError(error, onError) {
    console.error('Position tracking error:', error);
    
    switch (error.code) {
        case error.PERMISSION_DENIED:
            console.error('Location permission denied');
            break;
        case error.POSITION_UNAVAILABLE:
            console.error('Location information unavailable');
            break;
        case error.TIMEOUT:
            console.error('Location request timeout');
            break;
        default:
            console.error('Unknown location error');
    }

    if (onError) {
        onError(error);
    }
}

// Check if position should be published based on throttling and movement
function shouldPublishPosition(currentPosition, now) {
    // Always publish first position
    if (!lastPosition) {
        return true;
    }

    // Check throttle interval
    if (now - lastPublishTime < THROTTLE_INTERVAL) {
        return false;
    }

    // Calculate distance moved
    const distance = calculateDistance(
        lastPosition.coords.latitude,
        lastPosition.coords.longitude,
        currentPosition.coords.latitude,
        currentPosition.coords.longitude
    );

    // Calculate heading change
    const headingChange = Math.abs(
        (currentPosition.coords.heading || 0) - (lastPosition.coords.heading || 0)
    );

    // Publish if moved enough distance or heading changed significantly
    return distance > MIN_DISTANCE_THRESHOLD || headingChange > MIN_HEADING_CHANGE;
}

// Calculate distance between two points using Haversine formula
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

// Stop position tracking
function stopPositionTracking() {
    if (positionWatcher) {
        navigator.geolocation.clearWatch(positionWatcher);
        positionWatcher = null;
    }
    
    isTracking = false;
    positionHistory = [];
    lastPosition = null;
    lastPublishTime = 0;
    
    console.log('Stopped position tracking');
}

// Get current position once
function getCurrentPosition(options = {}) {
    const defaultOptions = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
    };

    const finalOptions = { ...defaultOptions, ...options };

    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation not supported'));
            return;
        }

        navigator.geolocation.getCurrentPosition(resolve, reject, finalOptions);
    });
}

// Check if geolocation is supported
function isGeolocationSupported() {
    return 'geolocation' in navigator;
}

// Check if geolocation permission is granted
async function checkGeolocationPermission() {
    if (!isGeolocationSupported()) {
        return 'not-supported';
    }

    try {
        // Try to get current position with a short timeout
        await getCurrentPosition({ timeout: 1000 });
        return 'granted';
    } catch (error) {
        if (error.code === error.PERMISSION_DENIED) {
            return 'denied';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
            return 'unavailable';
        } else if (error.code === error.TIMEOUT) {
            return 'timeout';
        } else {
            return 'unknown';
        }
    }
}

// Request geolocation permission
async function requestGeolocationPermission() {
    if (!isGeolocationSupported()) {
        throw new Error('Geolocation not supported');
    }

    try {
        const position = await getCurrentPosition({ timeout: 5000 });
        return position;
    } catch (error) {
        throw error;
    }
}

// Get position history
function getPositionHistory() {
    return [...positionHistory];
}

// Get last known position
function getLastPosition() {
    return lastPosition;
}

// Check if currently tracking
function isPositionTracking() {
    return isTracking;
}

// Export functions
export {
    watchDriverPosition,
    stopPositionTracking,
    getCurrentPosition,
    isGeolocationSupported,
    checkGeolocationPermission,
    requestGeolocationPermission,
    getPositionHistory,
    getLastPosition,
    isPositionTracking
};
