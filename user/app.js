import { auth, db } from '../firebase-config.js';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, addDoc, doc, onSnapshot, updateDoc, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

// --- Panels & Trip Details ---
const requestPanel = document.getElementById('request-panel');
const tripPanel = document.getElementById('trip-panel');
const requestDriverButton = document.getElementById('request-driver-button');
const tripInfoContainer = document.getElementById('trip-info-container');
const tripStatusHeading = document.getElementById('trip-status-heading');
const tripStatusDetails = document.getElementById('trip-status-details');
const driverDetailsContainer = document.getElementById('driver-details-container');
const tripDriverPic = document.getElementById('trip-driver-pic');
const tripDriverName = document.getElementById('trip-driver-name');
const tripVehicleDetails = document.getElementById('trip-vehicle-details');
const tripVehiclePlate = document.getElementById('trip-vehicle-plate');

// --- Modals ---
const ratingModal = document.getElementById('rating-modal');
const stars = document.querySelectorAll('.stars .fa-star');
const submitRatingButton = document.getElementById('submit-rating-button');
const historyModal = document.getElementById('history-modal');
const showHistoryBtn = document.getElementById('show-history-btn');
const closeHistoryBtn = document.getElementById('close-history-btn');
const historyList = document.getElementById('history-list');

// --- App State ---
let map, userMarker, driverMarker, tripRoutePolyline;
let currentUser, currentTripId, currentTripDriverId;
let selectedRating = 0;
let hasShownDriverInfo = false;

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

logoutButton.addEventListener('click', () => signOut(auth).catch(err => console.error("Sign Out Error:", err)));

function setupUIForLoggedInUser(user) {
    loginView.style.display = 'none';
    mainUI.style.display = 'block';
    userProfilePic.src = user.photoURL || 'default-pic.png';
    userProfileName.textContent = user.displayName || 'Usuario';
    if (!map) initializeMap();
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
        navigator.geolocation.getCurrentPosition(pos => initMap({ lat: pos.coords.latitude, lng: pos.coords.longitude }), 
        () => initMap({ lat: 34.0522, lng: -118.2437 }));
    } else {
        initMap({ lat: 34.0522, lng: -118.2437 });
    }
}

document.addEventListener('map-ready', initializeMap);

function initMap(location) {
    map = new google.maps.Map(document.getElementById('map'), { center: location, zoom: 15, disableDefaultUI: true });
    userMarker = new google.maps.Marker({ position: location, map: map, title: 'Tu ubicación' });
}

// --- UI Interactions ---
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
            userId: currentUser.uid, userName: currentUser.displayName, userLocation, status: 'pending', createdAt: new Date()
        });
        currentTripId = docRef.id;
        requestPanel.style.display = 'none';
        tripPanel.style.display = 'block';
        listenToTripUpdates(currentTripId);
    } catch (e) { console.error("Error requesting trip: ", e); }
});

// --- Trip Lifecycle & Updates ---
function listenToTripUpdates(tripId) {
    const tripRef = doc(db, "trips", tripId);
    onSnapshot(tripRef, (docSnap) => {
        if (!docSnap.exists()) { resetTripState(); return; }
        const trip = docSnap.data();
        currentTripDriverId = trip.driverId;
        updateTripUI(trip);
        if (trip.routePolyline && !tripRoutePolyline) drawRoute(trip.routePolyline);
        if (trip.driverLocation) updateDriverMarker(trip.driverLocation);
        if (trip.driverInfo && !hasShownDriverInfo) displayDriverInfo(trip.driverInfo);
        if (trip.status === 'completed' && !trip.rating) setTimeout(() => showRatingModal(), 1500);
        else if (trip.status === 'cancelled') setTimeout(() => resetTripState(), 3000);
    });
}

function updateTripUI(trip) {
    const { statusText, details } = getStatusInfo(trip.status);
    tripStatusHeading.textContent = statusText;
    tripStatusDetails.textContent = details;
}

function displayDriverInfo(info) {
    tripInfoContainer.style.display = 'none';
    tripDriverPic.src = info.photoURL || 'default-pic.png';
    tripDriverName.textContent = info.name || 'Conductor';
    if (info.vehicle) {
        tripVehicleDetails.textContent = `${info.vehicle.color || ''} ${info.vehicle.make || ''} ${info.vehicle.model || ''}`;
        tripVehiclePlate.textContent = info.vehicle.plate || '';
    }
    driverDetailsContainer.style.display = 'flex';
    hasShownDriverInfo = true;
}

function getStatusInfo(status) {
    switch (status) {
        case 'pending': return { statusText: 'Buscando conductor', details: 'Tu solicitud está siendo procesada.' };
        case 'accepted': return { statusText: 'Tu conductor está en camino', details: '' };
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
    updateMapBounds();
}

function updateMapBounds() {
    if (!userMarker || !driverMarker) return;
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(userMarker.getPosition());
    bounds.extend(driverMarker.getPosition());
    map.fitBounds(bounds, 60); // 60px padding
}

function resetTripState() {
    tripPanel.style.display = 'none';
    requestPanel.style.display = 'block';
    tripInfoContainer.style.display = 'block';
    driverDetailsContainer.style.display = 'none';
    if (driverMarker) driverMarker.setMap(null);
    if (tripRoutePolyline) tripRoutePolyline.setMap(null);
    driverMarker = null; tripRoutePolyline = null; currentTripId = null; currentTripDriverId = null; hasShownDriverInfo = false;
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
    if (selectedRating === 0 || !currentTripId) return;
    try {
        await updateDoc(doc(db, "trips", currentTripId), { rating: selectedRating });
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
    historyList.innerHTML = '<div class="loader"></div>';
    historyModal.style.display = 'flex';
    closeSideNav();
    const q = query(collection(db, "trips"), where("userId", "==", currentUser.uid), orderBy("createdAt", "desc"));
    try {
        const querySnapshot = await getDocs(q);
        historyList.innerHTML = '';
        if (querySnapshot.empty) { historyList.innerHTML = '<p>No has realizado ningún viaje.</p>'; return; }
        querySnapshot.forEach(doc => createHistoryItem(doc.data()));
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
    item.innerHTML = `<h4>Viaje del ${tripDate}</h4><p>Estado: <strong class="status status-${trip.status}">${statusText}</strong></p><p>Calificación: ${rating}</p>`;
    historyList.appendChild(item);
}

function hideTripHistory() { historyModal.style.display = 'none'; }