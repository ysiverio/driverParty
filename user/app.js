import { 
    auth, 
    db,
    GoogleAuthProvider, 
    signInWithPopup, 
    onAuthStateChanged, 
    signOut,
    collection, 
    addDoc, 
    onSnapshot, 
    doc, 
    updateDoc, 
    deleteDoc, 
    getDoc, 
    getDocs, 
    query, 
    where, 
    orderBy, 
    serverTimestamp, 
    Timestamp 
} from '../firebase-config.js';
import { APP_CONFIG, PricingCalculator, ValidationUtils, FormatUtils, UIUtils } from '../config.js';

// Sistema de precios
let pricingCalculator = new PricingCalculator();
let currentPricingConfig = null;

console.log("user/app.js loaded and running!");

// --- DOM Elements ---
const loginView = document.getElementById('login-view');
const mainUI = document.getElementById('main-ui');
const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');
const destinationInput = document.getElementById('destination-input');

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

// --- Audio Control Elements ---
const soundToggle = document.getElementById('sound-toggle');

// --- Driver Card Elements ---
const driverCard = document.getElementById('driver-card');
const cardDriverPic = document.getElementById('card-driver-pic');
const cardDriverName = document.getElementById('card-driver-name');
const cardDriverStars = document.getElementById('card-driver-stars');
const cardDriverRatingText = document.getElementById('card-driver-rating-text');
const cardDriverAvgRating = document.getElementById('card-driver-avg-rating');
const cardDriverTrips = document.getElementById('card-driver-trips');
const cardVehicleModel = document.getElementById('card-vehicle-model');
const cardVehicleColor = document.getElementById('card-vehicle-color');
const cardVehiclePlate = document.getElementById('card-vehicle-plate');
const minimizeCardBtn = document.getElementById('minimize-card-btn');
const driverCardClose = document.querySelector('.driver-card-close');

// --- New Trip Status Screens ---
const searchingScreen = document.getElementById('searching-screen');
const driverEnrouteScreen = document.getElementById('driver-enroute-screen');
const taxiArrivedScreen = document.getElementById('taxi-arrived-screen');
const cancelSearchBtn = document.getElementById('cancel-search-btn');
const okArrivalBtn = document.getElementById('ok-arrival-btn');

// --- Enroute Screen Elements ---
const enrouteDriverPic = document.getElementById('enroute-driver-pic');
const enrouteDriverName = document.getElementById('enroute-driver-name');
const enrouteTime = document.getElementById('enroute-time');
const enrouteDistance = document.getElementById('enroute-distance');

// --- App State ---
let map, userMarker, driverMarker, tripRoutePolyline, autocomplete;
let currentUser, currentTripId, currentTripRequestId, currentTripDriverId;
let selectedRating = 0;
let hasShownDriverInfo = false;
let notificationSound; // Audio para notificaciones
let navigationMode = false; // Modo de navegación activo
let currentTripStatus = 'none'; // 'searching', 'enroute', 'arrived', 'none'
let tripListener = null; // Listener para actualizaciones del viaje
let tripRequestListener = null; // Listener para actualizaciones de la solicitud
let userLocation = null;
let destinationLocation = null;
let originalZoom = 15; // Zoom original del mapa
let navigationZoom = 18; // Zoom para navegación

// --- Persistencia de Estado ---
const TRIP_STORAGE_KEY = 'driverParty_user_trip_state';
const SESSION_STORAGE_KEY = 'driverParty_user_session';

// Función para guardar el estado del viaje
function saveTripState() {
    const tripState = {
        currentTripId,
        currentTripRequestId,
        currentTripDriverId,
        navigationMode,
        timestamp: Date.now()
    };
    
    try {
        localStorage.setItem(TRIP_STORAGE_KEY, JSON.stringify(tripState));
        console.log('Estado del viaje guardado:', tripState);
    } catch (error) {
        console.error('Error guardando estado del viaje:', error);
    }
}

// Función para cargar el estado del viaje
function loadTripState() {
    try {
        const savedState = localStorage.getItem(TRIP_STORAGE_KEY);
        if (savedState) {
            const tripState = JSON.parse(savedState);
            
            // Verificar si el estado no es muy antiguo (máximo 24 horas)
            const isRecent = (Date.now() - tripState.timestamp) < (24 * 60 * 60 * 1000);
            
            if (isRecent) {
                currentTripId = tripState.currentTripId;
                currentTripRequestId = tripState.currentTripRequestId;
                currentTripDriverId = tripState.currentTripDriverId;
                navigationMode = tripState.navigationMode;
                
                console.log('Estado del viaje cargado:', tripState);
                return true;
            } else {
                // Estado muy antiguo, limpiarlo
                clearTripState();
                console.log('Estado del viaje muy antiguo, limpiado');
            }
        }
    } catch (error) {
        console.error('Error cargando estado del viaje:', error);
        clearTripState();
    }
    return false;
}

// Función para limpiar el estado del viaje
function clearTripState() {
    try {
        localStorage.removeItem(TRIP_STORAGE_KEY);
        console.log('Estado del viaje limpiado');
    } catch (error) {
        console.error('Error limpiando estado del viaje:', error);
    }
}

