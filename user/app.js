
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

// --- App State ---
let map, userMarker, driverMarker, tripRoutePolyline;
let currentUser, currentTripId, currentTripRequestId, currentTripDriverId;
let selectedRating = 0;
let hasShownDriverInfo = false;
let notificationSound; // Audio para notificaciones
let navigationMode = false; // Modo de navegación activo
let userLocation = null;
let destinationLocation = null;
let originalZoom = 15; // Zoom original del mapa
let navigationZoom = 18; // Zoom para navegación

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

loginButton.addEventListener('click', async () => {
    try {
        console.log("Login button clicked.");
        
        // Ejecutar reCAPTCHA antes del login
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
    initializeNotificationSound(); // Initialize audio
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
            userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            initMap(userLocation);
        }, 
        () => {
            console.log("Geolocation failed, using default location.");
            userLocation = { lat: 34.0522, lng: -118.2437 };
            initMap(userLocation);
        });
    } else {
        console.log("Geolocation not available, using default location.");
        userLocation = { lat: 34.0522, lng: -118.2437 };
        initMap(userLocation);
    }
}

// --- Utility Functions ---
function calculateDistance(origin, destination) {
    if (!origin || !destination) return 0;
    
    const R = 6371; // Radio de la Tierra en km
    const lat1 = origin.lat * Math.PI / 180;
    const lat2 = destination.lat * Math.PI / 180;
    const deltaLat = (destination.lat - origin.lat) * Math.PI / 180;
    const deltaLng = (destination.lng - origin.lng) * Math.PI / 180;
    
    const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLng/2) * Math.sin(deltaLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c;
}

function calculateFare(distance) {
    if (!pricingCalculator) {
        // Usar configuración por defecto si no hay calculadora
        const baseFare = 2.00;
        const ratePerKm = 3.50;
        return Math.max(baseFare + (distance * ratePerKm), 5.00);
    }
    
    return pricingCalculator.calculateUserFare(distance);
}

document.addEventListener('map-ready', () => {
    console.log("map-ready event received.");
    initializeMap();
});

function initMap(location) {
    console.log("initMap() called with location:", location);
    
    // Verificar que el elemento del mapa existe
    const mapElement = document.getElementById('map');
    if (!mapElement) {
        console.error('Elemento del mapa no encontrado. Verificando si el DOM está listo...');
        // Intentar de nuevo después de un breve delay
        setTimeout(() => {
            const retryMapElement = document.getElementById('map');
            if (retryMapElement) {
                console.log('Elemento del mapa encontrado en reintento');
                initMap(location);
            } else {
                console.error('Elemento del mapa no encontrado después del reintento');
            }
        }, 100);
        return;
    }
    
    // Verificar que el elemento del mapa tenga dimensiones
    if (mapElement.offsetWidth === 0 || mapElement.offsetHeight === 0) {
        console.warn('Elemento del mapa sin dimensiones, esperando...');
        setTimeout(() => initMap(location), 200);
        return;
    }
    
    try {
        map = new google.maps.Map(mapElement, { 
            center: location, 
            zoom: 15, 
            disableDefaultUI: true,
            mapId: 'user_map' // Agregar un mapId para evitar el warning
        });
        
        // Crear marcador con fallback para compatibilidad
        userMarker = createCustomMarker(location, map, 'Tu ubicación', '#4285f4');
        console.log("Map and user marker initialized successfully.");
        
        // Initialize autocomplete services after map is ready
        initializeAutocompleteServices();
    } catch (error) {
        console.error('Error initializing map:', error);
    }
}

// --- UI Interactions ---
if (menuBtn) menuBtn.addEventListener('click', () => { console.log("Menu button clicked."); openSideNav(); });
if (closeNavBtn) closeNavBtn.addEventListener('click', () => { console.log("Close nav button clicked."); closeSideNav(); });
if (navOverlay) navOverlay.addEventListener('click', () => { console.log("Nav overlay clicked."); closeSideNav(); });
if (showHistoryBtn) showHistoryBtn.addEventListener('click', () => { console.log("Show history button clicked."); showTripHistory(); });
if (closeHistoryBtn) closeHistoryBtn.addEventListener('click', () => { console.log("Close history button clicked."); hideTripHistory(); });

