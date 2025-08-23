
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
const toggleNavigationBtn = document.getElementById('toggle-navigation-btn');

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

// --- Audio Control Elements ---
const soundToggle = document.getElementById('sound-toggle');

// --- App State ---
let map, currentUser, locationWatcherId, activeTripId;
let driverMarker, userMarker, directionsService, directionsRenderer;
let requestMarkers = {};
let unsubscribeFromRequests;
let notificationSound; // Audio para notificaciones
let navigationMode = false; // Modo de navegación activo
let originalZoom = 14; // Zoom original del mapa
let navigationZoom = 18; // Zoom para navegación

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
    initializeNotificationSound(); // Initialize audio
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

// --- Audio Control Events ---
soundToggle.addEventListener('change', (e) => {
    const icon = e.target.parentElement.querySelector('i');
    if (e.target.checked) {
        icon.className = 'fas fa-volume-up';
        icon.style.color = '#4285F4';
    } else {
        icon.className = 'fas fa-volume-mute';
        icon.style.color = '#999';
    }
});

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
        
        const previousRequestCount = requestsList.children.length;
        clearRequestMarkers();
        requestsList.innerHTML = '';
        
        if (snapshot.empty) { 
            requestsList.innerHTML = '<p>No hay solicitudes pendientes.</p>'; 
            return; 
        }
        
        snapshot.forEach((doc) => createRequestCard(doc.data(), doc.id));
        
        // Reproducir sonido si hay nuevas solicitudes
        const currentRequestCount = snapshot.size;
        if (currentRequestCount > previousRequestCount && onlineToggle.checked) {
            playNotificationSound();
            showNotificationToast('¡Nueva solicitud de viaje!');
        }
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
        
        // Activar modo de navegación
        activateNavigationMode(tripData.userLocation);
        
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
            
            // Mostrar información de la ruta
            const route = result.routes[0];
            const leg = route.legs[0];
            showRouteInfo(leg.distance.text, leg.duration.text);
        } else { console.error('Directions request failed: ' + status); }
    });
}