// Función para verificar y restaurar viaje en curso
async function checkAndRestoreActiveTrip() {
    if (!currentUser) return;
    
    const hasActiveTrip = loadTripState();
    if (!hasActiveTrip) return;
    
    console.log('Verificando viaje en curso...');
    
    // Verificar si el viaje aún existe en Firestore
    if (currentTripId) {
        try {
            const tripDoc = await getDoc(doc(db, "trips", currentTripId));
            if (tripDoc.exists()) {
                const tripData = tripDoc.data();
                
                // Si el viaje no está completado o cancelado, restaurarlo
                if (tripData.status !== 'completed' && tripData.status !== 'cancelled') {
                    console.log('Restaurando viaje en curso:', currentTripId);
                    await restoreActiveTrip(tripData);
                    return;
                }
            }
        } catch (error) {
            console.error('Error verificando viaje:', error);
        }
    }
    
    // Verificar si hay solicitud de viaje activa
    if (currentTripRequestId) {
        try {
            const requestDoc = await getDoc(doc(db, "tripRequests", currentTripRequestId));
            if (requestDoc.exists()) {
                const requestData = requestDoc.data();
                
                // Si la solicitud no está completada o cancelada, restaurarla
                if (requestData.status !== 'completed' && requestData.status !== 'cancelled' && requestData.status !== 'expired') {
                    console.log('Restaurando solicitud de viaje:', currentTripRequestId);
                    await restoreActiveTripRequest(requestData);
                    return;
                }
            }
        } catch (error) {
            console.error('Error verificando solicitud de viaje:', error);
        }
    }
    
    // Si no hay viaje válido, limpiar estado
    console.log('No se encontró viaje válido, limpiando estado');
    clearTripState();
    resetTripState();
}

// Función para restaurar un viaje activo
async function restoreActiveTrip(tripData) {
    try {
        // Restaurar UI del viaje
        tripPanel.style.display = 'block';
        requestPanel.style.display = 'none';
        
        // Actualizar UI con datos del viaje
        updateTripUI(tripData);
        
        // Restaurar información del conductor si existe
        if (tripData.driverInfo && !hasShownDriverInfo) {
            displayDriverInfo(tripData.driverInfo);
        }
        
        // Restaurar ruta si existe
        if (tripData.routePolyline) {
            drawRoute(tripData.routePolyline);
        }
        
        // Restaurar marcador del conductor si existe
        if (tripData.driverLocation) {
            updateDriverMarker(tripData.driverLocation);
        }
        
        // Activar modo navegación si el viaje está en progreso
        if (tripData.status === 'in_progress' && !navigationMode) {
            activateNavigationMode();
        }
        
        // Reconectar listener del viaje
        listenToTripUpdates(currentTripId);
        
        showNotificationToast('Viaje en curso restaurado');
        console.log('Viaje restaurado exitosamente');
        
    } catch (error) {
        console.error('Error restaurando viaje:', error);
        clearTripState();
        resetTripState();
    }
}

// Función para restaurar una solicitud de viaje activa
async function restoreActiveTripRequest(requestData) {
    try {
        // Restaurar UI de la solicitud
        requestPanel.style.display = 'none';
        tripInfoContainer.style.display = 'block';
        
        // Actualizar estado de la solicitud
        if (requestData.status === 'accepted') {
            tripStatusHeading.textContent = 'Conductor Encontrado';
            tripStatusDetails.textContent = 'Por favor, confirma los detalles y el pago para comenzar.';
            
            // Obtener información del conductor
            const driverRef = doc(db, "drivers", requestData.driverId);
            const driverDoc = await getDoc(driverRef);
            const driverData = driverDoc.exists() ? driverDoc.data() : {};
            
            // Mostrar modal de confirmación de pago
            showPaymentConfirmationModal(requestData, driverData);
        } else {
            tripStatusHeading.textContent = 'Buscando Conductor';
            tripStatusDetails.textContent = 'Estamos buscando un conductor disponible...';
        }
        
        // Reconectar listener de la solicitud
        listenToTripRequestUpdates(currentTripRequestId);
        
        showNotificationToast('Solicitud de viaje restaurada');
        console.log('Solicitud de viaje restaurada exitosamente');
        
    } catch (error) {
        console.error('Error restaurando solicitud de viaje:', error);
        clearTripState();
        resetTripState();
    }
}

// --- Authentication ---
console.log("Setting up onAuthStateChanged listener.");
onAuthStateChanged(auth, (user) => {
    console.log("onAuthStateChanged triggered. User:", user);
    if (user) {
        currentUser = user;
        setupUIForLoggedInUser(user);
        
        // Verificar si hay un viaje en curso al iniciar sesión
        setTimeout(async () => {
            await checkAndRestoreActiveTrip();
        }, 2000); // Esperar 2 segundos para que el mapa se inicialice
    } else {
        currentUser = null;
        setupUIForLoggedOutUser();
        clearTripState(); // Limpiar estado al cerrar sesión
    }
});

// --- New Trip Status Screen Event Listeners ---
if (cancelSearchBtn) {
    cancelSearchBtn.addEventListener('click', () => {
        cancelTripRequest();
    });
}

if (okArrivalBtn) {
    okArrivalBtn.addEventListener('click', () => {
        hideAllTripScreens();
        // Continue with trip flow
        if (currentTripId) {
            // Trip can continue normally
            console.log('User acknowledged taxi arrival');
        }
    });
}

loginButton.addEventListener('click', async () => {
    try {
    console.log("Login button clicked.");
        
        const recaptchaToken = await UIUtils.executeRecaptcha('user_login');
        
        if (!recaptchaToken) {
            alert('Error de verificación de seguridad. Por favor, intenta nuevamente.');
            return;
        }
        
    const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        console.log('Login exitoso:', result.user);
    } catch (error) {
        console.error('Error en login:', error);
        alert('Error al iniciar sesión: ' + error.message);
    }
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
    initializeNotificationSound();
    loadPricingConfiguration();
    if (!map) initializeMap();
}

async function loadPricingConfiguration() {
    try {
        const configRef = doc(db, "configuration", "pricing");
        const configDoc = await getDoc(configRef);
        
        if (configDoc.exists()) {
            currentPricingConfig = configDoc.data();
            pricingCalculator = new PricingCalculator(currentPricingConfig);
            console.log('Configuración de precios cargada:', currentPricingConfig);
        } else {
            currentPricingConfig = APP_CONFIG.PRICING;
            pricingCalculator = new PricingCalculator(currentPricingConfig);
            console.log('Usando configuración de precios por defecto');
        }
    } catch (error) {
        console.error('Error loading pricing configuration:', error);
        currentPricingConfig = APP_CONFIG.PRICING;
        pricingCalculator = new PricingCalculator(currentPricingConfig);
    }
}

function setupUIForLoggedOutUser() {
    console.log("setupUIForLoggedOutUser called.");
    loginView.style.display = 'flex';
    mainUI.style.display = 'none';
    closeSideNav();
    resetTripState();
}

// --- Utility Functions ---
function calculateFare(distance) {
    if (!pricingCalculator) {
        // Fallback to default pricing if calculator isn't available
        const baseFare = 2.00;
        const ratePerKm = 3.50;
        return Math.max(baseFare + (distance * ratePerKm), 5.00);
    }
    return pricingCalculator.calculateUserFare(distance);
}

function initializeMap() {
    console.log("initializeMap() called.");
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            initMap(userLocation);
        }, 
        () => {
            userLocation = { lat: 34.0522, lng: -118.2437 }; // Default location
            initMap(userLocation);
        });
    } else {
        userLocation = { lat: 34.0522, lng: -118.2437 }; // Default location
        initMap(userLocation);
    }
}

