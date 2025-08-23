
import { auth, db } from '../firebase-config.js';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, query, where, onSnapshot, doc, updateDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// DOM Elements
const loginView = document.getElementById('login-view');
const requestsView = document.getElementById('requests-view');
const tripView = document.getElementById('trip-view');
const loginButton = document.getElementById('login-button');
const requestsList = document.getElementById('requests-list');
const startTripButton = document.getElementById('start-trip-button');
const endTripButton = document.getElementById('end-trip-button');

let map;
let currentUser;
let locationWatcherId = null;
let activeTripId = null;
let requestMarkers = {}; // To keep track of markers for pending requests

// --- Authentication ---
loginButton.addEventListener('click', () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch(error => console.error("Auth Error:", error));
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loginView.style.display = 'none';
        requestsView.style.display = 'block';
        listenForRequests();
    } else {
        currentUser = null;
        loginView.style.display = 'block';
        requestsView.style.display = 'none';
        tripView.style.display = 'none';
        if (locationWatcherId) navigator.geolocation.clearWatch(locationWatcherId);
    }
});

// --- Map Initialization ---
document.addEventListener('map-ready', () => {
    // Default location, can be updated with driver's real location
    initMap({ lat: 34.0522, lng: -118.2437 }); // Los Angeles
});

function initMap(initialLocation) {
    map = new google.maps.Map(document.getElementById('map'), {
        center: initialLocation,
        zoom: 12,
        disableDefaultUI: true
    });
}

// --- Ride Request Listening ---
function listenForRequests() {
    const tripsRef = collection(db, "trips");
    const q = query(tripsRef, where("status", "==", "pending"));

    onSnapshot(q, (snapshot) => {
        // Clear old requests from UI and map
        requestsList.innerHTML = '';
        clearRequestMarkers();

        snapshot.forEach((doc) => {
            const trip = doc.data();
            const tripId = doc.id;

            // Add marker to map
            addRequestMarker(trip.userLocation, trip.userName, tripId);

            // Add to UI list
            const li = document.createElement('li');
            li.innerHTML = `Cliente: ${trip.userName || 'Usuario'} <button data-id="${tripId}" class="accept-button">Aceptar</button>`;
            requestsList.appendChild(li);
        });
    });
}

function addRequestMarker(position, title, tripId) {
    const marker = new google.maps.Marker({
        position,
        map,
        title
    });
    requestMarkers[tripId] = marker;
}

function clearRequestMarkers() {
    for (const tripId in requestMarkers) {
        requestMarkers[tripId].setMap(null);
    }
    requestMarkers = {};
}

// --- Accept & Manage Trip ---
requestsList.addEventListener('click', async (e) => {
    if (e.target.classList.contains('accept-button')) {
        const tripId = e.target.dataset.id;
        activeTripId = tripId;
        const tripRef = doc(db, "trips", tripId);

        try {
            await updateDoc(tripRef, {
                status: 'accepted',
                driverId: currentUser.uid
            });

            requestsView.style.display = 'none';
            tripView.style.display = 'block';
            clearRequestMarkers();

            startSharingLocation();

        } catch (error) {
            console.error("Error al aceptar el viaje: ", error);
        }
    }
});

startTripButton.addEventListener('click', () => updateTripStatus('in_progress'));
endTripButton.addEventListener('click', () => {
    updateTripStatus('completed');
    if (locationWatcherId) navigator.geolocation.clearWatch(locationWatcherId);
    tripView.style.display = 'none';
    requestsView.style.display = 'block'; // Go back to looking for requests
});

async function updateTripStatus(status) {
    if (!activeTripId) return;
    const tripRef = doc(db, "trips", activeTripId);
    try {
        await updateDoc(tripRef, { status });
        console.log(`Viaje ${status}`);
    } catch (error) {
        console.error(`Error al actualizar a ${status}:`, error);
    }
}

// --- Location Sharing ---
function startSharingLocation() {
    if (!activeTripId) return;

    locationWatcherId = navigator.geolocation.watchPosition(
        (position) => {
            const driverLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            
            const tripRef = doc(db, "trips", activeTripId);
            updateDoc(tripRef, { driverLocation }).catch(err => console.error("Error updating location", err));
        },
        (error) => {
            console.error("Error de geolocalización: ", error);
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );
}
