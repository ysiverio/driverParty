
import { initializeApp } from '../firebase-config.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from '../firebase-config.js';
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, getDoc, getDocs, query, where, orderBy, serverTimestamp, Timestamp } from '../firebase-config.js';
import { APP_CONFIG, PricingCalculator, ValidationUtils, FormatUtils, UIUtils } from '../config.js';

// Inicialización de Firebase
const app = initializeApp();
const auth = getAuth(app);
const db = getFirestore(app);

// Sistema de precios
let pricingCalculator = new PricingCalculator();
let currentPricingConfig = null;

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
    addDebugButton(); // Agregar botón de debug temporal
    loadPricingConfiguration(); // Cargar configuración de precios
    if (!map) initializeMap();
}

// Cargar configuración de precios
async function loadPricingConfiguration() {
    try {
        const configRef = doc(db, "configuration", "pricing");
        const configDoc = await getDoc(configRef);
        
        if (configDoc.exists()) {
            currentPricingConfig = configDoc.data();
            pricingCalculator = new PricingCalculator(currentPricingConfig);
            console.log('Configuración de precios cargada:', currentPricingConfig);
        } else {
            // Usar configuración por defecto
            currentPricingConfig = APP_CONFIG.PRICING;
            pricingCalculator = new PricingCalculator(currentPricingConfig);
            console.log('Usando configuración de precios por defecto');
        }
    } catch (error) {
        console.error('Error loading pricing configuration:', error);
        // Usar configuración por defecto en caso de error
        currentPricingConfig = APP_CONFIG.PRICING;
        pricingCalculator = new PricingCalculator(currentPricingConfig);
    }
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
            
            // Mostrar notificación de calificación recibida
            showNotificationToast(`¡Recibiste ${rating} estrella${rating > 1 ? 's' : ''}!`);
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
    if (!currentUser) {
        console.log("No hay usuario actual");
        return;
    }
    
    console.log("Mostrando historial para conductor:", currentUser.uid);
    historyList.innerHTML = '<div class="loader"></div>';
    historyModal.style.display = 'flex';
    closeSideNav();
    
    try {
        // Primero intentar con consulta simple sin ordenar
        console.log("Intentando consulta simple...");
        const simpleQuery = query(
            collection(db, "trips"), 
            where("driverId", "==", currentUser.uid)
        );
        
        const simpleSnapshot = await getDocs(simpleQuery);
        console.log("Consulta simple resultó en:", simpleSnapshot.size, "documentos");
        
        historyList.innerHTML = '';
        
        if (simpleSnapshot.empty) {
            console.log("No se encontraron viajes para este conductor");
            historyList.innerHTML = '<p>No has completado ningún viaje.</p>';
            return;
        }
        
        // Ordenar los resultados en el cliente
        const trips = [];
        simpleSnapshot.forEach(doc => {
            trips.push({ id: doc.id, ...doc.data() });
        });
        
        // Ordenar por fecha de creación (más reciente primero)
        trips.sort((a, b) => {
            const dateA = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt)) : new Date(0);
            const dateB = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt)) : new Date(0);
            return dateB - dateA;
        });
        
        console.log("Viajes ordenados:", trips.length);
        
        trips.forEach(trip => {
            console.log("Procesando viaje:", trip.id, trip);
            createHistoryItem(trip, trip.id);
        });
        
        console.log("Historial cargado exitosamente");
        
    } catch (error) {
        console.error("Error getting trip history: ", error);
        historyList.innerHTML = '<p>No se pudo cargar el historial. Error: ' + error.message + '</p>';
    }
}