document.addEventListener('map-ready', initializeMap);

function initMap(location) {
    console.log("initMap() called with location:", location);
    const mapElement = document.getElementById('map');
    if (!mapElement || mapElement.offsetWidth === 0 || mapElement.offsetHeight === 0) {
        setTimeout(() => initMap(location), 100); 
        return;
    }
    
    try {
        map = new google.maps.Map(mapElement, { 
            center: location, 
            zoom: 15, 
            disableDefaultUI: true,
            mapId: 'user_map'
        });
        
        userMarker = createCustomMarker(location, map, 'Tu ubicación', '#4285f4');
        console.log("Map and user marker initialized successfully.");
        
        // --- NUEVA INICIALIZACIÓN DE AUTOCOMPLETADO ---
        initializeAutocomplete();

    } catch (error) {
        console.error('Error initializing map:', error);
    }
}

// --- LÓGICA DE AUTOCOMPLETADO (REFACTORIZADA) ---
function initializeAutocomplete() {
    if (!google || !google.maps || !google.maps.places) {
        console.error("La librería de Google Maps Places no está disponible.");
        return;
    }

    const options = {
        bounds: map.getBounds(),
        componentRestrictions: { country: "uy" }, // Restringir a Uruguay
        fields: ["address_components", "geometry", "icon", "name", "place_id"],
        strictBounds: false,
    };

    autocomplete = new google.maps.places.Autocomplete(destinationInput, options);
    autocomplete.setFields(['place_id', 'geometry', 'name']);

    autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (!place.geometry || !place.geometry.location) {
            console.log("El usuario introdujo un lugar sin geometría.");
            return;
        }

        // Guardar el place_id para usarlo al solicitar el viaje
        destinationInput.dataset.placeId = place.place_id;
        console.log(`Lugar seleccionado: ${place.name}, place_id: ${place.place_id}`);

        // Opcional: Centrar el mapa en el destino seleccionado
        if (place.geometry.viewport) {
            map.fitBounds(place.geometry.viewport);
        } else {
            map.setCenter(place.geometry.location);
            map.setZoom(17);
        }
    });
}


// --- UI Interactions ---
if (menuBtn) menuBtn.addEventListener('click', () => openSideNav());
if (closeNavBtn) closeNavBtn.addEventListener('click', () => closeSideNav());
if (navOverlay) navOverlay.addEventListener('click', () => closeSideNav());
if (showHistoryBtn) showHistoryBtn.addEventListener('click', () => showTripHistory());
if (closeHistoryBtn) closeHistoryBtn.addEventListener('click', () => hideTripHistory());
if (showProfileBtn) showProfileBtn.addEventListener('click', showProfileModal);
if (closeProfileModalBtn) closeProfileModalBtn.addEventListener('click', hideProfileModal);
if (notificationBtn) notificationBtn.addEventListener('click', showNotifications);
if (soundToggle) soundToggle.addEventListener('change', (e) => {
    const icon = e.target.parentElement.querySelector('i');
    icon.className = e.target.checked ? 'fas fa-volume-up' : 'fas fa-volume-mute';
    icon.style.color = e.target.checked ? '#28a745' : '#999';
});

function openSideNav() { sideNav.style.width = "280px"; navOverlay.style.display = "block"; }
function closeSideNav() { sideNav.style.width = "0"; navOverlay.style.display = "none"; }