// --- Profile Modal Events ---
if (showProfileBtn) showProfileBtn.addEventListener('click', showProfileModal);
if (closeProfileModalBtn) closeProfileModalBtn.addEventListener('click', hideProfileModal);

// --- Notification Events ---
if (notificationBtn) notificationBtn.addEventListener('click', showNotifications);

// --- Audio Control Events ---
if (soundToggle) soundToggle.addEventListener('change', (e) => {
    const icon = e.target.parentElement.querySelector('i');
    if (e.target.checked) {
        icon.className = 'fas fa-volume-up';
        icon.style.color = '#28a745';
    } else {
        icon.className = 'fas fa-volume-mute';
        icon.style.color = '#999';
    }
});

// --- Autocomplete Functionality ---
let autocompleteService;
let placesService;
let selectedSuggestionIndex = -1;
let suggestions = [];

// Initialize autocomplete services
function initializeAutocompleteServices() {
    if (google && google.maps) {
        autocompleteService = new google.maps.places.AutocompleteService();
        placesService = new google.maps.places.PlacesService(map);
    }
}

// Get destination suggestions
async function getDestinationSuggestions(query) {
    if (!autocompleteService || !query.trim()) {
        hideSuggestions();
        return;
    }

    try {
        const request = {
            input: query,
            componentRestrictions: { country: 'uy' }, // Uruguay
            types: ['establishment', 'geocode']
        };

        const results = await new Promise((resolve, reject) => {
            autocompleteService.getPlacePredictions(request, (predictions, status) => {
                if (status === google.maps.places.PlacesServiceStatus.OK) {
                    resolve(predictions);
                } else {
                    resolve([]);
                }
            });
        });

        suggestions = results.slice(0, 5); // Limit to 5 suggestions
        showSuggestions(suggestions);
    } catch (error) {
        console.error('Error getting suggestions:', error);
        hideSuggestions();
    }
}

// Show suggestions
function showSuggestions(suggestions) {
    const suggestionsContainer = document.getElementById('destination-suggestions');
    if (!suggestionsContainer) return;

    if (suggestions.length === 0) {
        hideSuggestions();
        return;
    }

    suggestionsContainer.innerHTML = '';
    selectedSuggestionIndex = -1;

    suggestions.forEach((suggestion, index) => {
        const suggestionItem = document.createElement('div');
        suggestionItem.className = 'suggestion-item';
        suggestionItem.innerHTML = `
            <i class="fas fa-map-marker-alt suggestion-icon"></i>
            <div class="suggestion-text">
                <div>${suggestion.structured_formatting.main_text}</div>
                <div class="suggestion-secondary">${suggestion.structured_formatting.secondary_text}</div>
            </div>
        `;
        
        suggestionItem.addEventListener('click', () => {
            selectSuggestion(suggestion);
        });

        suggestionItem.addEventListener('mouseenter', () => {
            selectedSuggestionIndex = index;
            updateSelectedSuggestion();
        });

        suggestionsContainer.appendChild(suggestionItem);
    });

    suggestionsContainer.style.display = 'block';
}

// Hide suggestions
function hideSuggestions() {
    const suggestionsContainer = document.getElementById('destination-suggestions');
    if (suggestionsContainer) {
        suggestionsContainer.style.display = 'none';
    }
    selectedSuggestionIndex = -1;
    suggestions = [];
}

// Select a suggestion
function selectSuggestion(suggestion) {
    const destinationInput = document.getElementById('destination-input');
    if (destinationInput) {
        destinationInput.value = suggestion.description;
        destinationInput.dataset.placeId = suggestion.place_id;
    }
    hideSuggestions();
}

