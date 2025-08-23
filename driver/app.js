
import { auth, db } from '../firebase-config.js';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc, setDoc, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

// --- Vehicle Modal Elements ---
const vehicleModal = document.getElementById('vehicle-modal');
const vehicleBtn = document.getElementById('vehicle-btn');
const closeVehicleModalBtn = document.getElementById('close-vehicle-modal-btn');
const vehicleForm = document.getElementById('vehicle-form');

// --- Rating Display Elements ---
const driverAvgRatingSpan = document.getElementById('driver-avg-rating');
const showRatingBtn = document.getElementById('show-rating-btn');

// --- History Modal Elements ---
const historyModal = document.getElementById('history-modal');
const showHistoryBtn = document.getElementById('show-history-btn');
const closeHistoryBtn = document.getElementById('close-history-btn');
const historyList = document.getElementById('history-list');

// --- Notification Elements ---
const notificationBtn = document.querySelector('a[href="#"]:has(i.fa-bell)');

// --- App State ---
let map, currentUser, locationWatcherId, activeTripId;
let driverMarker, userMarker, directionsService, directionsRenderer;
let requestMarkers = {};
let unsubscribeFromRequests;

// --- Authentication ---
onAuthStateChanged(auth, (user) => {
    if (user) { currentUser = user; setupUIForLoggedInUser(user); }
    else { currentUser = null; setupUIForLoggedOutUser(); }
});

loginButton.addEventListener('click', () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch(err => console.error("Auth Error:", err));
});

logoutButton.addEventListener('click', () => {
    if (onlineToggle.checked) { onlineToggle.checked = false; goOffline(); }
    signOut(auth).catch(err => console.error("Sign Out Error:", err));
});

function setupUIForLoggedInUser(user) {
    loginView.style.display = 'none';
    mainUI.style.display = 'block';
    driverProfilePic.src = user.photoURL || 'default-pic.png';
    driverProfileName.textContent = user.displayName || 'Conductor';
    updateDriverRatingDisplay(); // Display rating on login
    if (!map) initializeMap();
}

function setupUIForLoggedOutUser() {
    loginView.style.display = 'flex';
    mainUI.style.display = 'none';
    closeSideNav();
    resetTripState(true);
}

// --- Map Initialization ---
function initializeMap() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => initMap({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => initMap({ lat: 34.0522, lng: -118.2437 }));
    } else { initMap({ lat: 34.0522, lng: -118.2437 }); }
}

document.addEventListener('map-ready', initializeMap);

function initMap(location) {
    map = new google.maps.Map(document.getElementById('map'), { center: location, zoom: 14, disableDefaultUI: true });
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({ suppressMarkers: true, preserveViewport: true });
    directionsRenderer.setMap(map);
}

// --- UI Interactions ---
menuBtn.addEventListener('click', () => { sideNav.style.width = "280px"; navOverlay.style.display = "block"; });
closeNavBtn.addEventListener('click', closeSideNav);
navOverlay.addEventListener('click', closeSideNav);
vehicleBtn.addEventListener('click', showVehicleModal);
closeVehicleModalBtn.addEventListener('click', () => vehicleModal.style.display = 'none');

// --- History Modal Events ---
showHistoryBtn.addEventListener('click', showTripHistory);
closeHistoryBtn.addEventListener('click', hideTripHistory);

// --- Rating Display Events ---
showRatingBtn.addEventListener('click', showRatingModal);

// --- Notification Events ---
notificationBtn.addEventListener('click', showNotifications);

function closeSideNav() { sideNav.style.width = "0"; navOverlay.style.display = "none"; }

// --- Driver Status ---
onlineToggle.addEventListener('change', (e) => { if (e.target.checked) goOnline(); else goOffline(); });
function goOnline() { onlineStatus.textContent = 'En línea'; onlineStatus.style.color = '#28a745'; requestsPanel.style.display = 'block'; if (!unsubscribeFromRequests) listenForRequests(); }
function goOffline() { onlineStatus.textContent = 'Desconectado'; onlineStatus.style.color = '#6c757d'; requestsPanel.style.display = 'none'; if (unsubscribeFromRequests) { unsubscribeFromRequests(); unsubscribeFromRequests = null; } clearRequestMarkers(); requestsList.innerHTML = ''; }

