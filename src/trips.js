// Trips module
// Handles trip data operations and driver presence

import { db, doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp, collection } from './firebase.js';

// Get trip data
async function getTrip(tripId) {
    try {
        const tripRef = doc(db, 'trips', tripId);
        const tripSnap = await getDoc(tripRef);
        
        if (tripSnap.exists()) {
            return { id: tripSnap.id, ...tripSnap.data() };
        } else {
            return null;
        }
    } catch (error) {
        console.error('Error getting trip:', error);
        throw error;
    }
}

// Listen to trip changes
function listenTrip(tripId, callback) {
    try {
        const tripRef = doc(db, 'trips', tripId);
        
        return onSnapshot(tripRef, (docSnap) => {
            if (docSnap.exists()) {
                const tripData = { id: docSnap.id, ...docSnap.data() };
                callback(tripData);
            } else {
                callback(null);
            }
        }, (error) => {
            console.error('Error listening to trip:', error);
            callback(null);
        });
    } catch (error) {
        console.error('Error setting up trip listener:', error);
        throw error;
    }
}

// Update trip data
async function updateTrip(tripId, data) {
    try {
        const tripRef = doc(db, 'trips', tripId);
        
        // Filter out undefined values to prevent Firestore errors
        const cleanData = {};
        for (const [key, value] of Object.entries(data)) {
            if (value !== undefined && value !== null) {
                if (typeof value === 'object' && !Array.isArray(value)) {
                    // Recursively clean nested objects
                    const cleanNested = {};
                    for (const [nestedKey, nestedValue] of Object.entries(value)) {
                        if (nestedValue !== undefined && nestedValue !== null) {
                            cleanNested[nestedKey] = nestedValue;
                        }
                    }
                    cleanData[key] = cleanNested;
                } else {
                    cleanData[key] = value;
                }
            }
        }
        
        // Add timestamp
        const updateData = {
            ...cleanData,
            updatedAt: serverTimestamp()
        };
        
        console.log('Updating trip with data:', updateData);
        await updateDoc(tripRef, updateData);
        console.log('Trip updated successfully:', tripId);
    } catch (error) {
        console.error('Error updating trip:', error);
        throw error;
    }
}