function showRouteInfo(distance, duration) {
    // Crear o actualizar información de ruta
    let routeInfo = document.getElementById('route-info');
    if (!routeInfo) {
        routeInfo = document.createElement('div');
        routeInfo.id = 'route-info';
        routeInfo.style.cssText = `
            position: fixed;
            top: 130px;
            left: 20px;
            background: rgba(255, 255, 255, 0.95);
            padding: 12px 16px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 500;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(0,0,0,0.1);
            max-width: 300px;
        `;
        document.body.appendChild(routeInfo);
    }
    
    routeInfo.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 6px;">
                <i class="fas fa-road" style="color: #4285F4;"></i>
                <span>${distance}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
                <i class="fas fa-clock" style="color: #34A853;"></i>
                <span>${duration}</span>
            </div>
        </div>
        <div style="border-top: 1px solid #eee; padding-top: 8px;">
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">Próxima instrucción:</div>
            <div id="next-instruction" style="font-size: 13px; color: #333; font-weight: 500;">
                Siguiendo la ruta optimizada...
            </div>
        </div>
    `;
    
    // Animar entrada
    routeInfo.style.transform = 'translateY(-20px)';
    routeInfo.style.opacity = '0';
    setTimeout(() => {
        routeInfo.style.transition = 'all 0.3s ease';
        routeInfo.style.transform = 'translateY(0)';
        routeInfo.style.opacity = '1';
    }, 100);
}

function updateNextInstruction(instruction) {
    const nextInstruction = document.getElementById('next-instruction');
    if (nextInstruction) {
        nextInstruction.textContent = instruction;
    }
}

function toggleNavigationMode() {
    if (navigationMode) {
        // Desactivar modo navegación
        deactivateNavigationMode();
        toggleNavigationBtn.innerHTML = '<i class="fas fa-route"></i> Modo Navegación';
        toggleNavigationBtn.className = 'nav-toggle-btn navigation-mode';
    } else {
        // Activar modo navegación
        if (userMarker) {
            activateNavigationMode(userMarker.getPosition());
            toggleNavigationBtn.innerHTML = '<i class="fas fa-map"></i> Vista Normal';
            toggleNavigationBtn.className = 'nav-toggle-btn normal-mode';
        }
    }
}

// --- Navigation Mode Functions ---
function activateNavigationMode(userLocation) {
    navigationMode = true;
    
    // Cambiar zoom del mapa
    map.setZoom(navigationZoom);
    
    // Centrar mapa en la ruta
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(userLocation);
    
    // Agregar padding para mejor vista
    map.fitBounds(bounds, 80);
    
    // Mostrar indicador de modo navegación
    showNavigationIndicator();
    
    // Configurar actualización automática de vista
    startNavigationViewUpdates();
}

function showNavigationIndicator() {
    // Crear indicador de modo navegación
    const navIndicator = document.createElement('div');
    navIndicator.id = 'navigation-indicator';
    navIndicator.innerHTML = `
        <div class="nav-indicator-content">
            <i class="fas fa-route"></i>
            <span>Modo Navegación</span>
        </div>
    `;
    navIndicator.style.cssText = `
        position: fixed;
        top: 80px;
        left: 20px;
        background: #28a745;
        color: white;
        padding: 8px 12px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: 500;
        z-index: 1000;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        gap: 8px;
    `;
    
    document.body.appendChild(navIndicator);
    
    // Animar entrada
    navIndicator.style.transform = 'translateY(-20px)';
    navIndicator.style.opacity = '0';
    setTimeout(() => {
        navIndicator.style.transition = 'all 0.3s ease';
        navIndicator.style.transform = 'translateY(0)';
        navIndicator.style.opacity = '1';
    }, 100);
}

function startNavigationViewUpdates() {
    // Actualizar vista de navegación cada 5 segundos
    const navigationInterval = setInterval(() => {
        if (!navigationMode || !activeTripId) {
            clearInterval(navigationInterval);
            return;
        }
        
        // Mantener zoom y centrar en la ruta activa
        if (driverMarker && userMarker) {
            const bounds = new google.maps.LatLngBounds();
            bounds.extend(driverMarker.getPosition());
            bounds.extend(userMarker.getPosition());
            map.fitBounds(bounds, 80);
        }
    }, 5000);
}

function deactivateNavigationMode() {
    navigationMode = false;
    
    // Restaurar zoom original
    map.setZoom(originalZoom);
    
    // Remover indicador de navegación
    const navIndicator = document.getElementById('navigation-indicator');
    if (navIndicator) {
        navIndicator.style.transition = 'all 0.3s ease';
        navIndicator.style.transform = 'translateY(-20px)';
        navIndicator.style.opacity = '0';
        setTimeout(() => {
            if (navIndicator.parentNode) {
                navIndicator.parentNode.removeChild(navIndicator);
            }
        }, 300);
    }
    
    // Remover información de ruta
    const routeInfo = document.getElementById('route-info');
    if (routeInfo) {
        routeInfo.style.transition = 'all 0.3s ease';
        routeInfo.style.transform = 'translateY(-20px)';
        routeInfo.style.opacity = '0';
        setTimeout(() => {
            if (routeInfo.parentNode) {
                routeInfo.parentNode.removeChild(routeInfo);
            }
        }, 300);
    }
}

startTripButton.addEventListener('click', () => updateTripStatus('in_progress'));
endTripButton.addEventListener('click', () => updateTripStatus('completed'));

// --- Navigation Toggle Events ---
toggleNavigationBtn.addEventListener('click', toggleNavigationMode);

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
    driverMarker = new google.maps.Marker({ 
        position: initialLocation, 
        map: map, 
        icon: { 
            path: google.maps.SymbolPath.CIRCLE, 
            scale: 8, 
            fillColor: "#4285F4", 
            fillOpacity: 1, 
            strokeWeight: 2, 
            strokeColor: "white" 
        } 
    });
    
    if (navigationMode) {
        // En modo navegación, centrar en la ruta completa
        updateNavigationView();
    } else {
        updateMapBounds();
    }
    
    locationWatcherId = navigator.geolocation.watchPosition((pos) => {
        const driverLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        updateDoc(doc(db, "trips", activeTripId), { driverLocation });
        driverMarker.setPosition(driverLocation);
        
        if (navigationMode) {
            updateNavigationView();
        } else {
            updateMapBounds();
        }
    }, (err) => console.error("Watch position error:", err), { enableHighAccuracy: true });
}

function updateNavigationView() {
    if (!userMarker || !driverMarker) return;
    
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(userMarker.getPosition());
    bounds.extend(driverMarker.getPosition());
    
    // Mantener zoom de navegación y centrar en la ruta
    map.fitBounds(bounds, 80);
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
    
    // Desactivar modo de navegación
    deactivateNavigationMode();
    
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

// --- Audio Notifications ---
function initializeNotificationSound() {
    // Crear un sonido de notificación usando Web Audio API
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        notificationSound = createNotificationTone(audioContext);
    } catch (error) {
        console.log("Audio context not supported, using fallback");
        // Fallback: usar un archivo de audio externo
        notificationSound = new Audio('https://www.soundjay.com/misc/sounds/bell-ringing-05.wav');
    }
}

function createNotificationTone(audioContext) {
    // Crear un tono de notificación simple
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    return {
        play: () => {
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
        }
    };
}

function playNotificationSound() {
    if (notificationSound && soundToggle.checked) {
        try {
            notificationSound.play();
        } catch (error) {
            console.log("Could not play notification sound:", error);
        }
    }
}

function showNotificationToast(message) {
    // Crear y mostrar una notificación toast
    const toast = document.createElement('div');
    toast.className = 'notification-toast';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4285F4;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 1000;
        font-weight: 500;
        transform: translateX(100%);
        transition: transform 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    // Animar entrada
    setTimeout(() => {
        toast.style.transform = 'translateX(0)';
    }, 100);
    
    // Remover después de 3 segundos
    setTimeout(() => {
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}