// --- Ride Request Listening ---
function listenForRequests() {
    const q = query(collection(db, "trips"), where("status", "==", "pending"));
    unsubscribeFromRequests = onSnapshot(q, (snapshot) => {
        if (activeTripId) { requestsList.innerHTML = '<p>Completando un viaje...</p>'; return; }
        clearRequestMarkers();
        requestsList.innerHTML = '';
        if (snapshot.empty) { requestsList.innerHTML = '<p>No hay solicitudes pendientes.</p>'; return; }
        snapshot.forEach((doc) => createRequestCard(doc.data(), doc.id));
    });
}

function createRequestCard(trip, tripId) {
    const card = document.createElement('div');
    card.className = 'request-card';
    card.innerHTML = `<h4>${trip.userName || 'Usuario'}</h4><button class="accept-button" data-id="${tripId}">Aceptar</button>`;
    addRequestMarker(trip.userLocation, trip.userName);
    requestsList.appendChild(card);
}

requestsList.addEventListener('click', (e) => { if (e.target.classList.contains('accept-button')) acceptTrip(e.target.dataset.id); });
function addRequestMarker(position, title) { const marker = new google.maps.Marker({ position, map, title }); requestMarkers[title] = marker; }
function clearRequestMarkers() { Object.values(requestMarkers).forEach(marker => marker.setMap(null)); requestMarkers = {}; }

// --- Accept & Manage Trip ---
async function acceptTrip(tripId) {
    if (activeTripId) return;
    activeTripId = tripId;
    const tripRef = doc(db, "trips", tripId);
    const driverRef = doc(db, "drivers", currentUser.uid);
    try {
        const driverDoc = await getDoc(driverRef);
        const driverData = driverDoc.exists() ? driverDoc.data() : {};
        await updateDoc(tripRef, { status: 'accepted', driverId: currentUser.uid, driverInfo: { name: currentUser.displayName, photoURL: currentUser.photoURL, vehicle: driverData.vehicle || null } });
        const tripDoc = await getDoc(tripRef);
        const tripData = tripDoc.data();
        requestsPanel.style.display = 'none';
        tripPanel.style.display = 'block';
        tripClientName.textContent = tripData.userName;
        clearRequestMarkers();
        userMarker = new google.maps.Marker({ position: tripData.userLocation, map, title: tripData.userName });
        navigator.geolocation.getCurrentPosition((pos) => {
            const location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            calculateAndDisplayRoute(location, tripData.userLocation);
            startSharingLocation(location);
        }, (err) => console.error("Geolocation error:", err));
    } catch (error) { console.error("Error accepting trip: ", error); activeTripId = null; }
}

function calculateAndDisplayRoute(origin, destination) {
    directionsService.route({ origin, destination, travelMode: 'DRIVING' }, (result, status) => {
        if (status === 'OK') {
            directionsRenderer.setDirections(result);
            updateDoc(doc(db, "trips", activeTripId), { routePolyline: result.routes[0].overview_polyline });
        } else { console.error('Directions request failed: ' + status); }
    });
}

startTripButton.addEventListener('click', () => updateTripStatus('in_progress'));
endTripButton.addEventListener('click', () => updateTripStatus('completed'));

async function updateTripStatus(status) {
    if (!activeTripId) return;
    await updateDoc(doc(db, "trips", activeTripId), { status });
    if (status === 'completed') {
        // Update driver's aggregate rating
        const tripRef = doc(db, "trips", activeTripId);
        const tripDoc = await getDoc(tripRef);
        const tripData = tripDoc.data();
        const rating = tripData.rating || 0; // Get rating from trip document

        if (rating > 0) { // Only update if a rating was given
            const driverRef = doc(db, "drivers", currentUser.uid);
            const driverDoc = await getDoc(driverRef);
            let newNumTrips = 1;
            let newTotalStars = rating;

            if (driverDoc.exists()) {
                newNumTrips = (driverDoc.data().numTrips || 0) + 1;
                newTotalStars = (driverDoc.data().totalStars || 0) + rating;
            }
            await setDoc(driverRef, { numTrips: newNumTrips, totalStars: newTotalStars }, { merge: true });
            updateDriverRatingDisplay(); // Refresh display
        }
        resetTripState();
    }
}