// Update selected suggestion visual
function updateSelectedSuggestion() {
    const suggestionItems = document.querySelectorAll('.suggestion-item');
    suggestionItems.forEach((item, index) => {
        if (index === selectedSuggestionIndex) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
}

// --- Driver Card Events ---
if (minimizeCardBtn) minimizeCardBtn.addEventListener('click', minimizeDriverCard);
if (driverCardClose) driverCardClose.addEventListener('click', closeDriverCard);

function openSideNav() { console.log("Opening side nav."); sideNav.style.width = "280px"; navOverlay.style.display = "block"; }
function closeSideNav() { console.log("Closing side nav."); sideNav.style.width = "0"; navOverlay.style.display = "none"; }

// --- Autocomplete Event Listeners ---
const destinationInput = document.getElementById('destination-input');
if (destinationInput) {
    let debounceTimer;
    
    destinationInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            getDestinationSuggestions(e.target.value);
        }, 300); // Debounce for 300ms
    });

    destinationInput.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedSuggestionIndex = Math.min(selectedSuggestionIndex + 1, suggestions.length - 1);
            updateSelectedSuggestion();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, -1);
            updateSelectedSuggestion();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedSuggestionIndex >= 0 && suggestions[selectedSuggestionIndex]) {
                selectSuggestion(suggestions[selectedSuggestionIndex]);
            }
        } else if (e.key === 'Escape') {
            hideSuggestions();
        }
    });

    // Hide suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (!destinationInput.contains(e.target) && !e.target.closest('.suggestions-container')) {
            hideSuggestions();
        }
    });
}

