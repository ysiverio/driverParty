// Directions module
// Handles route fetching, step normalization, and distance calculations

import { loadGoogleMapsAPI } from './maps.js';

// Fetch route using Google Maps DirectionsService
async function fetchRoute({ origin, destination, travelMode = 'DRIVING' }) {
    await loadGoogleMapsAPI();

    return new Promise((resolve, reject) => {
        const directionsService = new google.maps.DirectionsService();
        
        const request = {
            origin: origin,
            destination: destination,
            travelMode: google.maps.TravelMode[travelMode],
            provideRouteAlternatives: false,
            avoidHighways: false,
            avoidTolls: false
        };

        directionsService.route(request, (result, status) => {
            if (status === 'OK') {
                const normalizedRoute = normalizeRoute(result);
                resolve(normalizedRoute);
            } else {
                reject(new Error(`Directions request failed: ${status}`));
            }
        });
    });
}

// Normalize route data from Google Maps API
function normalizeRoute(directionsResult) {
    const route = directionsResult.routes[0];
    const leg = route.legs[0];
    
    // Normalize steps
    const steps = leg.steps.map(step => normalizeStep(step));
    
    // Calculate total distance and duration
    const totalDistance = leg.distance.value; // meters
    const totalDuration = leg.duration.value; // seconds
    
    return {
        polyline: route.overview_polyline.encoded,
        steps: steps,
        legs: [{
            distance: leg.distance,
            duration: leg.duration,
            start_location: leg.start_location,
            end_location: leg.end_location
        }],
        bounds: route.bounds,
        totalDistance,
        totalDuration,
        origin: leg.start_location,
        destination: leg.end_location
    };
}

// Normalize individual step
function normalizeStep(step) {
    return {
        distance: {
            text: step.distance.text,
            value: step.distance.value // meters
        },
        duration: {
            text: step.duration.text,
            value: step.duration.value // seconds
        },
        maneuver: extractManeuver(step.maneuver),
        html_instructions: step.instructions,
        plain_instructions: stripHtml(step.instructions),
        start_location: step.start_location,
        end_location: step.end_location,
        polyline: step.polyline.encoded
    };
}

// Extract maneuver type from step
function extractManeuver(maneuver) {
    if (!maneuver) return 'straight';
    
    // Map Google Maps maneuver types to our simplified types
    const maneuverMap = {
        'turn-slight-left': 'slight-left',
        'turn-sharp-left': 'sharp-left',
        'uturn-left': 'u-turn-left',
        'turn-left': 'left',
        'turn-slight-right': 'slight-right',
        'turn-sharp-right': 'sharp-right',
        'uturn-right': 'u-turn-right',
        'turn-right': 'right',
        'straight': 'straight',
        'ramp-left': 'ramp-left',
        'ramp-right': 'ramp-right',
        'merge': 'merge',
        'fork-left': 'fork-left',
        'fork-right': 'fork-right',
        'ferry': 'ferry',
        'roundabout-left': 'roundabout-left',
        'roundabout-right': 'roundabout-right'
    };
    
    return maneuverMap[maneuver] || 'straight';
}

// Strip HTML tags from instructions
function stripHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
}

// Calculate distance from point to polyline using Geometry Library
function distanceToPolyline(point, polyline) {
    try {
        const decodedPath = google.maps.geometry.encoding.decodePath(polyline);
        const pointLatLng = new google.maps.LatLng(point.lat, point.lng);
        
        let minDistance = Infinity;
        
        // Find the closest point on the polyline
        for (let i = 0; i < decodedPath.length - 1; i++) {
            const segmentStart = decodedPath[i];
            const segmentEnd = decodedPath[i + 1];
            
            const distance = google.maps.geometry.spherical.computeDistanceBetween(
                pointLatLng,
                google.maps.geometry.spherical.interpolate(segmentStart, segmentEnd, 0.5)
            );
            
            minDistance = Math.min(minDistance, distance);
        }
        
        return minDistance;
    } catch (error) {
        console.error('Error calculating distance to polyline:', error);
        return Infinity;
    }
}

// Check if route should be recalculated based on deviation
function shouldRecalculate({ point, polyline, thresholdMeters = 40 }) {
    const distance = distanceToPolyline(point, polyline);
    return distance > thresholdMeters;
}

// Calculate heading between two points
function calculateHeading(from, to) {
    try {
        const fromLatLng = new google.maps.LatLng(from.lat, from.lng);
        const toLatLng = new google.maps.LatLng(to.lat, to.lng);
        
        // Use Google Maps geometry library to calculate heading
        const heading = google.maps.geometry.spherical.computeHeading(fromLatLng, toLatLng);
        return heading;
    } catch (error) {
        console.error('Error calculating heading:', error);
        return 0;
    }
}

// Estimate heading from position history
function estimateHeadingFromHistory(positions, minDistance = 10) {
    if (positions.length < 2) return 0;
    
    const recent = positions.slice(-2);
    const distance = google.maps.geometry.spherical.computeDistanceBetween(
        new google.maps.LatLng(recent[0].lat, recent[0].lng),
        new google.maps.LatLng(recent[1].lat, recent[1].lng)
    );
    
    if (distance < minDistance) return 0;
    
    return calculateHeading(recent[0], recent[1]);
}

// Get current step based on position and route
function getCurrentStep(position, route) {
    if (!route || !route.steps || route.steps.length === 0) return 0;
    
    const currentLatLng = new google.maps.LatLng(position.lat, position.lng);
    
    for (let i = 0; i < route.steps.length; i++) {
        const step = route.steps[i];
        const stepEndLatLng = new google.maps.LatLng(
            step.end_location.lat,
            step.end_location.lng
        );
        
        const distanceToStepEnd = google.maps.geometry.spherical.computeDistanceBetween(
            currentLatLng,
            stepEndLatLng
        );
        
        // If we're within 30 meters of the step end, consider it completed
        if (distanceToStepEnd < 30) {
            return Math.min(i + 1, route.steps.length - 1);
        }
    }
    
    return 0;
}

// Format distance for display
function formatDistance(meters) {
    if (meters < 1000) {
        return `${Math.round(meters)} m`;
    } else {
        return `${(meters / 1000).toFixed(1)} km`;
    }
}

// Format duration for display
function formatDuration(seconds) {
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) {
        return `${minutes} min`;
    } else {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${hours}h ${remainingMinutes}min`;
    }
}

// Export functions
export {
    fetchRoute,
    normalizeRoute,
    normalizeStep,
    extractManeuver,
    stripHtml,
    distanceToPolyline,
    shouldRecalculate,
    calculateHeading,
    estimateHeadingFromHistory,
    getCurrentStep,
    formatDistance,
    formatDuration
};
