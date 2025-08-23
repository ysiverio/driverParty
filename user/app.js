
import { auth, db } from '../firebase-config.js';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, addDoc, doc, onSnapshot, updateDoc, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

console.log("user/app.js loaded and running!");

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

// --- Profile Modal Elements ---
const profileModal = document.getElementById('profile-modal');
const showProfileBtn = document.getElementById('show-profile-btn');
const closeProfileModalBtn = document.getElementById('close-profile-modal-btn');
const profilePicDisplay = document.getElementById('profile-pic-display');
const profileNameDisplay = document.getElementById('profile-name-display');

// --- Notification Elements ---
const notificationBtn = document.querySelector('a[href="#"]:has(i.fa-bell)');

// --- App State ---
let map, userMarker, driverMarker, tripRoutePolyline;
let currentUser, currentTripId, currentTripDriverId;
let selectedRating = 0;
let hasShownDriverInfo = false;

// --- Authentication ---
console.log("Setting up onAuthStateChanged listener.");
onAuthStateChanged(auth, (user) => {
    console.log("onAuthStateChanged triggered. User:", user);
    if (user) {
        currentUser = user;
        setupUIForLoggedInUser(user);
    } else {
        currentUser = null;
        setupUIForLoggedOutUser();
    }
});

loginButton.addEventListener('click', () => {
    console.log("Login button clicked.");
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch(err => console.error("Auth Error:", err));
});

logoutButton.addEventListener('click', () => {
    console.log("Logout button clicked.");
    signOut(auth).catch(err => console.error("Sign Out Error:", err));
});

function setupUIForLoggedInUser(user) {
    console.log("setupUIForLoggedInUser called.");
    loginView.style.display = 'none';
    mainUI.style.display = 'block';
    userProfilePic.src = user.photoURL || 'default-pic.png';
    userProfileName.textContent = user.displayName || 'Usuario';
    if (!map) {
        console.log("Map not initialized, calling initializeMap().");
        initializeMap();
    }
}

function setupUIForLoggedOutUser() {
    console.log("setupUIForLoggedOutUser called.");
    loginView.style.display = 'flex';
    mainUI.style.display = 'none';
    closeSideNav();
    resetTripState();
}