// --- Ride Request ---
if (requestDriverButton) {
    requestDriverButton.addEventListener('click', async () => {
    console.log("Request driver button clicked.");
    if (!currentUser || !map) { console.log("User or map not ready."); return; }
    
    // Validar que se haya ingresado destino (el origen es automáticamente la ubicación del usuario)
    const destinationInput = document.getElementById('destination-input');
    
    // Verificar que el elemento existe
    if (!destinationInput) {
        console.error('Elemento de destino no encontrado');
        alert('Error: No se encontró el campo de destino');
        return;
    }
    
    if (!destinationInput.value.trim()) {
        alert('Por favor ingresa el destino');
        return;
    }
    
    try {
        // Ejecutar reCAPTCHA antes de la solicitud
        const recaptchaToken = await UIUtils.executeRecaptcha('trip_request');
        
        if (!recaptchaToken) {
            alert('Error de verificación de seguridad. Por favor, intenta nuevamente.');
            return;
        }

        const userLocation = { lat: map.getCenter().lat(), lng: map.getCenter().lng() };
        
        // Obtener coordenadas del destino usando Place ID si está disponible, o geocodificación
        let destinationLocation;
        
        if (destinationInput.dataset.placeId) {
            // Usar Place ID para obtener coordenadas precisas
            const placeResult = await new Promise((resolve, reject) => {
                placesService.getDetails({
                    placeId: destinationInput.dataset.placeId,
                    fields: ['geometry']
                }, (place, status) => {
                    if (status === google.maps.places.PlacesServiceStatus.OK && place.geometry) {
                        resolve(place.geometry.location);
                    } else {
                        reject(new Error('No se pudo obtener los detalles del lugar'));
                    }
                });
            });
            destinationLocation = { 
                lat: placeResult.lat(), 
                lng: placeResult.lng() 
            };
        } else {
            // Fallback a geocodificación tradicional
            const geocoder = new google.maps.Geocoder();
            const destinationResult = await new Promise((resolve, reject) => {
                geocoder.geocode({ address: destinationInput.value }, (results, status) => {
                    if (status === 'OK' && results[0]) {
                        resolve(results[0].geometry.location);
                    } else {
                        reject(new Error('No se pudo geocodificar el destino. Por favor, selecciona una dirección de la lista de sugerencias.'));
                    }
                });
            });
            destinationLocation = { 
                lat: destinationResult.lat(), 
                lng: destinationResult.lng() 
            };
        }
        
        const distance = calculateDistance(userLocation, destinationLocation);
        const fare = calculateFare(distance);

        console.log("Adding trip request to Firestore.");
        const docRef = await addDoc(collection(db, "tripRequests"), {
            userId: currentUser.uid,
            userName: currentUser.displayName,
            userPhoto: currentUser.photoURL,
            origin: "Mi ubicación actual", // El origen siempre es la ubicación del usuario
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
        console.log("Trip request created with ID:", currentTripRequestId);
        requestPanel.style.display = 'none';
        tripPanel.style.display = 'block';
        listenToTripRequestUpdates(currentTripRequestId);
        
    } catch (e) { 
        console.error("Error requesting trip: ", e);
        alert('Error al solicitar viaje. Por favor, intenta nuevamente.');
    }
    });
}

// Escuchar actualizaciones de solicitudes de viaje
function listenToTripRequestUpdates(requestId) {
    console.log("Listening to trip request updates for ID:", requestId);
    const requestRef = doc(db, "tripRequests", requestId);
    
    onSnapshot(requestRef, (docSnap) => {
        console.log("Trip request update received.");
        if (!docSnap.exists()) { 
            console.log("Trip request document does not exist."); 
            resetTripState(); 
            return; 
        }
        
        const request = docSnap.data();
        console.log("Trip request data:", request);
        
        switch (request.status) {
            case 'accepted':
                handleTripAccepted(request);
                break;
            case 'cancelled':
                handleTripCancelled();
                break;
            case 'expired':
                handleTripExpired();
                break;
            default:
                updateTripRequestUI(request);
        }
    });
}

// Manejar cuando un conductor acepta el viaje
async function handleTripAccepted(request) {
    console.log("Trip accepted by driver:", request.driverId);
    
    // Obtener información del conductor
    const driverRef = doc(db, "drivers", request.driverId);
    const driverDoc = await getDoc(driverRef);
    
    if (driverDoc.exists()) {
        const driverData = driverDoc.data();
        
        // Mostrar modal de confirmación de pago
        showPaymentConfirmationModal(request, driverData);
    }
}

// Mostrar modal de confirmación de pago
function showPaymentConfirmationModal(request, driverData) {
    const modal = document.getElementById('payment-confirmation-modal');
    
    // Actualizar información del viaje
    document.getElementById('trip-distance').textContent = `${request.estimatedDistance.toFixed(1)} km`;
    document.getElementById('trip-duration').textContent = `${Math.round(request.estimatedDistance * 2)} min`;
    document.getElementById('trip-fare').textContent = `$${request.estimatedFare.toFixed(2)}`;
    
    // Actualizar información del conductor
    document.getElementById('driver-photo').src = driverData.photoURL || '../default-avatar.svg';
    document.getElementById('driver-name').textContent = driverData.name || 'Conductor';
    
    // Calcular estrellas
    const rating = driverData.rating || 0;
    const stars = '★'.repeat(Math.floor(rating)) + '☆'.repeat(5 - Math.floor(rating));
    document.getElementById('driver-stars').textContent = stars;
    document.getElementById('driver-rating-text').textContent = `${rating.toFixed(1)} (${driverData.totalTrips || 0} viajes)`;
    
    // Información del vehículo
    if (driverData.vehicle) {
        document.getElementById('vehicle-info').textContent = `${driverData.vehicle.make} ${driverData.vehicle.model} - ${driverData.vehicle.color}`;
        document.getElementById('vehicle-plate').textContent = driverData.vehicle.plate;
    }
    
    // Event listeners para los botones
    document.getElementById('confirm-trip-btn').onclick = () => confirmTripPayment(request);
    document.getElementById('reject-trip-btn').onclick = () => rejectTrip(request);
    document.getElementById('close-payment-modal').onclick = () => rejectTrip(request);
    
    modal.style.display = 'flex';
}

// Confirmar pago y crear viaje
async function confirmTripPayment(request) {
    try {
        const paymentMethod = document.querySelector('input[name="payment-method"]:checked').value;
        
        // Crear el viaje real
        const tripData = {
            userId: request.userId,
            userName: request.userName,
            userPhoto: request.userPhoto,
            driverId: request.driverId,
            driverName: request.driverInfo?.name || 'Conductor',
            driverPhoto: request.driverInfo?.photoURL || '../default-avatar.svg',
            origin: request.origin,
            destination: request.destination,
            originCoords: request.originCoords,
            destinationCoords: request.destinationCoords,
            status: 'accepted', // Cambiar a 'accepted' para que el conductor sepa que el pago está confirmado
            createdAt: serverTimestamp(),
            estimatedDistance: request.estimatedDistance,
            estimatedFare: request.estimatedFare,
            paymentMethod: paymentMethod,
            requestId: currentTripRequestId
        };
        
        const tripRef = await addDoc(collection(db, "trips"), tripData);
        currentTripId = tripRef.id;
        
        // Actualizar la solicitud para notificar al conductor
        await updateDoc(doc(db, "tripRequests", currentTripRequestId), {
            status: 'payment_confirmed',
            tripId: tripRef.id,
            paymentMethod: paymentMethod,
            paymentConfirmedAt: serverTimestamp()
        });
        
        // Cerrar modal y mostrar información del viaje
        document.getElementById('payment-confirmation-modal').style.display = 'none';
        tripPanel.style.display = 'block';
        
        // Mostrar notificación de éxito
        showNotificationToast('Pago confirmado. Tu conductor está en camino.');
        
        // Escuchar actualizaciones del viaje
        listenToTripUpdates(currentTripId);
        
        console.log("Trip payment confirmed and trip created:", tripRef.id);
        
    } catch (error) {
        console.error("Error confirming trip payment:", error);
        alert('Error al confirmar el pago. Por favor, intenta nuevamente.');
    }
}

// Rechazar viaje
async function rejectTrip(request) {
    try {
        await updateDoc(doc(db, "tripRequests", currentTripRequestId), {
            status: 'rejected',
            rejectedAt: serverTimestamp(),
            rejectedBy: 'user'
        });
        
        document.getElementById('payment-confirmation-modal').style.display = 'none';
        resetTripState();
        
        console.log("Trip rejected by user");
        
    } catch (error) {
        console.error("Error rejecting trip:", error);
        alert('Error al rechazar el viaje. Por favor, intenta nuevamente.');
    }
}

// Manejar viaje cancelado
function handleTripCancelled() {
    console.log("Trip cancelled");
    resetTripState();
    alert('El viaje ha sido cancelado.');
}

// Manejar viaje expirado
function handleTripExpired() {
    console.log("Trip expired");
    resetTripState();
    alert('La solicitud de viaje ha expirado. Por favor, intenta nuevamente.');
}

// Actualizar UI de solicitud de viaje
function updateTripRequestUI(request) {
    const statusText = getTripRequestStatusInfo(request.status).statusText;
    const details = getTripRequestStatusInfo(request.status).details;
    
    tripStatusHeading.textContent = statusText;
    tripStatusDetails.textContent = details;
}

// Información de estados de solicitud de viaje
function getTripRequestStatusInfo(status) {
    switch (status) {
        case 'pending': 
            return { statusText: 'Buscando conductor', details: 'Tu solicitud está siendo procesada.' };
        case 'accepted': 
            return { statusText: 'Conductor encontrado', details: 'Esperando confirmación de pago.' };
        case 'payment_confirmed': 
            return { statusText: 'Pago confirmado', details: 'Tu conductor está en camino.' };
        case 'cancelled': 
            return { statusText: 'Solicitud cancelada', details: 'La solicitud ha sido cancelada.' };
        case 'expired': 
            return { statusText: 'Solicitud expirada', details: 'La solicitud ha expirado.' };
        case 'rejected': 
            return { statusText: 'Solicitud rechazada', details: 'La solicitud ha sido rechazada.' };
        default: 
            return { statusText: 'Actualizando...', details: '' };
    }
}

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
        
        // Manejar la ruta cuando el conductor la acepta
        if (trip.routePolyline) { 
            console.log("Route polyline received, drawing route.");
            drawRoute(trip.routePolyline); 
        }
        
        if (trip.driverLocation) { console.log("Updating driver marker."); updateDriverMarker(trip.driverLocation); }
        if (trip.driverInfo && !hasShownDriverInfo) { console.log("Displaying driver info."); displayDriverInfo(trip.driverInfo); }
        
        // Manejar diferentes estados del viaje
        if (trip.status === 'completed' && !trip.rating) { 
            console.log("Trip completed, showing rating modal."); 
            setTimeout(() => showRatingModal(), 1500); 
        }
        else if (trip.status === 'cancelled') { 
            console.log("Trip cancelled, resetting state."); 
            setTimeout(() => resetTripState(), 3000); 
        }
        else if (trip.status === 'accepted' && !hasShownDriverInfo) {
            console.log("Trip accepted, playing notification sound.");
            playNotificationSound();
            showNotificationToast('¡Tu viaje ha sido aceptado!');
            
            // Si hay ruta disponible, dibujarla inmediatamente
            if (trip.routePolyline) {
                console.log("Drawing route immediately after acceptance.");
                setTimeout(() => drawRoute(trip.routePolyline), 500);
            }
        }
        else if (trip.status === 'payment_confirmed') {
            console.log("Payment confirmed, updating UI.");
            showNotificationToast('Pago confirmado. Tu conductor está en camino.');
            updateTripUI(trip);
        }
        else if (trip.status === 'in_progress' && !navigationMode) {
            console.log("Trip started, activating navigation mode.");
            activateNavigationMode();
        }
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
    
    // Mostrar la card completa del conductor
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
    console.log("drawRoute called with polyline:", polylineString);
    
    try {
        // Limpiar ruta anterior si existe
        if (tripRoutePolyline) {
            tripRoutePolyline.setMap(null);
            tripRoutePolyline = null;
        }
        
        // Verificar que el polyline string sea válido
        if (!polylineString || typeof polylineString !== 'string') {
            console.error("Invalid polyline string:", polylineString);
            return;
        }
        
        // Decodificar el polyline
        const decodedPath = google.maps.geometry.encoding.decodePath(polylineString);
        console.log("Decoded path points:", decodedPath.length);
        
        if (decodedPath.length === 0) {
            console.error("Decoded path is empty");
            return;
        }
        
        // Crear la polyline
        tripRoutePolyline = new google.maps.Polyline({
            path: decodedPath,
            strokeColor: '#4285F4',
            strokeWeight: 6,
            strokeOpacity: 0.8,
            map: map
        });
        
        console.log("Route drawn successfully");
        
        // Centrar el mapa en la ruta
        const bounds = new google.maps.LatLngBounds();
        decodedPath.forEach(point => bounds.extend(point));
        map.fitBounds(bounds, 80);
        
    } catch (error) {
        console.error("Error drawing route:", error);
    }
}

function updateDriverMarker(location) {
    console.log("updateDriverMarker called with location:", location);
    const pos = new google.maps.LatLng(location.lat, location.lng);
    if (!driverMarker) {
        // Crear marcador con fallback para compatibilidad
        driverMarker = createCustomMarker(pos, map, 'Tu Conductor', '#34a853', '🚗');
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
    
    // Desactivar modo de navegación
    deactivateUserNavigationMode();
    
    // Cerrar la card del conductor
    closeDriverCard();
    
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
        background: #28a745;
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

// --- Navigation Mode Functions for User ---
function activateNavigationMode() {
    navigationMode = true;
    
    // Cambiar zoom del mapa
    map.setZoom(navigationZoom);
    
    // Mostrar indicador de modo navegación
    showUserNavigationIndicator();
    
    // Configurar actualización automática de vista
    startUserNavigationViewUpdates();
}

function showUserNavigationIndicator() {
    // Crear indicador de modo navegación para usuario
    const navIndicator = document.createElement('div');
    navIndicator.id = 'user-navigation-indicator';
    navIndicator.innerHTML = `
        <div class="nav-indicator-content">
            <i class="fas fa-car"></i>
            <span>Viaje en Curso</span>
        </div>
    `;
    navIndicator.style.cssText = `
        position: fixed;
        top: 80px;
        left: 20px;
        background: #007bff;
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

function startUserNavigationViewUpdates() {
    // Actualizar vista de navegación cada 5 segundos
    const navigationInterval = setInterval(() => {
        if (!navigationMode || !currentTripId) {
            clearInterval(navigationInterval);
            return;
        }
        
        // Mantener zoom y centrar en la ruta activa
        if (userMarker && driverMarker) {
            const bounds = new google.maps.LatLngBounds();
            bounds.extend(userMarker.getPosition());
            bounds.extend(driverMarker.getPosition());
            map.fitBounds(bounds, 80);
        }
    }, 5000);
}

function deactivateUserNavigationMode() {
    navigationMode = false;
    
    // Restaurar zoom original
    map.setZoom(originalZoom);
    
    // Remover indicador de navegación
    const navIndicator = document.getElementById('user-navigation-indicator');
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
}

// --- Driver Card Functions ---
async function showDriverCard(driverInfo) {
    console.log("Showing driver card with info:", driverInfo);
    
    // Llenar información básica del conductor
    cardDriverPic.src = driverInfo.photoURL || 'default-pic.png';
    cardDriverName.textContent = driverInfo.name || 'Conductor';
    
    // Llenar información del vehículo
    if (driverInfo.vehicle) {
        cardVehicleModel.textContent = `${driverInfo.vehicle.make || ''} ${driverInfo.vehicle.model || ''}`.trim() || 'No especificado';
        cardVehicleColor.textContent = driverInfo.vehicle.color || 'No especificado';
        cardVehiclePlate.textContent = driverInfo.vehicle.plate || 'No especificado';
    } else {
        cardVehicleModel.textContent = 'No especificado';
        cardVehicleColor.textContent = 'No especificado';
        cardVehiclePlate.textContent = 'No especificado';
    }
    
    // Obtener estadísticas del conductor
    await loadDriverStats(driverInfo.driverId || currentTripDriverId);
    
    // Mostrar la card con opción de cerrar
    driverCard.style.display = 'block';
    
    // Agregar botón de cerrar si no existe
    if (!document.getElementById('driver-card-close-btn')) {
        const closeBtn = document.createElement('button');
        closeBtn.id = 'driver-card-close-btn';
        closeBtn.className = 'driver-card-close-btn';
        closeBtn.innerHTML = '<i class="fas fa-times"></i>';
        closeBtn.onclick = closeDriverCard;
        driverCard.appendChild(closeBtn);
    }
    
    // Animar entrada
    setTimeout(() => {
        driverCard.style.animation = 'slideInFromCenter 0.4s ease';
    }, 100);
}

async function loadDriverStats(driverId) {
    if (!driverId) {
        console.log("No driver ID available for stats");
        return;
    }
    
    try {
        console.log("Loading driver stats for:", driverId);
        const driverRef = doc(db, "drivers", driverId);
        const driverDoc = await getDoc(driverRef);
        
        if (driverDoc.exists()) {
            const data = driverDoc.data();
            const totalStars = data.totalStars || 0;
            const numTrips = data.numTrips || 0;
            
            if (numTrips > 0) {
                const avgRating = (totalStars / numTrips).toFixed(1);
                
                // Actualizar estadísticas
                cardDriverAvgRating.textContent = avgRating;
                cardDriverTrips.textContent = numTrips;
                
                // Mostrar estrellas
                cardDriverStars.innerHTML = generateStarsHTML(avgRating);
                cardDriverRatingText.textContent = `(${numTrips} viaje${numTrips > 1 ? 's' : ''})`;
            } else {
                cardDriverAvgRating.textContent = 'N/A';
                cardDriverTrips.textContent = '0';
                cardDriverStars.innerHTML = '<span style="color: #ccc;">Sin calificaciones</span>';
                cardDriverRatingText.textContent = '(Sin viajes)';
            }
        } else {
            cardDriverAvgRating.textContent = 'N/A';
            cardDriverTrips.textContent = '0';
            cardDriverStars.innerHTML = '<span style="color: #ccc;">Sin calificaciones</span>';
            cardDriverRatingText.textContent = '(Sin viajes)';
        }
    } catch (error) {
        console.error("Error loading driver stats:", error);
        cardDriverAvgRating.textContent = 'Error';
        cardDriverTrips.textContent = 'Error';
        cardDriverStars.innerHTML = '<span style="color: #dc3545;">Error</span>';
        cardDriverRatingText.textContent = '';
    }
}

function generateStarsHTML(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    let starsHTML = '';
    
    // Estrellas llenas
    for (let i = 0; i < fullStars; i++) {
        starsHTML += '<i class="fas fa-star" style="color: #ffc107; margin: 0 1px;"></i>';
    }
    
    // Media estrella si es necesario
    if (hasHalfStar) {
        starsHTML += '<i class="fas fa-star-half-alt" style="color: #ffc107; margin: 0 1px;"></i>';
    }
    
    // Estrellas vacías
    for (let i = 0; i < emptyStars; i++) {
        starsHTML += '<i class="far fa-star" style="color: #ccc; margin: 0 1px;"></i>';
    }
    
    return starsHTML;
}

function minimizeDriverCard() {
    console.log("Minimizing driver card");
    driverCard.classList.add('minimized');
    
    // Cambiar el botón
    minimizeCardBtn.innerHTML = '<i class="fas fa-chevron-up"></i> Expandir';
    minimizeCardBtn.onclick = expandDriverCard;
}

function expandDriverCard() {
    console.log("Expanding driver card");
    driverCard.classList.remove('minimized');
    
    // Cambiar el botón
    minimizeCardBtn.innerHTML = '<i class="fas fa-chevron-down"></i> Minimizar';
    minimizeCardBtn.onclick = minimizeDriverCard;
}

function closeDriverCard() {
    console.log("Closing driver card");
    driverCard.style.display = 'none';
    driverCard.classList.remove('minimized');
    
    // Eliminar botón de cerrar si existe
    const closeBtn = document.getElementById('driver-card-close-btn');
    if (closeBtn) {
        closeBtn.remove();
    }
    
    // Resetear el botón
    minimizeCardBtn.innerHTML = '<i class="fas fa-chevron-down"></i> Minimizar';
    minimizeCardBtn.onclick = minimizeDriverCard;
}

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
    playNotificationSound(); // Play sound when notifications are shown
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

// --- Helper Functions ---
function createCustomMarker(position, map, title, color = '#4285f4', emoji = '') {
    try {
        // Intentar usar AdvancedMarkerElement si está disponible
        if (google.maps.marker && google.maps.marker.AdvancedMarkerElement) {
            const markerElement = document.createElement('div');
            markerElement.innerHTML = `
                <div style="
                    width: ${emoji ? '24px' : '20px'}; 
                    height: ${emoji ? '24px' : '20px'}; 
                    background-color: ${color}; 
                    border: 2px solid white; 
                    border-radius: 50%; 
                    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    color: white;
                    font-weight: bold;
                ">${emoji}</div>
            `;
            return new google.maps.marker.AdvancedMarkerElement({
                position: position,
                map: map,
                title: title,
                content: markerElement
            });
        } else {
            // Fallback a Marker regular con icono personalizado
            const iconUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
                <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" fill="${color}" stroke="white" stroke-width="2"/>
                    <text x="12" y="16" text-anchor="middle" fill="white" font-size="12" font-family="Arial, sans-serif">${emoji}</text>
                </svg>
            `)}`;
            
            return new google.maps.Marker({
                position: position,
                map: map,
                title: title,
                icon: {
                    url: iconUrl,
                    scaledSize: new google.maps.Size(24, 24),
                    anchor: new google.maps.Point(12, 12)
                }
            });
        }
    } catch (error) {
        console.warn('Error creating custom marker, using default:', error);
        // Fallback final a marcador básico
        return new google.maps.Marker({
            position: position,
            map: map,
            title: title
        });
    }
}