// --- Ride Request ---
if (requestDriverButton) {
requestDriverButton.addEventListener('click', async () => {
    console.log("Request driver button clicked.");
        if (!currentUser || !map) return;
        
        if (!destinationInput.value.trim()) {
            showNotificationToast('Por favor ingresa el destino', 'warning');
            return;
        }
        
        if (!destinationInput.dataset.placeId) {
            showNotificationToast('Por favor selecciona una dirección de la lista para mayor precisión', 'warning');
            // No se retorna para permitir geocodificación manual si es necesario
        }
    
        try {
            const recaptchaToken = await UIUtils.executeRecaptcha('trip_request');
            if (!recaptchaToken) {
                alert('Error de verificación de seguridad. Por favor, intenta nuevamente.');
                return;
            }

    const userLocation = { lat: map.getCenter().lat(), lng: map.getCenter().lng() };
            let destinationLocation;

            if (destinationInput.dataset.placeId) {
                try {
                    // Intentar usar PlacesService (método tradicional pero funcional)
                    const placesService = new google.maps.places.PlacesService(map);
                    
                    const placeResult = await new Promise((resolve, reject) => {
                        placesService.getDetails({ 
                            placeId: destinationInput.dataset.placeId, 
                            fields: ['geometry'] 
                        }, (place, status) => {
                            if (status === google.maps.places.PlacesServiceStatus.OK && place.geometry) {
                                resolve(place.geometry.location);
                            } else {
                                reject(new Error('No se pudo obtener los detalles del lugar.'));
                            }
                        });
                    });
                    
                    destinationLocation = { 
                        lat: placeResult.lat(), 
                        lng: placeResult.lng() 
                    };
                    
                } catch (error) {
                    console.warn('Error usando PlacesService, fallback a geocodificación:', error);
                    // Fallback a geocodificación si PlacesService falla
                    const geocoder = new google.maps.Geocoder();
                    const geocodeResult = await geocoder.geocode({ 
                        address: destinationInput.value, 
                        componentRestrictions: { country: 'uy' } 
                    });
                    
                    if (geocodeResult.results && geocodeResult.results.length > 0 && 
                        geocodeResult.results[0].geometry && geocodeResult.results[0].geometry.location) {
                        destinationLocation = {
                            lat: geocodeResult.results[0].geometry.location.lat(),
                            lng: geocodeResult.results[0].geometry.location.lng(),
                        };
                    } else {
                        throw new Error('No se pudo encontrar la dirección ingresada. Por favor, selecciónala de la lista.');
                    }
                }
            } else {
                // Fallback a geocodificación si no se usó autocompletado
                const geocoder = new google.maps.Geocoder();
                const geocodeResult = await geocoder.geocode({ address: destinationInput.value, componentRestrictions: { country: 'uy' } });
                
                // SALVAGUARDA: Asegurarse de que el resultado del geocoder es válido
                if (geocodeResult.results && geocodeResult.results.length > 0 && geocodeResult.results[0].geometry && geocodeResult.results[0].geometry.location) {
                    destinationLocation = {
                        lat: geocodeResult.results[0].geometry.location.lat(),
                        lng: geocodeResult.results[0].geometry.location.lng(),
                    };
                } else {
                    throw new Error('No se pudo encontrar la dirección ingresada. Por favor, selecciónala de la lista.');
                }
            }
            
            // Calcular distancia con fallback
            let distance;
            try {
                if (google.maps.geometry && google.maps.geometry.spherical) {
                    distance = google.maps.geometry.spherical.computeDistanceBetween(
                        new google.maps.LatLng(userLocation),
                        new google.maps.LatLng(destinationLocation)
                    ) / 1000; // en km
                } else {
                    // Fallback: cálculo manual usando la fórmula de Haversine
                    const R = 6371; // Radio de la Tierra en km
                    const dLat = (destinationLocation.lat - userLocation.lat) * Math.PI / 180;
                    const dLon = (destinationLocation.lng - userLocation.lng) * Math.PI / 180;
                    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                             Math.cos(userLocation.lat * Math.PI / 180) * Math.cos(destinationLocation.lat * Math.PI / 180) *
                             Math.sin(dLon/2) * Math.sin(dLon/2);
                    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                    distance = R * c;
                }
                console.log('Distancia calculada:', distance, 'km');
            } catch (error) {
                console.error('Error calculando distancia:', error);
                // Distancia por defecto si falla el cálculo
                distance = 5.0;
            }

            const fare = calculateFare(distance);
            console.log('Tarifa calculada:', fare);

            const docRef = await addDoc(collection(db, "tripRequests"), {
                userId: currentUser.uid,
                userName: currentUser.displayName,
                userPhoto: currentUser.photoURL,
                origin: "Mi ubicación actual",
                destination: destinationInput.value,
                originCoords: userLocation,
                destinationCoords: destinationLocation,
                status: 'pending',
                createdAt: serverTimestamp(),
                estimatedDistance: distance,
                estimatedFare: fare,
                recaptchaToken: recaptchaToken
            });
            
            currentTripRequestId = docRef.id;
            requestPanel.style.display = 'none';
            // Show searching screen instead of trip panel
            showTripStatusScreen('searching');
            listenToTripRequestUpdates(currentTripRequestId);
            
            // Guardar estado del viaje
            saveTripState();
            
        } catch (e) { 
            console.error("Error requesting trip: ", e);
            showNotificationToast(e.message || 'Error al solicitar viaje.', 'error');
        }
    });
}

// --- Trip Lifecycle & Updates ---

// PASO 1: Escuchar la SOLICITUD de viaje.
function listenToTripRequestUpdates(requestId) {
    console.log("Listening to trip request updates for request ID:", requestId);
    const requestRef = doc(db, "tripRequests", requestId);
    tripRequestListener = onSnapshot(requestRef, (docSnap) => {
        if (!docSnap.exists()) { console.log("Trip request document does not exist."); return; }
        const request = docSnap.data();
        
        if (request.status === 'in_progress' && !navigationMode) {
            // Show taxi arrived screen
            showTripStatusScreen('arrived');
            activateNavigationMode();
            showNotificationToast('¡El viaje ha comenzado!');
        }
        else if (request.driverEnRoute && !request.driverArrived) {
            // Driver is on the way to client
            showNotificationToast('Tu conductor está en camino hacia ti');
        }
        else if (request.driverArrived && !request.tripStarted) {
            // Driver has arrived at client
            showNotificationToast('¡Tu conductor ha llegado!');
        }
        else if (request.tripStarted) {
            // Trip has started - both in navigation mode
            if (!navigationMode) {
                activateNavigationMode();
            }
            showNotificationToast('¡El viaje ha comenzado!');
        }
        else if (request.status === 'completed') {
            setTimeout(() => showRatingModal(), 1500);
        }
        else if (request.status === 'cancelled') {
            setTimeout(() => resetTripState(), 3000);
        }
        else if (request.status === 'accepted') {
            // Show driver enroute screen
            showTripStatusScreen('enroute');
            handleTripAccepted(request);
        }
        else if (request.status === 'expired') {
            handleTripExpired();
        }
        
        if (request.driverLocation) {
            updateDriverMarker(request.driverLocation);
        }
    });
}