// --- Location & Map Updates ---
function startSharingLocation(initialLocation) {
    if (driverMarker) driverMarker.setMap(null);
    driverMarker = new google.maps.Marker({ position: initialLocation, map: map, icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#4285F4", fillOpacity: 1, strokeWeight: 2, strokeColor: "white" } });
    updateMapBounds();
    locationWatcherId = navigator.geolocation.watchPosition((pos) => {
        const driverLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        updateDoc(doc(db, "trips", activeTripId), { driverLocation });
        driverMarker.setPosition(driverLocation);
        updateMapBounds();
    }, (err) => console.error("Watch position error:", err), { enableHighAccuracy: true });
}

function updateMapBounds() {
    if (!userMarker || !driverMarker) return;
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(userMarker.getPosition());
    bounds.extend(driverMarker.getPosition());
    map.fitBounds(bounds, 60);
}

function resetTripState(isLogout = false) {
    if (locationWatcherId) navigator.geolocation.clearWatch(locationWatcherId);
    if (directionsRenderer) directionsRenderer.setDirections({ routes: [] });
    if (driverMarker) driverMarker.setMap(null);
    if (userMarker) userMarker.setMap(null);
    locationWatcherId = null; activeTripId = null; driverMarker = null; userMarker = null;
    tripPanel.style.display = 'none';
    if (!isLogout && onlineToggle.checked) {
        requestsPanel.style.display = 'block';
        if (!unsubscribeFromRequests) listenForRequests();
    } else if (isLogout) {
        onlineToggle.checked = false;
        goOffline();
    }
}

// --- Vehicle Management ---
async function showVehicleModal() {
    if (!currentUser) return;
    const driverRef = doc(db, "drivers", currentUser.uid);
    try {
        const docSnap = await getDoc(driverRef);
        if (docSnap.exists() && docSnap.data().vehicle) {
            const vehicle = docSnap.data().vehicle;
            vehicleForm.elements['vehicle-make'].value = vehicle.make || '';
            vehicleForm.elements['vehicle-model'].value = vehicle.model || '';
            vehicleForm.elements['vehicle-color'].value = vehicle.color || '';
            vehicleForm.elements['vehicle-plate'].value = vehicle.plate || '';
        }
    } catch (error) { console.error("Error fetching vehicle data: ", error); }
    vehicleModal.style.display = 'flex';
    closeSideNav();
}

vehicleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    const driverRef = doc(db, "drivers", currentUser.uid);
    const vehicleData = { vehicle: { make: vehicleForm.elements['vehicle-make'].value, model: vehicleForm.elements['vehicle-model'].value, color: vehicleForm.elements['vehicle-color'].value, plate: vehicleForm.elements['vehicle-plate'].value, } };
    try {
        await setDoc(driverRef, vehicleData, { merge: true });
        vehicleModal.style.display = 'none';
        alert("Vehículo guardado con éxito.");
    } catch (error) { console.error("Error saving vehicle: ", error); alert("No se pudo guardar la información del vehículo."); }
});

// --- Driver Rating Display ---
async function updateDriverRatingDisplay() {
    if (!currentUser) return;
    const driverRef = doc(db, "drivers", currentUser.uid);
    try {
        const docSnap = await getDoc(driverRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            const totalStars = data.totalStars || 0;
            const numTrips = data.numTrips || 0;
            if (numTrips > 0) {
                const avgRating = (totalStars / numTrips).toFixed(1);
                driverAvgRatingSpan.innerHTML = `(${avgRating} <i class="fas fa-star"></i>)`;
            } else {
                driverAvgRatingSpan.textContent = '(Sin calificar)';
            }
        } else {
            driverAvgRatingSpan.textContent = '(Sin calificar)';
        }
    } catch (error) {
        console.error("Error fetching driver rating: ", error);
        driverAvgRatingSpan.textContent = '(Error)';
    }
}