// --- Map Initialization ---
function initializeMap() {
    console.log("initializeMap() called.");
    if (navigator.geolocation) {
        console.log("Geolocation available.");
        navigator.geolocation.getCurrentPosition(pos => {
            console.log("Current position obtained:", pos.coords);
            initMap({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        }, 
        () => {
            console.log("Geolocation failed, using default location.");
            initMap({ lat: 34.0522, lng: -118.2437 });
        });
    } else {
        console.log("Geolocation not available, using default location.");
        initMap({ lat: 34.0522, lng: -118.2437 });
    }
}

document.addEventListener('map-ready', () => {
    console.log("map-ready event received.");
    initializeMap();
});

function initMap(location) {
    console.log("initMap() called with location:", location);
    map = new google.maps.Map(document.getElementById('map'), { center: location, zoom: 15, disableDefaultUI: true });
    userMarker = new google.maps.Marker({ position: location, map: map, title: 'Tu ubicación' });
    console.log("Map and user marker initialized.");
}

// --- UI Interactions ---
menuBtn.addEventListener('click', () => { console.log("Menu button clicked."); openSideNav(); });
closeNavBtn.addEventListener('click', () => { console.log("Close nav button clicked."); closeSideNav(); });
navOverlay.addEventListener('click', () => { console.log("Nav overlay clicked."); closeSideNav(); });
showHistoryBtn.addEventListener('click', () => { console.log("Show history button clicked."); showTripHistory(); });
closeHistoryBtn.addEventListener('click', () => { console.log("Close history button clicked."); hideTripHistory(); });

// --- Profile Modal Events ---
showProfileBtn.addEventListener('click', showProfileModal);
closeProfileModalBtn.addEventListener('click', hideProfileModal);

// --- Notification Events ---
notificationBtn.addEventListener('click', showNotifications);

function openSideNav() { console.log("Opening side nav."); sideNav.style.width = "280px"; navOverlay.style.display = "block"; }
function closeSideNav() { console.log("Closing side nav."); sideNav.style.width = "0"; navOverlay.style.display = "none"; }

// --- Ride Request ---
requestDriverButton.addEventListener('click', async () => {
    console.log("Request driver button clicked.");
    if (!currentUser || !map) { console.log("User or map not ready."); return; }
    const userLocation = { lat: map.getCenter().lat(), lng: map.getCenter().lng() };
    try {
        console.log("Adding trip document to Firestore.");
        const docRef = await addDoc(collection(db, "trips"), {
            userId: currentUser.uid, userName: currentUser.displayName, userLocation, status: 'pending', createdAt: new Date()
        });
        currentTripId = docRef.id;
        console.log("Trip requested with ID:", currentTripId);
        requestPanel.style.display = 'none';
        tripPanel.style.display = 'block';
        listenToTripUpdates(currentTripId);
    } catch (e) { console.error("Error requesting trip: ", e); }
});

// --- Trip Lifecycle & Updates ---
function listenToTripUpdates(tripId) {
    console.log("Listening to trip updates for trip ID:", tripId);
    const tripRef = doc(db, "trips", tripId);
    onSnapshot(tripRef, (docSnap) => {
        console.log("Trip update received.");
        if (!docSnap.exists()) { console.log("Trip document does not exist."); resetTripState(); return; }
        const trip = docSnap.data();
        console.log("Trip data:", trip);
        currentTripDriverId = trip.driverId;
        updateTripUI(trip);
        if (trip.routePolyline && !tripRoutePolyline) { console.log("Drawing route."); drawRoute(trip.routePolyline); }
        if (trip.driverLocation) { console.log("Updating driver marker."); updateDriverMarker(trip.driverLocation); }
        if (trip.driverInfo && !hasShownDriverInfo) { console.log("Displaying driver info."); displayDriverInfo(trip.driverInfo); }
        if (trip.status === 'completed' && !trip.rating) { console.log("Trip completed, showing rating modal."); setTimeout(() => showRatingModal(), 1500); }
        else if (trip.status === 'cancelled') { console.log("Trip cancelled, resetting state."); setTimeout(() => resetTripState(), 3000); }
    });
}

function updateTripUI(trip) {
    console.log("updateTripUI called with trip:", trip);
    const { statusText, details } = getStatusInfo(trip.status);
    tripStatusHeading.textContent = statusText;
    tripStatusDetails.textContent = details;
}

function displayDriverInfo(info) {
    console.log("displayDriverInfo called with info:", info);
    tripInfoContainer.style.display = 'none';
    tripDriverPic.src = info.photoURL || 'default-pic.png';
    tripDriverName.textContent = info.name || 'Conductor';
    if (info.vehicle) {
        tripVehicleDetails.textContent = `${info.vehicle.color || ''} ${info.vehicle.make || ''} ${info.vehicle.model || ''}`;
        tripVehiclePlate.textContent = info.vehicle.plate || '';
    }
    driverDetailsContainer.style.display = 'flex';
    hasShownDriverInfo = true;
    console.log("Driver info displayed.");
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
    console.log("drawRoute called.");
    const decodedPath = google.maps.geometry.encoding.decodePath(polylineString);
    tripRoutePolyline = new google.maps.Polyline({ path: decodedPath, strokeColor: '#212121', strokeWeight: 5, map: map });
}

function updateDriverMarker(location) {
    console.log("updateDriverMarker called with location:", location);
    const pos = new google.maps.LatLng(location.lat, location.lng);
    if (!driverMarker) {
        driverMarker = new google.maps.Marker({ position: pos, map: map, title: 'Tu Conductor', icon: { url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png" } });
    } else { driverMarker.setPosition(pos); }
    updateMapBounds();
}

function updateMapBounds() {
    console.log("updateMapBounds called.");
    if (!userMarker || !driverMarker) { console.log("Markers not ready for bounds update."); return; }
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(userMarker.getPosition());
    bounds.extend(driverMarker.getPosition());
    map.fitBounds(bounds, 60); // 60px padding
    console.log("Map bounds updated.");
}

function resetTripState() {
    console.log("resetTripState called.");
    tripPanel.style.display = 'none';
    requestPanel.style.display = 'block';
    tripInfoContainer.style.display = 'block';
    driverDetailsContainer.style.display = 'none';
    if (driverMarker) driverMarker.setMap(null);
    if (tripRoutePolyline) tripRoutePolyline.setMap(null);
    driverMarker = null; tripRoutePolyline = null; currentTripId = null; currentTripDriverId = null; hasShownDriverInfo = false;
    console.log("Trip state reset.");
}

// --- Rating Logic ---
function showRatingModal() { console.log("Showing rating modal."); ratingModal.style.display = 'flex'; }
stars.forEach(star => {
    star.addEventListener('click', () => {
        console.log("Star clicked.");
        selectedRating = parseInt(star.dataset.value);
        stars.forEach(s => { s.classList.toggle('selected', parseInt(s.dataset.value) <= selectedRating); });
    });
});
submitRatingButton.addEventListener('click', async () => {
    console.log("Submit rating button clicked.");
    if (selectedRating === 0 || !currentTripId) { console.log("No rating selected or trip ID missing."); return; }
    try {
        console.log("Updating trip with rating:", selectedRating);
        await updateDoc(doc(db, "trips", currentTripId), { rating: selectedRating });
        ratingModal.style.display = 'none';
        selectedRating = 0;
        stars.forEach(s => s.classList.remove('selected'));
        resetTripState();
        console.log("Rating submitted successfully.");
    } catch (error) {
        console.error("Error submitting rating: ", error);
        alert("No se pudo enviar tu calificación.");
    }
});

// --- Trip History Logic ---
async function showTripHistory() {
    console.log("showTripHistory called.");
    if (!currentUser) { console.log("No current user."); return; }
    historyList.innerHTML = '<div class="loader"></div>';
    historyModal.style.display = 'flex';
    closeSideNav();
    console.log("Fetching trip history for user:", currentUser.uid);
    const q = query(collection(db, "trips"), where("userId", "==", currentUser.uid), orderBy("createdAt", "desc"));
    try {
        console.log("Executing Firestore query.");
        const querySnapshot = await getDocs(q);
        console.log("Query snapshot obtained. Empty:", querySnapshot.empty);
        historyList.innerHTML = '';
        if (querySnapshot.empty) {
            historyList.innerHTML = '<p>No has realizado ningún viaje.</p>';
            console.log("No trips found.");
            return;
        }
        querySnapshot.forEach(doc => {
            console.log("Creating history item for trip:", doc.data());
            createHistoryItem(doc.data());
        });
        console.log("Trip history displayed.");
    } catch (error) {
        console.error("Error getting trip history: ", error);
        historyList.innerHTML = '<p>No se pudo cargar el historial.</p>';
    }
}

function createHistoryItem(trip) {
    console.log("createHistoryItem called with trip:", trip);
    const item = document.createElement('div');
    item.className = 'history-item';
    // Ensure trip.createdAt is a Firestore Timestamp before calling toDate()
    const tripDate = trip.createdAt && typeof trip.createdAt.toDate === 'function' 
        ? trip.createdAt.toDate().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
        : 'Fecha desconocida';
    const statusText = getStatusInfo(trip.status).statusText;
    const rating = trip.rating ? `${trip.rating} <i class="fas fa-star" style="color: #ffc107;"></i>` : 'Sin calificar';
    item.innerHTML = `<h4>Viaje del ${tripDate}</h4><p>Estado: <strong class="status status-${trip.status}">${statusText}</strong></p><p>Calificación: ${rating}</p>`;
    historyList.appendChild(item);
    console.log("History item appended.");
}

function hideTripHistory() { console.log("Hiding history modal."); historyModal.style.display = 'none'; }

// --- Profile Modal Functions ---
function showProfileModal() {
    console.log("Showing profile modal.");
    if (!currentUser) return;
    
    profilePicDisplay.src = currentUser.photoURL || 'default-pic.png';
    profileNameDisplay.textContent = currentUser.displayName || 'Usuario';
    
    profileModal.style.display = 'flex';
    closeSideNav();
}

function hideProfileModal() {
    console.log("Hiding profile modal.");
    profileModal.style.display = 'none';
}

// --- Notification Functions ---
function showNotifications() {
    console.log("Showing notifications.");
    // Create a simple notification modal
    const notificationModal = document.createElement('div');
    notificationModal.className = 'overlay-container';
    notificationModal.style.display = 'flex';
    notificationModal.innerHTML = `
        <div class="modal-box">
            <h2>Notificaciones</h2>
            <div class="notification-list">
                <p>No tienes notificaciones nuevas.</p>
            </div>
            <div class="modal-actions">
                <button type="button" onclick="this.closest('.overlay-container').remove()">Cerrar</button>
            </div>
        </div>
    `;
    document.body.appendChild(notificationModal);
    closeSideNav();
}