async function handleTripAccepted(request) {
    try {
        console.log('Trip accepted, fetching driver data for:', request.driverId);
        const driverRef = doc(db, "drivers", request.driverId);
        const driverDoc = await getDoc(driverRef);
        
        if (driverDoc.exists()) {
            const driverData = driverDoc.data();
            console.log('Driver data retrieved:', driverData);
            // Update enroute screen with driver data
            updateEnrouteScreen(driverData, request);
            showPaymentConfirmationModal(request, driverData);
        } else {
            console.error('Driver document does not exist for ID:', request.driverId);
            // Mostrar modal con datos mínimos si no se encuentra el conductor
            showPaymentConfirmationModal(request, {
                name: 'Conductor',
                photoURL: '../default-avatar.svg',
                totalStars: 0,
                numTrips: 0,
                vehicle: null
            });
        }
    } catch (error) {
        console.error('Error fetching driver data:', error);
        // Mostrar modal con datos mínimos en caso de error
        showPaymentConfirmationModal(request, {
            name: 'Conductor',
            photoURL: '../default-avatar.svg',
            totalStars: 0,
            numTrips: 0,
            vehicle: null
        });
    }
}

function showPaymentConfirmationModal(request, driverData) {
    console.log('Showing payment confirmation modal with request:', request);
    console.log('Driver data:', driverData);
    
    const modal = document.getElementById('payment-confirmation-modal');
    
    // Mostrar información del viaje
    const distanceElement = document.getElementById('trip-distance');
    const durationElement = document.getElementById('trip-duration');
    const fareElement = document.getElementById('trip-fare');
    
    // Verificar y mostrar valores con logs detallados
    const distance = request.estimatedDistance || 0;
    const fare = request.estimatedFare || 0;
    const duration = Math.round(distance * 2); // 2 minutos por km como estimación
    
    console.log('Valores del viaje - Distance:', distance, 'Fare:', fare, 'Duration:', duration);
    console.log('Elementos del DOM - Distance element:', distanceElement, 'Duration element:', durationElement, 'Fare element:', fareElement);
    
    if (distanceElement) {
        distanceElement.textContent = `${distance.toFixed(1)} km`;
        console.log('Distancia establecida en DOM:', distanceElement.textContent);
    }
    if (durationElement) {
        durationElement.textContent = `${duration} min`;
        console.log('Duración establecida en DOM:', durationElement.textContent);
    }
    if (fareElement) {
        fareElement.textContent = `$${fare.toFixed(2)}`;
        console.log('Tarifa establecida en DOM:', fareElement.textContent);
    }
    
    // Mostrar información del conductor
    const driverPhotoElement = document.getElementById('driver-photo');
    const driverNameElement = document.getElementById('driver-name');
    
    if (driverPhotoElement) driverPhotoElement.src = driverData.photoURL || '../default-avatar.svg';
    if (driverNameElement) driverNameElement.textContent = driverData.name || 'Conductor';
    
    // Calcular rating y viajes del conductor
    const totalStars = driverData.totalStars || 0;
    const numTrips = driverData.numTrips || 0;
    const avgRating = numTrips > 0 ? (totalStars / numTrips).toFixed(1) : '0.0';
    
    console.log('Driver stats - Total stars:', totalStars, 'Num trips:', numTrips, 'Avg rating:', avgRating);
    
    // Mostrar estrellas
    const fullStars = Math.floor(avgRating);
    const hasHalfStar = avgRating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    let starsHTML = '';
    for (let i = 0; i < fullStars; i++) starsHTML += '★';
    if (hasHalfStar) starsHTML += '☆';
    for (let i = 0; i < emptyStars; i++) starsHTML += '☆';
    
    const driverStarsElement = document.getElementById('driver-stars');
    const driverRatingTextElement = document.getElementById('driver-rating-text');
    
    if (driverStarsElement) driverStarsElement.textContent = starsHTML;
    if (driverRatingTextElement) driverRatingTextElement.textContent = `${avgRating} (${numTrips} viaje${numTrips !== 1 ? 's' : ''})`;
    
    // Mostrar información del vehículo
    const vehicleInfoElement = document.getElementById('vehicle-info');
    const vehiclePlateElement = document.getElementById('vehicle-plate');
    
    if (driverData.vehicle) {
        if (vehicleInfoElement) vehicleInfoElement.textContent = `${driverData.vehicle.make} ${driverData.vehicle.model} - ${driverData.vehicle.color}`;
        if (vehiclePlateElement) vehiclePlateElement.textContent = driverData.vehicle.plate;
    } else {
        if (vehicleInfoElement) vehicleInfoElement.textContent = 'Información del vehículo no disponible';
        if (vehiclePlateElement) vehiclePlateElement.textContent = '';
    }
    
    // Configurar botones
    const confirmBtn = document.getElementById('confirm-trip-btn');
    const rejectBtn = document.getElementById('reject-trip-btn');
    const closeBtn = document.getElementById('close-payment-modal');
    
    if (confirmBtn) confirmBtn.onclick = () => confirmTripPayment(request);
    if (rejectBtn) rejectBtn.onclick = () => rejectTrip(request);
    if (closeBtn) closeBtn.onclick = () => rejectTrip(request);
    
    modal.style.display = 'flex';
    console.log('Payment confirmation modal displayed');
}

// PASO 2: Confirmar el pago y crear el VIAJE real.
async function confirmTripPayment(request) {
    try {
        const paymentMethod = document.querySelector('input[name="payment-method"]:checked').value;
        const tripData = {
            userId: request.userId, userName: request.userName, userPhoto: request.userPhoto,
            driverId: request.driverId, driverName: request.driverInfo?.name || 'Conductor', driverPhoto: request.driverInfo?.photoURL || '../default-avatar.svg',
            origin: request.origin, destination: request.destination, originCoords: request.originCoords, destinationCoords: request.destinationCoords,
            status: 'accepted', createdAt: serverTimestamp(), estimatedDistance: request.estimatedDistance, estimatedFare: request.estimatedFare,
            paymentMethod: paymentMethod, tripRequestId: currentTripRequestId
        };
        const tripRef = await addDoc(collection(db, "trips"), tripData);
        currentTripId = tripRef.id;
        await updateDoc(doc(db, "tripRequests", currentTripRequestId), { status: 'payment_confirmed', tripId: tripRef.id, paymentMethod: paymentMethod, paymentConfirmedAt: serverTimestamp() });
        document.getElementById('payment-confirmation-modal').style.display = 'none';
        tripPanel.style.display = 'block';
        
        showNotificationToast('Pago confirmado. Tu conductor está en camino.');

        // Detener el listener de la solicitud, ya no es necesario
        if (tripRequestListener) {
            tripRequestListener(); // Llama a la función de desuscripción de onSnapshot
            tripRequestListener = null;
            console.log("Listener de la solicitud de viaje detenido.");
        }

        // Iniciar el listener para el VIAJE real
        listenToTripUpdates(currentTripId);
        
        // Guardar estado del viaje
        saveTripState();

    } catch (error) {
        console.error("Error confirming trip payment:", error);
        alert('Error al confirmar el pago. Por favor, intenta nuevamente.');
    }
}