// --- Trip History Functions ---
async function showTripHistory() {
    if (!currentUser) return;
    historyList.innerHTML = '<div class="loader"></div>';
    historyModal.style.display = 'flex';
    closeSideNav();
    
    const q = query(collection(db, "trips"), where("driverId", "==", currentUser.uid), orderBy("createdAt", "desc"));
    try {
        const querySnapshot = await getDocs(q);
        historyList.innerHTML = '';
        if (querySnapshot.empty) {
            historyList.innerHTML = '<p>No has completado ningún viaje.</p>';
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
    const tripDate = trip.createdAt && typeof trip.createdAt.toDate === 'function' 
        ? trip.createdAt.toDate().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
        : 'Fecha desconocida';
    const statusText = getTripStatusText(trip.status);
    const rating = trip.rating ? `${trip.rating} <i class="fas fa-star" style="color: #ffc107;"></i>` : 'Sin calificar';
    item.innerHTML = `
        <h4>Viaje del ${tripDate}</h4>
        <p>Cliente: <strong>${trip.userName || 'Usuario'}</strong></p>
        <p>Estado: <strong class="status status-${trip.status}">${statusText}</strong></p>
        <p>Calificación: ${rating}</p>
    `;
    historyList.appendChild(item);
}

function getTripStatusText(status) {
    switch (status) {
        case 'pending': return 'Pendiente';
        case 'accepted': return 'Aceptado';
        case 'in_progress': return 'En Progreso';
        case 'completed': return 'Completado';
        case 'cancelled': return 'Cancelado';
        default: return 'Desconocido';
    }
}

function hideTripHistory() {
    historyModal.style.display = 'none';
}

// --- Rating Modal Functions ---
function showRatingModal() {
    // Create a simple rating display modal
    const ratingModal = document.createElement('div');
    ratingModal.className = 'overlay-container';
    ratingModal.style.display = 'flex';
    ratingModal.innerHTML = `
        <div class="modal-box">
            <h2>Mi Calificación</h2>
            <div class="rating-display">
                <div class="stars-display">
                    ${getStarsHTML()}
                </div>
                <p id="rating-text">Cargando...</p>
            </div>
            <div class="modal-actions">
                <button type="button" onclick="this.closest('.overlay-container').remove()">Cerrar</button>
            </div>
        </div>
    `;
    document.body.appendChild(ratingModal);
    closeSideNav();
    updateRatingDisplay();
}

function getStarsHTML() {
    return `
        <i class="fas fa-star"></i>
        <i class="fas fa-star"></i>
        <i class="fas fa-star"></i>
        <i class="fas fa-star"></i>
        <i class="fas fa-star"></i>
    `;
}

async function updateRatingDisplay() {
    if (!currentUser) return;
    const driverRef = doc(db, "drivers", currentUser.uid);
    try {
        const docSnap = await getDoc(driverRef);
        const ratingText = document.getElementById('rating-text');
        if (docSnap.exists()) {
            const data = docSnap.data();
            const totalStars = data.totalStars || 0;
            const numTrips = data.numTrips || 0;
            if (numTrips > 0) {
                const avgRating = (totalStars / numTrips).toFixed(1);
                ratingText.innerHTML = `Promedio: <strong>${avgRating}/5</strong> (${numTrips} viajes)`;
            } else {
                ratingText.textContent = 'Aún no tienes calificaciones';
            }
        } else {
            ratingText.textContent = 'Aún no tienes calificaciones';
        }
    } catch (error) {
        console.error("Error fetching driver rating: ", error);
        document.getElementById('rating-text').textContent = 'Error al cargar calificación';
    }
}

// --- Notification Functions ---
function showNotifications() {
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
