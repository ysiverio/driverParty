import { auth, db } from '../firebase-config.js';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, addDoc, doc, onSnapshot, runTransaction, updateDoc, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- DOM Elements ---
const loginView = document.getElementById('login-view');
const mainUI = document.getElementById('main-ui');
const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');

// --- Map & UI Elements ---
const menuBtn = document.getElementById('menu-btn');
const closeNavBtn = document.getElementById('close-nav-btn');
const sideNav = document.getElementById('side-nav');
const navOverlay = document.getElementById('nav-overlay');
const userProfilePic = document.getElementById('user-profile-pic');
const userProfileName = document.getElementById('user-profile-name');

// --- Panels ---
const requestPanel = document.getElementById('request-panel');
const tripPanel = document.getElementById('trip-panel');
const requestDriverButton = document.getElementById('request-driver-button');
const tripStatusHeading = document.getElementById('trip-status-heading');
const tripStatusDetails = document.getElementById('trip-status-details');

// --- Rating Modal ---
const ratingModal = document.getElementById('rating-modal');
const stars = document.querySelectorAll('.stars .fa-star');
const submitRatingButton = document.getElementById('submit-rating-button');

// --- History Modal ---
const historyModal = document.getElementById('history-modal');
const showHistoryBtn = document.getElementById('show-history-btn');
const closeHistoryBtn = document.getElementById('close-history-btn');
const historyList = document.getElementById('history-list');

// --- App State ---
let map, userMarker, driverMarker, tripRoutePolyline;
let currentUser, currentTripId, currentTripDriverId;
let selectedRating = 0;

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
    signOut(auth).catch(err => console.error("Sign Out Error:", err));
});

function setupUIForLoggedInUser(user) {
    loginView.style.display = 'none';
    mainUI.style.display = 'block';
    userProfilePic.src = user.photoURL || 'default-pic.png';
    userProfileName.textContent = user.displayName || 'Usuario';
    if (!map) {
        initializeMap();
    }
}

function setupUIForLoggedOutUser() {
    loginView.style.display = 'flex';
    mainUI.style.display = 'none';
    closeSideNav();
    resetTripState();
}

// --- Map Initialization ---
function initializeMap() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            const userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            initMap(userLocation);
        }, () => initMap({ lat: 34.0522, lng: -118.2437 }));
    } else {
        initMap({ lat: 34.0522, lng: -118.2437 });
    }
}

document.addEventListener('map-ready', initializeMap);

function initMap(location) {
    map = new google.maps.Map(document.getElementById('map'), { center: location, zoom: 15, disableDefaultUI: true });
    userMarker = new google.maps.Marker({ position: location, map: map, title: 'Tu ubicación' });
}

// --- UI Interactions (Side Nav & Modals) ---
menuBtn.addEventListener('click', openSideNav);
closeNavBtn.addEventListener('click', closeSideNav);
navOverlay.addEventListener('click', closeSideNav);
showHistoryBtn.addEventListener('click', showTripHistory);
closeHistoryBtn.addEventListener('click', hideTripHistory);

function openSideNav() { sideNav.style.width = "280px"; navOverlay.style.display = "block"; }
function closeSideNav() { sideNav.style.width = "0"; navOverlay.style.display = "none"; }

// --- Ride Request ---
requestDriverButton.addEventListener('click', async () => {
    if (!currentUser || !map) return;
    const userLocation = { lat: map.getCenter().lat(), lng: map.getCenter().lng() };
    try {
        const docRef = await addDoc(collection(db, "trips"), {
            userId: currentUser.uid,
            userName: currentUser.displayName,
            userLocation: userLocation,
            status: 'pending',
            createdAt: new Date()
        });
        currentTripId = docRef.id;
        requestPanel.style.display = 'none';
        tripPanel.style.display = 'block';
        tripStatusHeading.textContent = 'Buscando conductor...';
        tripStatusDetails.textContent = 'Hemos recibido tu solicitud.';
        listenToTripUpdates(currentTripId);
    } catch (e) {
        console.error("Error requesting trip: ", e);
    }
});

// --- Trip Lifecycle & Updates ---
function listenToTripUpdates(tripId) {
    const tripRef = doc(db, "trips", tripId);
    onSnapshot(tripRef, (docSnap) => {
        if (!docSnap.exists()) { resetTripState(); return; }
        const trip = docSnap.data();
        currentTripDriverId = trip.driverId;
        updateTripUI(trip);
        if (trip.routePolyline && !tripRoutePolyline) { drawRoute(trip.routePolyline); }
        if (trip.driverLocation) { updateDriverMarker(trip.driverLocation); }
        if (trip.status === 'completed' && !trip.rating) {
            setTimeout(() => showRatingModal(), 1500);
        } else if (trip.status === 'cancelled') {
            setTimeout(() => resetTripState(), 3000);
        }
    });
}