function createHistoryItem(trip, tripId) {
    const item = document.createElement('div');
    item.className = 'history-item';
    
    // Manejar diferentes formatos de fecha
    let tripDate = 'Fecha desconocida';
    if (trip.createdAt) {
        if (typeof trip.createdAt.toDate === 'function') {
            tripDate = trip.createdAt.toDate().toLocaleDateString('es-ES', { 
                day: '2-digit', 
                month: 'long', 
                year: 'numeric' 
            });
        } else if (trip.createdAt instanceof Date) {
            tripDate = trip.createdAt.toLocaleDateString('es-ES', { 
                day: '2-digit', 
                month: 'long', 
                year: 'numeric' 
            });
        } else if (typeof trip.createdAt === 'string') {
            tripDate = new Date(trip.createdAt).toLocaleDateString('es-ES', { 
                day: '2-digit', 
                month: 'long', 
                year: 'numeric' 
            });
        }
    }
    
    const statusText = getTripStatusText(trip.status);
    const rating = trip.rating ? `${trip.rating} <i class="fas fa-star" style="color: #ffc107;"></i>` : 'Sin calificar';
    const userName = trip.userName || 'Usuario desconocido';
    
    item.innerHTML = `
        <h4>Viaje del ${tripDate}</h4>
        <p><strong>ID:</strong> ${tripId || 'N/A'}</p>
        <p><strong>Cliente:</strong> ${userName}</p>
        <p><strong>Estado:</strong> <span class="status status-${trip.status}">${statusText}</span></p>
        <p><strong>Calificación:</strong> ${rating}</p>
        ${trip.driverId ? `<p><strong>Conductor ID:</strong> ${trip.driverId}</p>` : ''}
    `;
    
    historyList.appendChild(item);
    console.log("Elemento de historial creado:", item.innerHTML);
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
    // Create a comprehensive rating display modal
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
                <div id="rating-stats" style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
                    <h4 style="margin-bottom: 10px; color: #333;">Estadísticas</h4>
                    <div id="stats-content">Cargando estadísticas...</div>
                </div>
            </div>
            <div class="modal-actions">
                <button type="button" onclick="this.closest('.overlay-container').remove()">Cerrar</button>
            </div>
        </div>
    `;
    document.body.appendChild(ratingModal);
    closeSideNav();
    updateRatingDisplay();
    updateRatingStats();
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
    if (!currentUser) {
        console.log("No current user for rating display");
        return;
    }
    
    const driverRef = doc(db, "drivers", currentUser.uid);
    try {
        console.log("Fetching driver rating for:", currentUser.uid);
        const docSnap = await getDoc(driverRef);
        const ratingText = document.getElementById('rating-text');
        
        if (!ratingText) {
            console.error("Rating text element not found");
            return;
        }
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            const totalStars = data.totalStars || 0;
            const numTrips = data.numTrips || 0;
            
            console.log("Driver data:", { totalStars, numTrips });
            
            if (numTrips > 0) {
                const avgRating = (totalStars / numTrips).toFixed(1);
                const starsHTML = generateStarsHTML(avgRating);
                ratingText.innerHTML = `
                    <div style="margin-bottom: 10px;">
                        <strong>Promedio: ${avgRating}/5</strong>
                    </div>
                    <div style="margin-bottom: 10px;">
                        ${starsHTML}
                    </div>
                    <div style="font-size: 14px; color: #666;">
                        Basado en ${numTrips} viaje${numTrips > 1 ? 's' : ''}
                    </div>
                `;
                console.log("Rating display updated successfully");
            } else {
                ratingText.innerHTML = `
                    <div style="margin-bottom: 10px;">
                        <strong>Aún no tienes calificaciones</strong>
                    </div>
                    <div style="font-size: 14px; color: #666;">
                        Completa tu primer viaje para recibir calificaciones
                    </div>
                `;
                console.log("No trips completed yet");
            }
        } else {
            ratingText.innerHTML = `
                <div style="margin-bottom: 10px;">
                    <strong>Aún no tienes calificaciones</strong>
                </div>
                <div style="font-size: 14px; color: #666;">
                    Completa tu primer viaje para recibir calificaciones
                </div>
            `;
            console.log("Driver document does not exist");
        }
    } catch (error) {
        console.error("Error fetching driver rating: ", error);
        const ratingText = document.getElementById('rating-text');
        if (ratingText) {
            ratingText.innerHTML = `
                <div style="color: #dc3545;">
                    <strong>Error al cargar calificación</strong>
                </div>
                <div style="font-size: 12px; color: #666;">
                    Intenta de nuevo más tarde
                </div>
            `;
        }
    }
}

function generateStarsHTML(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    let starsHTML = '';
    
    // Estrellas llenas
    for (let i = 0; i < fullStars; i++) {
        starsHTML += '<i class="fas fa-star" style="color: #ffc107; margin: 0 2px;"></i>';
    }
    
    // Media estrella si es necesario
    if (hasHalfStar) {
        starsHTML += '<i class="fas fa-star-half-alt" style="color: #ffc107; margin: 0 2px;"></i>';
    }
    
    // Estrellas vacías
    for (let i = 0; i < emptyStars; i++) {
        starsHTML += '<i class="far fa-star" style="color: #ccc; margin: 0 2px;"></i>';
    }
    
    return starsHTML;
}

async function updateRatingStats() {
    if (!currentUser) {
        console.log("No current user for stats");
        return;
    }
    
    try {
        console.log("Loading rating stats for driver:", currentUser.uid);
        
        // Primero intentar obtener datos del documento del conductor
        const driverRef = doc(db, "drivers", currentUser.uid);
        const driverDoc = await getDoc(driverRef);
        
        let totalRatings = 0;
        let avgRating = 0;
        let ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        
        if (driverDoc.exists()) {
            const data = driverDoc.data();
            const totalStars = data.totalStars || 0;
            const numTrips = data.numTrips || 0;
            
            if (numTrips > 0) {
                totalRatings = numTrips;
                avgRating = (totalStars / numTrips).toFixed(1);
                
                // Intentar obtener distribución detallada de calificaciones
                try {
                    const q = query(
                        collection(db, "trips"), 
                        where("driverId", "==", currentUser.uid)
                    );
                    
                    const querySnapshot = await getDocs(q);
                    const ratings = [];
                    
                    querySnapshot.forEach(doc => {
                        const trip = doc.data();
                        if (trip.rating && trip.rating > 0) {
                            ratings.push(trip.rating);
                            ratingDistribution[trip.rating] = (ratingDistribution[trip.rating] || 0) + 1;
                        }
                    });
                    
                    console.log("Found ratings:", ratings);
                    console.log("Rating distribution:", ratingDistribution);
                    
                } catch (queryError) {
                    console.log("Could not get detailed ratings, using basic stats:", queryError);
                    // Si no podemos obtener la distribución, usar datos básicos
                }
            }
        }
        
        const statsContent = document.getElementById('stats-content');
        if (!statsContent) {
            console.error("Stats content element not found");
            return;
        }
        
        if (totalRatings === 0) {
            statsContent.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <i class="fas fa-star" style="font-size: 48px; color: #ccc; margin-bottom: 10px;"></i>
                    <p style="color: #666; font-style: italic;">No hay calificaciones disponibles</p>
                    <p style="color: #999; font-size: 12px;">Completa tu primer viaje para recibir calificaciones</p>
                </div>
            `;
            return;
        }
        
        // Calcular porcentajes
        const fiveStars = ratingDistribution[5] || 0;
        const fourStars = ratingDistribution[4] || 0;
        const threeStars = ratingDistribution[3] || 0;
        const twoStars = ratingDistribution[2] || 0;
        const oneStars = ratingDistribution[1] || 0;
        
        statsContent.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                <div style="text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: #4285F4;">${totalRatings}</div>
                    <div style="font-size: 12px; color: #666;">Total Calificaciones</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: #34A853;">${avgRating}</div>
                    <div style="font-size: 12px; color: #666;">Promedio</div>
                </div>
            </div>
            <div style="font-size: 14px; margin-bottom: 10px;">
                <strong>Distribución de calificaciones:</strong>
            </div>
            <div style="font-size: 12px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px; padding: 5px; background: #f8f9fa; border-radius: 4px;">
                    <span>⭐⭐⭐⭐⭐</span>
                    <span>${fiveStars} (${totalRatings > 0 ? ((fiveStars/totalRatings)*100).toFixed(0) : 0}%)</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px; padding: 5px; background: #f8f9fa; border-radius: 4px;">
                    <span>⭐⭐⭐⭐</span>
                    <span>${fourStars} (${totalRatings > 0 ? ((fourStars/totalRatings)*100).toFixed(0) : 0}%)</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px; padding: 5px; background: #f8f9fa; border-radius: 4px;">
                    <span>⭐⭐⭐</span>
                    <span>${threeStars} (${totalRatings > 0 ? ((threeStars/totalRatings)*100).toFixed(0) : 0}%)</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px; padding: 5px; background: #f8f9fa; border-radius: 4px;">
                    <span>⭐⭐</span>
                    <span>${twoStars} (${totalRatings > 0 ? ((twoStars/totalRatings)*100).toFixed(0) : 0}%)</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px; padding: 5px; background: #f8f9fa; border-radius: 4px;">
                    <span>⭐</span>
                    <span>${oneStars} (${totalRatings > 0 ? ((oneStars/totalRatings)*100).toFixed(0) : 0}%)</span>
                </div>
            </div>
        `;
        
        console.log("Rating stats updated successfully");
        
    } catch (error) {
        console.error("Error updating rating stats:", error);
        const statsContent = document.getElementById('stats-content');
        if (statsContent) {
            statsContent.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #dc3545; margin-bottom: 10px;"></i>
                    <p style="color: #dc3545; font-weight: bold;">Error al cargar estadísticas</p>
                    <p style="color: #666; font-size: 12px;">Intenta de nuevo más tarde</p>
                </div>
            `;
        }
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