async function rejectTrip(request) {
    try {
        await updateDoc(doc(db, "tripRequests", currentTripRequestId), { status: 'rejected', rejectedAt: serverTimestamp(), rejectedBy: 'user' });
        document.getElementById('payment-confirmation-modal').style.display = 'none';
        resetTripState();
    } catch (error) {
        console.error("Error rejecting trip:", error);
        alert('Error al rechazar el viaje. Por favor, intenta nuevamente.');
    }
}

function handleTripCancelled() { resetTripState(); alert('El viaje ha sido cancelado.'); }
function handleTripExpired() { resetTripState(); alert('La solicitud de viaje ha expirado. Por favor, intenta nuevamente.'); }

// PASO 4: Escuchar el VIAJE real.
function listenToTripUpdates(tripId) {
    console.log("Listening to trip updates for trip ID:", tripId);
    const tripRef = doc(db, "trips", tripId);
    tripListener = onSnapshot(tripRef, (docSnap) => {
        if (!docSnap.exists()) { resetTripState(); return; }
        const trip = docSnap.data();
        currentTripDriverId = trip.driverId;
        updateTripUI(trip);
        if (trip.routePolyline) { drawRoute(trip.routePolyline); }
        if (trip.driverLocation) { updateDriverMarker(trip.driverLocation); }
        if (trip.driverInfo && !hasShownDriverInfo) { displayDriverInfo(trip.driverInfo); }
        
        if (trip.status === 'completed' && !trip.rating) { 
            setTimeout(() => showRatingModal(), 1500); 
        }
        else if (trip.status === 'cancelled') { 
            setTimeout(() => resetTripState(), 3000); 
        }
        else if (trip.status === 'accepted') {
            if (!hasShownDriverInfo) {
                playNotificationSound();
                showNotificationToast('¡Tu viaje ha sido aceptado!');
            } else {
                showNotificationToast('Pago confirmado. Tu conductor está en camino.');
            }
            if (trip.routePolyline) {
                setTimeout(() => drawRoute(trip.routePolyline), 500);
            }
        }
        else if (trip.status === 'payment_confirmed') {
            showNotificationToast('Pago confirmado. Tu conductor está en camino.');
            updateTripUI(trip);
        }
        else if (trip.status === 'in_progress' && !navigationMode) {
            activateNavigationMode();
        }
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
    updatePaymentModalDriverInfo(info);
    showDriverCard(info);
}

function getStatusInfo(status) {
    switch (status) {
        case 'pending': return { statusText: 'Buscando conductor', details: 'Tu solicitud está siendo procesada.' };
        case 'accepted': return { statusText: 'Tu conductor está en camino', details: '' };
        case 'payment_confirmed': return { statusText: 'Pago confirmado', details: 'Tu conductor está en camino.' };
        case 'in_progress': return { statusText: 'Viaje en curso', details: 'Disfruta tu viaje.' };
        case 'completed': return { statusText: 'Viaje completado', details: 'Gracias por viajar con nosotros.' };
        case 'cancelled': return { statusText: 'Viaje cancelado', details: 'Tu viaje ha sido cancelado.' };
        default: return { statusText: 'Actualizando...', details: '' };
    }
}

function drawRoute(polylineString) {
    if (tripRoutePolyline) tripRoutePolyline.setMap(null);
    if (!polylineString || typeof polylineString !== 'string') return;
    try {
    const decodedPath = google.maps.geometry.encoding.decodePath(polylineString);
        if (decodedPath.length === 0) return;
        tripRoutePolyline = new google.maps.Polyline({ path: decodedPath, strokeColor: '#4285F4', strokeWeight: 6, map: map });
        const bounds = new google.maps.LatLngBounds();
        decodedPath.forEach(point => bounds.extend(point));
        map.fitBounds(bounds, 80);
    } catch (error) {
        console.error("Error drawing route:", error);
    }
}

function updateDriverMarker(location) {
    if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
        console.warn("Ubicación de conductor inválida recibida. Omitiendo actualización de marcador.", location);
        return;
    }
    const pos = new google.maps.LatLng(location.lat, location.lng);
    if (!driverMarker) {
        driverMarker = createCustomMarker(pos, map, 'Tu Conductor', '#34a853', '🚗');
    } else { 
        updateMarkerPosition(driverMarker, pos);
    }
    updateMapBounds();
}

function updateMapBounds() {
    if (!userMarker || !driverMarker) return;
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(getMarkerPosition(userMarker));
    bounds.extend(getMarkerPosition(driverMarker));
    map.fitBounds(bounds, 60);
}

function resetTripState() {
    if (tripListener) { tripListener(); tripListener = null; }
    if (tripRequestListener) { tripRequestListener(); tripRequestListener = null; }
    
    // Hide all trip status screens
    hideAllTripScreens();
    
    tripPanel.style.display = 'none';
    requestPanel.style.display = 'block';
    tripInfoContainer.style.display = 'block';
    driverDetailsContainer.style.display = 'none';
    if (driverMarker) driverMarker.setMap(null);
    if (tripRoutePolyline) tripRoutePolyline.setMap(null);
    driverMarker = null; tripRoutePolyline = null; currentTripId = null; currentTripRequestId = null; currentTripDriverId = null; hasShownDriverInfo = false;
    deactivateUserNavigationMode();
    closeDriverCard();
    
    // Reset trip status
    currentTripStatus = 'none';
    
    // Limpiar estado persistente
    clearTripState();
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
        if (querySnapshot.empty) {
            historyList.innerHTML = '<p>No has realizado ningún viaje.</p>';
            return;
        }
        querySnapshot.forEach(doc => createHistoryItem(doc.data()));
    } catch (error) {
        console.error("Error getting trip history: ", error);
        historyList.innerHTML = '<p>No se pudo cargar el historial.</p>';
    }
}