function updateTripUI(trip) {
    const { statusText, details } = getStatusInfo(trip.status);
    tripStatusHeading.textContent = statusText;
    tripStatusDetails.textContent = details;
}

function getStatusInfo(status) {
    switch (status) {
        case 'pending': return { statusText: 'Buscando conductor', details: 'Tu solicitud está siendo procesada.' };
        case 'accepted': return { statusText: 'Conductor en camino', details: 'Tu conductor llegará pronto.' };
        case 'in_progress': return { statusText: 'Viaje en curso', details: 'Disfruta tu viaje.' };
        case 'completed': return { statusText: 'Viaje completado', details: 'Gracias por viajar con nosotros.' };
        case 'cancelled': return { statusText: 'Viaje cancelado', details: 'Tu viaje ha sido cancelado.' };
        default: return { statusText: 'Actualizando...', details: '' };
    }
}

function drawRoute(polylineString) {
    const decodedPath = google.maps.geometry.encoding.decodePath(polylineString);
    tripRoutePolyline = new google.maps.Polyline({ path: decodedPath, strokeColor: '#212121', strokeWeight: 5, map: map });
}

function updateDriverMarker(location) {
    const pos = new google.maps.LatLng(location.lat, location.lng);
    if (!driverMarker) {
        driverMarker = new google.maps.Marker({ position: pos, map: map, title: 'Tu Conductor', icon: { url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png" } });
    } else { driverMarker.setPosition(pos); }
}

function resetTripState() {
    tripPanel.style.display = 'none';
    requestPanel.style.display = 'block';
    if (driverMarker) driverMarker.setMap(null);
    if (tripRoutePolyline) tripRoutePolyline.setMap(null);
    driverMarker = null; tripRoutePolyline = null; currentTripId = null; currentTripDriverId = null;
}

// --- Rating Logic ---
function showRatingModal() { ratingModal.style.display = 'flex'; }

stars.forEach(star => {
    star.addEventListener('click', () => {
        selectedRating = parseInt(star.dataset.value);
        stars.forEach(s => { s.classList.toggle('selected', parseInt(s.dataset.value) <= selectedRating); });
    });
});

submitRatingButton.addEventListener('click', async () => {
    if (selectedRating === 0 || !currentTripId || !currentTripDriverId) return;
    const tripRef = doc(db, "trips", currentTripId);
    const driverRef = doc(db, "drivers", currentTripDriverId);
    try {
        await runTransaction(db, async (transaction) => {
            const driverDoc = await transaction.get(driverRef);
            if (!driverDoc.exists()) {
                transaction.set(driverRef, { totalStars: selectedRating, numTrips: 1 });
            } else {
                const newNumTrips = (driverDoc.data().numTrips || 0) + 1;
                const newTotalStars = (driverDoc.data().totalStars || 0) + selectedRating;
                transaction.update(driverRef, { numTrips: newNumTrips, totalStars: newTotalStars });
            }
            transaction.update(tripRef, { rating: selectedRating });
        });
        ratingModal.style.display = 'none';
        selectedRating = 0;
        stars.forEach(s => s.classList.remove('selected'));
        resetTripState();
    } catch (error) {
        console.error("Error submitting rating: ", error);
        alert("No se pudo enviar tu calificación.");
    }
});

// --- Trip History Logic ---
async function showTripHistory() {
    if (!currentUser) return;
    historyList.innerHTML = '<div class="loader"></div>'; // Show loader
    historyModal.style.display = 'flex';
    closeSideNav();

    const tripsRef = collection(db, "trips");
    const q = query(tripsRef, where("userId", "==", currentUser.uid), orderBy("createdAt", "desc"));
    
    try {
        const querySnapshot = await getDocs(q);
        historyList.innerHTML = ''; // Clear loader
        if (querySnapshot.empty) {
            historyList.innerHTML = '<p>No has realizado ningún viaje.</p>';
            return;
        }
        querySnapshot.forEach(doc => {
            createHistoryItem(doc.data());
        });
    } catch (error) {
        console.error("Error getting trip history: ", error);
        historyList.innerHTML = '<p>No se pudo cargar el historial.</p>';
    }
}

function createHistoryItem(trip) {
    const item = document.createElement('div');
    item.className = 'history-item';
    const tripDate = trip.createdAt.toDate().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
    const statusText = getStatusInfo(trip.status).statusText;
    const rating = trip.rating ? `${trip.rating} <i class="fas fa-star" style="color: #ffc107;"></i>` : 'Sin calificar';

    item.innerHTML = `
        <h4>Viaje del ${tripDate}</h4>
        <p>Estado: <strong class="status status-${trip.status}">${statusText}</strong></p>
        <p>Calificación: ${rating}</p>
    `;
    historyList.appendChild(item);
}

function hideTripHistory() {
    historyModal.style.display = 'none';
}