// --- Debug Functions (Temporary) ---
function debugDriverStats() {
    console.log("=== DEBUG: Driver Statistics ===");
    console.log("Current user:", currentUser);
    
    if (!currentUser) {
        console.log("No current user");
        return;
    }
    
    console.log("Driver ID:", currentUser.uid);
    
    // Verificar documento del conductor
    const driverRef = doc(db, "drivers", currentUser.uid);
    getDoc(driverRef).then(docSnap => {
        console.log("Driver document exists:", docSnap.exists());
        if (docSnap.exists()) {
            console.log("Driver data:", docSnap.data());
        }
    }).catch(error => {
        console.error("Error getting driver document:", error);
    });
    
    // Verificar viajes del conductor
    const tripsQuery = query(collection(db, "trips"), where("driverId", "==", currentUser.uid));
    getDocs(tripsQuery).then(querySnapshot => {
        console.log("Total trips for driver:", querySnapshot.size);
        querySnapshot.forEach(doc => {
            const trip = doc.data();
            console.log("Trip:", doc.id, trip);
        });
    }).catch(error => {
        console.error("Error getting trips:", error);
    });
}

// Agregar botón de debug temporal
function addDebugButton() {
    const debugBtn = document.createElement('button');
    debugBtn.textContent = 'Debug Stats';
    debugBtn.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 20px;
        background: #dc3545;
        color: white;
        border: none;
        padding: 10px;
        border-radius: 5px;
        z-index: 1000;
        cursor: pointer;
        font-size: 12px;
    `;
    debugBtn.onclick = debugDriverStats;
    document.body.appendChild(debugBtn);
}