function createHistoryItem(trip) {
    const item = document.createElement('div');
    item.className = 'history-item';
    const tripDate = trip.createdAt?.toDate().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }) || 'Fecha desconocida';
    const statusText = getStatusInfo(trip.status).statusText;
    const rating = trip.rating ? `${trip.rating} <i class="fas fa-star" style="color: #ffc107;"></i>` : 'Sin calificar';
    item.innerHTML = `<h4>Viaje del ${tripDate}</h4><p>Estado: <strong class="status status-${trip.status}">${statusText}</strong></p><p>Calificación: ${rating}</p>`;
    historyList.appendChild(item);
}

function hideTripHistory() { historyModal.style.display = 'none'; }

// --- Audio Notifications ---
function initializeNotificationSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        notificationSound = createNotificationTone(audioContext);
    } catch (error) {
        notificationSound = new Audio('https://www.soundjay.com/misc/sounds/bell-ringing-05.wav');
    }
}

function createNotificationTone(audioContext) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    return { play: () => { oscillator.start(audioContext.currentTime); oscillator.stop(audioContext.currentTime + 0.3); } };
}

function playNotificationSound() {
    if (notificationSound && soundToggle.checked) {
        try { notificationSound.play(); } catch (error) { console.log("Could not play sound"); }
    }
}

function showNotificationToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `notification-toast notification-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.transform = 'translateX(0)'; }, 100);
    setTimeout(() => { toast.style.transform = 'translateX(100%)'; setTimeout(() => toast.remove(), 300); }, 3000);
}

// --- Navigation Mode Functions for User ---
function activateNavigationMode() {
    navigationMode = true;
    map.setZoom(navigationZoom);
    showUserNavigationIndicator();
    startUserNavigationViewUpdates();
    
    // Guardar estado del viaje
    saveTripState();
}

function showUserNavigationIndicator() {
    const navIndicator = document.createElement('div');
    navIndicator.id = 'user-navigation-indicator';
    navIndicator.innerHTML = `<div class="nav-indicator-content"><i class="fas fa-car"></i><span>Viaje en Curso</span></div>`;
    document.body.appendChild(navIndicator);
}

function startUserNavigationViewUpdates() {
    const navigationInterval = setInterval(() => {
        if (!navigationMode || !currentTripId) { clearInterval(navigationInterval); return; }
        if (userMarker && driverMarker) {
            const bounds = new google.maps.LatLngBounds();
            bounds.extend(getMarkerPosition(userMarker));
            bounds.extend(getMarkerPosition(driverMarker));
            map.fitBounds(bounds, 80);
        }
    }, 5000);
}

function deactivateUserNavigationMode() {
    navigationMode = false;
    map.setZoom(originalZoom);
    const navIndicator = document.getElementById('user-navigation-indicator');
    if (navIndicator) navIndicator.remove();
}

// --- Driver Card Functions ---
async function showDriverCard(driverInfo) {
    cardDriverPic.src = driverInfo.photoURL || 'default-pic.png';
    cardDriverName.textContent = driverInfo.name || 'Conductor';
    if (driverInfo.vehicle) {
        cardVehicleModel.textContent = `${driverInfo.vehicle.make || ''} ${driverInfo.vehicle.model || ''}`.trim() || 'No especificado';
        cardVehicleColor.textContent = driverInfo.vehicle.color || 'No especificado';
        cardVehiclePlate.textContent = driverInfo.vehicle.plate || 'No especificado';
    }
    await loadDriverStats(driverInfo.driverId || currentTripDriverId);
    driverCard.style.display = 'block';
}

async function loadDriverStats(driverId) {
    if (!driverId) return;
    try {
        const driverRef = doc(db, "drivers", driverId);
        const driverDoc = await getDoc(driverRef);
        if (driverDoc.exists()) {
            const data = driverDoc.data();
            const totalStars = data.totalStars || 0;
            const numTrips = data.numTrips || 0;
            if (numTrips > 0) {
                const avgRating = (totalStars / numTrips).toFixed(1);
                cardDriverAvgRating.textContent = avgRating;
                cardDriverTrips.textContent = numTrips;
                cardDriverStars.innerHTML = generateStarsHTML(avgRating);
                cardDriverRatingText.textContent = `(${numTrips} viaje${numTrips > 1 ? 's' : ''})`;
            } else {
                cardDriverAvgRating.textContent = 'N/A';
                cardDriverTrips.textContent = '0';
                cardDriverStars.innerHTML = '<span style="color: #ccc;">Sin calificaciones</span>';
                cardDriverRatingText.textContent = '(Sin viajes)';
            }
        }
    } catch (error) {
        console.error("Error loading driver stats:", error);
    }
}

function generateStarsHTML(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    let starsHTML = '';
    for (let i = 0; i < fullStars; i++) starsHTML += '<i class="fas fa-star" style="color: #ffc107;"></i>';
    if (hasHalfStar) starsHTML += '<i class="fas fa-star-half-alt" style="color: #ffc107;"></i>';
    for (let i = 0; i < emptyStars; i++) starsHTML += '<i class="far fa-star" style="color: #ccc;"></i>';
    return starsHTML;
}

async function updatePaymentModalDriverInfo(driverInfo) {
    const driverPhoto = document.getElementById('driver-photo');
    const driverName = document.getElementById('driver-name');
    const vehicleInfo = document.getElementById('vehicle-info');
    const vehiclePlate = document.getElementById('vehicle-plate');
    if (driverPhoto) driverPhoto.src = driverInfo.photoURL || '../default-avatar.svg';
    if (driverName) driverName.textContent = driverInfo.name || 'Conductor';
    if (driverInfo.vehicle) {
        if (vehicleInfo) vehicleInfo.textContent = `${driverInfo.vehicle.make || ''} ${driverInfo.vehicle.model || ''} - ${driverInfo.vehicle.color || ''}`.trim();
        if (vehiclePlate) vehiclePlate.textContent = driverInfo.vehicle.plate || '';
    } 
}

function minimizeDriverCard() {
    driverCard.classList.add('minimized');
    minimizeCardBtn.innerHTML = '<i class="fas fa-chevron-up"></i> Expandir';
    minimizeCardBtn.onclick = expandDriverCard;
}

function expandDriverCard() {
    driverCard.classList.remove('minimized');
    minimizeCardBtn.innerHTML = '<i class="fas fa-chevron-down"></i> Minimizar';
    minimizeCardBtn.onclick = minimizeDriverCard;
}

function closeDriverCard() {
    driverCard.style.display = 'none';
    driverCard.classList.remove('minimized');
}

// --- Profile Modal Functions ---
function showProfileModal() {
    if (!currentUser) return;
    profilePicDisplay.src = currentUser.photoURL || 'default-pic.png';
    profileNameDisplay.textContent = currentUser.displayName || 'Usuario';
    profileModal.style.display = 'flex';
    closeSideNav();
}

function hideProfileModal() {
    profileModal.style.display = 'none';
}

// --- Notification Functions ---
function showNotifications() {
    playNotificationSound();
    const notificationModal = document.createElement('div');
    notificationModal.className = 'overlay-container';
    notificationModal.style.display = 'flex';
    notificationModal.innerHTML = `<div class="modal-box"><h2>Notificaciones</h2><p>No tienes notificaciones nuevas.</p><button onclick="this.closest('.overlay-container').remove()">Cerrar</button></div>`;
    document.body.appendChild(notificationModal);
    closeSideNav();
}

// --- Trip Status Screen Management ---
function showTripStatusScreen(status) {
    // Hide all screens first
    hideAllTripScreens();
    
    // Show the appropriate screen
    switch (status) {
        case 'searching':
            searchingScreen.style.display = 'flex';
            currentTripStatus = 'searching';
            break;
        case 'enroute':
            driverEnrouteScreen.style.display = 'flex';
            currentTripStatus = 'enroute';
            break;
        case 'arrived':
            taxiArrivedScreen.style.display = 'flex';
            currentTripStatus = 'arrived';
            break;
        case 'none':
        default:
            currentTripStatus = 'none';
            break;
    }
}

function hideAllTripScreens() {
    searchingScreen.style.display = 'none';
    driverEnrouteScreen.style.display = 'none';
    taxiArrivedScreen.style.display = 'none';
}

function cancelTripRequest() {
    if (currentTripRequestId) {
        updateDoc(doc(db, "tripRequests", currentTripRequestId), {
            status: 'cancelled',
            cancelledBy: 'user'
        }).then(() => {
            console.log('Trip request cancelled by user');
            hideAllTripScreens();
            requestPanel.style.display = 'block';
            resetTripState();
        }).catch(error => {
            console.error('Error cancelling trip request:', error);
        });
    }
}

function updateEnrouteScreen(driverData, tripData) {
    if (enrouteDriverPic && driverData.photoURL) {
        enrouteDriverPic.src = driverData.photoURL;
    } else if (enrouteDriverPic) {
        enrouteDriverPic.src = 'https://maps.google.com/mapfiles/kml/shapes/auth_maps_pic.png';
    }
    
    if (enrouteDriverName) {
        enrouteDriverName.textContent = driverData.name || 'Conductor';
    }
    
    // Update time and distance if available
    if (enrouteTime && tripData.estimatedDuration) {
        enrouteTime.textContent = `${Math.round(tripData.estimatedDuration)} MIN`;
    }
    
    if (enrouteDistance && tripData.estimatedDistance) {
        enrouteDistance.textContent = `${tripData.estimatedDistance.toFixed(1)} KM`;
    }
}

// --- Helper Functions ---
function createCustomMarker(position, map, title, color = '#4285f4', emoji = '') {
    try {
        if (google.maps.marker && google.maps.marker.AdvancedMarkerElement) {
            const markerElement = document.createElement('div');
            markerElement.innerHTML = `<div style="width: ${emoji ? '24px' : '20px'}; height: ${emoji ? '24px' : '20px'}; background-color: ${color}; border: 2px solid white; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.3); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 12px; color: white; font-weight: bold;">${emoji}</div>`;
            return new google.maps.marker.AdvancedMarkerElement({ position, map, title, content: markerElement });
        } else {
            const iconUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="${color}" stroke="white" stroke-width="2"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="12">${emoji}</text></svg>`)}`;
            return new google.maps.Marker({ position, map, title, icon: { url: iconUrl, scaledSize: new google.maps.Size(24, 24), anchor: new google.maps.Point(12, 12) } });
        }
    } catch (error) {
        return new google.maps.Marker({ position, map, title });
    }
}

function getMarkerPosition(marker) {
    if (!marker) return null;
    if (marker.getPosition) return marker.getPosition();
    if (marker.position) return marker.position;
    return null;
}

function updateMarkerPosition(marker, position) {
    if (!marker || !position) return;
    const latLng = position.lat && position.lng ? new google.maps.LatLng(position.lat, position.lng) : position;
    if (marker.setPosition) marker.setPosition(latLng);
    else if (marker.position) marker.position = latLng;
}