// Create new trip
async function createTrip(tripData) {
    try {
        // Use the provided tripId as the document ID
        const tripRef = doc(db, 'trips', tripData.tripId);
        const newTrip = {
            ...tripData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        
        await setDoc(tripRef, newTrip);
        console.log('Trip created:', tripData.tripId);
        return tripData.tripId;
    } catch (error) {
        console.error('Error creating trip:', error);
        throw error;
    }
}

// Publish driver presence
async function publishDriverPresence(tripId, presenceData) {
    try {
        const presenceRef = doc(db, 'trips', tripId, 'presence', 'driver');
        
        const presence = {
            ...presenceData,
            ts: serverTimestamp()
        };
        
        await setDoc(presenceRef, presence, { merge: true });
    } catch (error) {
        console.error('Error publishing driver presence:', error);
        throw error;
    }
}

// Listen to driver presence
function listenDriverPresence(tripId, callback) {
    try {
        const presenceRef = doc(db, 'trips', tripId, 'presence', 'driver');
        
        return onSnapshot(presenceRef, (docSnap) => {
            if (docSnap.exists()) {
                const presenceData = docSnap.data();
                callback(presenceData);
            } else {
                callback(null);
            }
        }, (error) => {
            console.error('Error listening to driver presence:', error);
            callback(null);
        });
    } catch (error) {
        console.error('Error setting up presence listener:', error);
        throw error;
    }
}

// Get trip status
function getTripStatus(trip) {
    if (!trip) return 'unknown';
    return trip.status || 'unknown';
}

// Check if trip is active
function isTripActive(trip) {
    const activeStatuses = ['requested', 'accepted', 'en_route_to_pickup', 'arrived', 'in_progress'];
    return activeStatuses.includes(getTripStatus(trip));
}

// Check if trip is completed
function isTripCompleted(trip) {
    const completedStatuses = ['completed', 'canceled_by_client', 'canceled_by_driver'];
    return completedStatuses.includes(getTripStatus(trip));
}

// Get trip metrics
function getTripMetrics(trip) {
    if (!trip || !trip.metrics) {
        return {
            distanceMeters: 0,
            durationSec: 0,
            actualDistanceMeters: 0,
            actualDurationSec: 0
        };
    }
    
    return trip.metrics;
}

// Calculate trip progress
function calculateTripProgress(trip) {
    if (!trip) return 0;
    
    const statusProgress = {
        'requested': 0,
        'accepted': 10,
        'en_route_to_pickup': 30,
        'arrived': 50,
        'in_progress': 70,
        'completed': 100
    };
    
    return statusProgress[trip.status] || 0;
}

// Get current route data based on trip status
function getCurrentRouteData(trip) {
    if (!trip) return null;
    
    switch (trip.status) {
        case 'accepted':
        case 'en_route_to_pickup':
            return trip.routeToPickup;
        case 'arrived':
        case 'in_progress':
            return trip.routeToDestination;
        default:
            return null;
    }
}

// Get current step index
function getCurrentStepIndex(trip) {
    if (!trip) return 0;
    return trip.currentStepIndex || 0;
}

// Get current step
function getCurrentStep(trip) {
    const routeData = getCurrentRouteData(trip);
    const stepIndex = getCurrentStepIndex(trip);
    
    if (!routeData || !routeData.steps || !routeData.steps[stepIndex]) {
        return null;
    }
    
    return routeData.steps[stepIndex];
}

// Get next step
function getNextStep(trip) {
    const routeData = getCurrentRouteData(trip);
    const stepIndex = getCurrentStepIndex(trip);
    
    if (!routeData || !routeData.steps || !routeData.steps[stepIndex + 1]) {
        return null;
    }
    
    return routeData.steps[stepIndex + 1];
}

// Get remaining steps
function getRemainingSteps(trip) {
    const routeData = getCurrentRouteData(trip);
    const stepIndex = getCurrentStepIndex(trip);
    
    if (!routeData || !routeData.steps) {
        return [];
    }
    
    return routeData.steps.slice(stepIndex);
}

// Get trip duration
function getTripDuration(trip) {
    if (!trip || !trip.createdAt) return 0;
    
    const startTime = trip.createdAt.toDate ? trip.createdAt.toDate() : new Date(trip.createdAt);
    const endTime = trip.updatedAt ? (trip.updatedAt.toDate ? trip.updatedAt.toDate() : new Date(trip.updatedAt)) : new Date();
    
    return Math.floor((endTime - startTime) / 1000); // seconds
}

// Get estimated arrival time
function getEstimatedArrivalTime(trip) {
    if (!trip) return null;
    
    const routeData = getCurrentRouteData(trip);
    if (!routeData || !routeData.totalDuration) return null;
    
    const now = new Date();
    const estimatedSeconds = routeData.totalDuration;
    const arrivalTime = new Date(now.getTime() + estimatedSeconds * 1000);
    
    return arrivalTime;
}

// Format trip status for display
function formatTripStatus(status) {
    const statusMap = {
        'requested': 'Solicitado',
        'accepted': 'Aceptado',
        'en_route_to_pickup': 'En camino al pickup',
        'arrived': 'Llegó al pickup',
        'in_progress': 'Viaje en progreso',
        'completed': 'Completado',
        'canceled_by_client': 'Cancelado por cliente',
        'canceled_by_driver': 'Cancelado por conductor'
    };
    
    return statusMap[status] || status;
}

// Export functions
export {
    getTrip,
    listenTrip,
    updateTrip,
    createTrip,
    publishDriverPresence,
    listenDriverPresence,
    getTripStatus,
    isTripActive,
    isTripCompleted,
    getTripMetrics,
    calculateTripProgress,
    getCurrentRouteData,
    getCurrentStepIndex,
    getCurrentStep,
    getNextStep,
    getRemainingSteps,
    getTripDuration,
    getEstimatedArrivalTime,
    formatTripStatus
};
