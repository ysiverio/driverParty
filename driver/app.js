import { auth, db } from '../firebase-config.js';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- DOM Elements ---
const loginView = document.getElementById('login-view');
const mainUI = document.getElementById('main-ui');
const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');
const menuBtn = document.getElementById('menu-btn');
const closeNavBtn = document.getElementById('close-nav-btn');
const sideNav = document.getElementById('side-nav');
const navOverlay = document.getElementById('nav-overlay');
const driverProfilePic = document.getElementById('driver-profile-pic');
const driverProfileName = document.getElementById('driver-profile-name');
const onlineToggle = document.getElementById('online-toggle');
const onlineStatus = document.getElementById('online-status');
const requestsPanel = document.getElementById('requests-panel');
const requestsList = document.getElementById('requests-list');
const tripPanel = document.getElementById('trip-panel');
const tripClientName = document.getElementById('trip-client-name');
const startTripButton = document.getElementById('start-trip-button');
const endTripButton = document.getElementById('end-trip-button');

// --- App State ---
let map, currentUser, locationWatcherId, activeTripId;
let driverMarker, directionsService, directionsRenderer;
let requestMarkers = {};
let unsubscribeFromRequests;

// --- Authentication ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        setupUIForLoggedInUser(user);
    } else {
        currentUser = null;
        setupUIForLoggedOutUser();
    }
});

loginButton.addEventListener('click', () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch(err => console.error("Auth Error:", err));
});

logoutButton.addEventListener('click', () => {
    if (onlineToggle.checked) {
        onlineToggle.checked = false;
        goOffline();
    }
    signOut(auth).catch(err => console.error("Sign Out Error:", err));
});

function setupUIForLoggedInUser(user) {
    loginView.style.display = 'none';
    mainUI.style.display = 'block';
    driverProfilePic.src = user.photoURL || 'default-pic.png';
    driverProfileName.textContent = user.displayName || 'Conductor';
    if (!map) {
        initializeMap();
    }
}

function setupUIForLoggedOutUser() {
    loginView.style.display = 'flex';
    mainUI.style.display = 'none';
    closeSideNav();
    resetTripState(true); // Force a full reset on logout
}

// --- Map Initialization ---
function initializeMap() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            const location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            initMap(location);
        }, () => initMap({ lat: 34.0522, lng: -118.2437 }));
    } else {
        initMap({ lat: 34.0522, lng: -118.2437 });
    }
}

document.addEventListener('map-ready', initializeMap);

function initMap(location) {
    map = new google.maps.Map(document.getElementById('map'), {
        center: location,
        zoom: 14,
        disableDefaultUI: true
    });
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({ suppressMarkers: true });
    directionsRenderer.setMap(map);
}

// --- UI Interactions (Side Nav) ---
menuBtn.addEventListener('click', () => { sideNav.style.width = "280px"; navOverlay.style.display = "block"; });
closeNavBtn.addEventListener('click', closeSideNav);
navOverlay.addEventListener('click', closeSideNav);
function closeSideNav() { sideNav.style.width = "0"; navOverlay.style.display = "none"; }

// --- Driver Status (Online/Offline) ---
onlineToggle.addEventListener('change', (e) => {
    if (e.target.checked) {
        goOnline();
    } else {
        goOffline();
    }
});

function goOnline() {
    onlineStatus.textContent = 'En línea';
    onlineStatus.style.color = '#28a745';
    requestsPanel.style.display = 'block';
    if (!unsubscribeFromRequests) { // Prevent multiple listeners
        listenForRequests();
    }
}

function goOffline() {
    onlineStatus.textContent = 'Desconectado';
    onlineStatus.style.color = '#6c757d';
    requestsPanel.style.display = 'none';
    if (unsubscribeFromRequests) {
        unsubscribeFromRequests();
        unsubscribeFromRequests = null;
    }
    clearRequestMarkers();
    requestsList.innerHTML = '';
}

// --- Ride Request Listening ---
function listenForRequests() {
    const tripsRef = collection(db, "trips");
    const q = query(tripsRef, where("status", "==", "pending"));

    unsubscribeFromRequests = onSnapshot(q, (snapshot) => {
        // If driver is on a trip, don't show new requests.
        if (activeTripId) {
            requestsList.innerHTML = '<p>Completando un viaje...</p>';
            return;
        }
        
        clearRequestMarkers();
        requestsList.innerHTML = ''; // Clear list before re-rendering
        if (snapshot.empty) {
            requestsList.innerHTML = '<p>No hay solicitudes pendientes.</p>';
            return;
        }
        snapshot.forEach((doc) => {
            const trip = doc.data();
            const tripId = doc.id;
            addRequestMarker(trip.userLocation, trip.userName, tripId);
            createRequestCard(trip, tripId);
        });
    });
}

function createRequestCard(trip, tripId) {
    const card = document.createElement('div');
    card.className = 'request-card';
    card.innerHTML = `
        <div class="request-card-info">
            <h4>${trip.userName || 'Usuario'}</h4>
        </div>
        <button class="accept-button" data-id="${tripId}">Aceptar</button>
    `;
    requestsList.appendChild(card);
}

requestsList.addEventListener('click', (e) => {
    if (e.target.classList.contains('accept-button')) {
        const tripId = e.target.dataset.id;
        acceptTrip(tripId);
    }
});

function addRequestMarker(position, title, tripId) {
    const marker = new google.maps.Marker({ position, map, title });
    requestMarkers[tripId] = marker;
}

function clearRequestMarkers() {
    Object.values(requestMarkers).forEach(marker => marker.setMap(null));
    requestMarkers = {};
}

// --- Accept & Manage Trip ---
async function acceptTrip(tripId) {
    // If already in a trip, do nothing.
    if (activeTripId) return;

    activeTripId = tripId;
    const tripRef = doc(db, "trips", tripId);

    try {
        await updateDoc(tripRef, { status: 'accepted', driverId: currentUser.uid });
        const tripDoc = await getDoc(tripRef);
        const tripData = tripDoc.data();

        // UI changes for active trip
        requestsPanel.style.display = 'none';
        tripPanel.style.display = 'block';
        tripClientName.textContent = tripData.userName;
        clearRequestMarkers(); // Clear markers for other requests

        navigator.geolocation.getCurrentPosition((pos) => {
            const location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            calculateAndDisplayRoute(location, tripData.userLocation);
            startSharingLocation(location);
        }, (err) => console.error("Geolocation error:", err));

    } catch (error) {
        console.error("Error accepting trip: ", error);
    }
}

function calculateAndDisplayRoute(origin, destination) {
    directionsService.route({ origin, destination, travelMode: 'DRIVING' }, (result, status) => {
        if (status === 'OK') {
            directionsRenderer.setDirections(result);
            const routePolyline = result.routes[0].overview_polyline;
            updateDoc(doc(db, "trips", activeTripId), { routePolyline });
        } else {
            console.error('Directions request failed: ' + status);
        }
    });
}

startTripButton.addEventListener('click', () => updateTripStatus('in_progress'));
endTripButton.addEventListener('click', () => updateTripStatus('completed'));

async function updateTripStatus(status) {
    if (!activeTripId) return;
    await updateDoc(doc(db, "trips", activeTripId), { status });
    if (status === 'completed') {
        resetTripState();
    }
}

// --- Location Sharing ---
function startSharingLocation(initialLocation) {
    if (driverMarker) driverMarker.setMap(null);
    driverMarker = new google.maps.Marker({ position: initialLocation, map: map, icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#4285F4", fillOpacity: 1, strokeWeight: 2, strokeColor: "white" } });

    locationWatcherId = navigator.geolocation.watchPosition((pos) => {
        const driverLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        updateDoc(doc(db, "trips", activeTripId), { driverLocation });
        driverMarker.setPosition(driverLocation);
    }, (err) => console.error("Watch position error:", err), { enableHighAccuracy: true });
}

function resetTripState(isLogout = false) {
    if (locationWatcherId) navigator.geolocation.clearWatch(locationWatcherId);
    if (directionsRenderer) directionsRenderer.setDirections({ routes: [] });
    if (driverMarker) driverMarker.setMap(null);
    
    locationWatcherId = null;
    activeTripId = null;
    driverMarker = null;

    tripPanel.style.display = 'none';

    // If not logging out, check if driver should go back to seeing requests
    if (!isLogout && onlineToggle.checked) {
        requestsPanel.style.display = 'block';
        listenForRequests(); // Re-listen for requests
    } else if (isLogout) {
        onlineToggle.checked = false;
        goOffline();
    }
}