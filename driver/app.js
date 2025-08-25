
import { 
    auth, 
    db,
    GoogleAuthProvider, 
    signInWithPopup, 
    onAuthStateChanged, 
    signOut,
    collection, 
    addDoc, 
    setDoc,
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

// --- DOM Elements ---
const loginView = document.getElementById('login-view');
const mainUI = document.getElementById('main-ui');
const registrationView = document.getElementById('registration-view');
const pendingView = document.getElementById('pending-view');
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
let currentTripData = null; // Datos del viaje actual
let navigationPhase = 'none'; // 'to_client', 'to_destination', 'none'

// --- Navigation Screen Elements ---
const drivingToClientScreen = document.getElementById('driving-to-client-screen');
const drivingToDestinationScreen = document.getElementById('driving-to-destination-screen');
const arrivedAtClientBtn = document.getElementById('arrived-at-client-btn');
const completeTripBtn = document.getElementById('complete-trip-btn');

// --- Navigation Info Elements ---
const navClientName = document.getElementById('nav-client-name');
const navTimeToClient = document.getElementById('nav-time-to-client');
const navDistanceToClient = document.getElementById('nav-distance-to-client');
const navDestination = document.getElementById('nav-destination');
const navTimeToDestination = document.getElementById('nav-time-to-destination');
const navDistanceToDestination = document.getElementById('nav-distance-to-destination');

// --- Persistencia de Estado ---
const TRIP_STORAGE_KEY = 'driverParty_driver_trip_state';
const SESSION_STORAGE_KEY = 'driverParty_driver_session';

// Función para guardar el estado del viaje
function saveTripState() {
    const tripState = {
        activeTripId,
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
                activeTripId = tripState.activeTripId;
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
    if (activeTripId) {
        try {
            const tripDoc = await getDoc(doc(db, "tripRequests", activeTripId));
            if (tripDoc.exists()) {
                const tripData = tripDoc.data();
                
                // Si el viaje no está completado o cancelado, restaurarlo
                if (tripData.status !== 'completed' && tripData.status !== 'cancelled' && tripData.status !== 'expired') {
                    console.log('Restaurando viaje en curso:', activeTripId);
                    await restoreActiveTrip(tripData);
                    return;
                }
            }
        } catch (error) {
            console.error('Error verificando viaje:', error);
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
        requestsPanel.style.display = 'none';
        tripPanel.style.display = 'block';
        tripClientName.textContent = tripData.userName;
        
        // Restaurar marcador del usuario
        const userLocation = tripData.originCoords || tripData.userLocation;
        if (userLocation) {
            userMarker = createCustomMarker(userLocation, map, tripData.userName, '#4285f4');
        }
        
        // Obtener ubicación actual del driver
        navigator.geolocation.getCurrentPosition((pos) => {
            const location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            calculateAndDisplayRoute(location, userLocation);
            startSharingLocation(location);
        }, (err) => console.error("Geolocation error:", err));
        
        // Activar modo navegación si el viaje está en progreso
        if (tripData.status === 'in_progress' && !navigationMode) {
            activateNavigationMode(userLocation);
        }
        
        // Escuchar si el usuario rechaza el viaje
        listenForTripRejection(activeTripId);
        
        showNotificationToast('Viaje en curso restaurado');
        console.log('Viaje restaurado exitosamente');
        
    } catch (error) {
        console.error('Error restaurando viaje:', error);
        clearTripState();
        resetTripState();
    }
}

// --- Authentication ---
onAuthStateChanged(auth, async (user) => {
    if (user) { 
        currentUser = user; 
        await checkDriverStatus(user);
        
        // Verificar si hay un viaje en curso al iniciar sesión
        setTimeout(async () => {
            await checkAndRestoreActiveTrip();
        }, 2000); // Esperar 2 segundos para que el mapa se inicialice
    }
    else { 
        currentUser = null; 
        setupUIForLoggedOutUser(); 
        clearTripState(); // Limpiar estado al cerrar sesión
    }
});

// Verificar el estado del driver
async function checkDriverStatus(user) {
    try {
        const driverRef = doc(db, "drivers", user.uid);
        const driverDoc = await getDoc(driverRef);
        
        if (!driverDoc.exists()) {
            // Driver no registrado, mostrar formulario de registro
            showRegistrationView(user);
        } else {
            const driverData = driverDoc.data();
            
            switch (driverData.status) {
                case 'pending':
                    showPendingView(driverData);
                    break;
                case 'approved':
                    setupUIForLoggedInUser(user);
                    break;
                case 'rejected':
                    showRejectedView(driverData);
                    break;
                case 'suspended':
                    showSuspendedView(driverData);
                    break;
                default:
                    showRegistrationView(user);
            }
        }
    } catch (error) {
        console.error('Error checking driver status:', error);
        showRegistrationView(user);
    }
}

// Mostrar vista de registro
function showRegistrationView(user) {
    loginView.style.display = 'none';
    mainUI.style.display = 'none';
    pendingView.style.display = 'none';
    registrationView.style.display = 'flex';
    
    // Pre-llenar campos con datos del usuario
    document.getElementById('driver-name').value = user.displayName || '';
    document.getElementById('driver-email').value = user.email || '';
}

// Mostrar vista de pendiente
function showPendingView(driverData) {
    loginView.style.display = 'none';
    mainUI.style.display = 'none';
    registrationView.style.display = 'none';
    pendingView.style.display = 'flex';
    
    // Actualizar información
    document.getElementById('driver-status').textContent = 'Pendiente';
    
    // Manejar createdAt de forma segura
    let requestDate = 'N/A';
    if (driverData.createdAt) {
        try {
            if (driverData.createdAt.toDate && typeof driverData.createdAt.toDate === 'function') {
                // Es un Firestore Timestamp
                requestDate = new Date(driverData.createdAt.toDate()).toLocaleDateString('es-ES');
            } else if (driverData.createdAt instanceof Date) {
                // Es un objeto Date
                requestDate = driverData.createdAt.toLocaleDateString('es-ES');
            } else if (typeof driverData.createdAt === 'string') {
                // Es un string de fecha
                requestDate = new Date(driverData.createdAt).toLocaleDateString('es-ES');
            } else if (driverData.createdAt.seconds) {
                // Es un timestamp con seconds
                requestDate = new Date(driverData.createdAt.seconds * 1000).toLocaleDateString('es-ES');
            }
        } catch (error) {
            console.error('Error parsing createdAt:', error);
            requestDate = 'N/A';
        }
    }
    document.getElementById('request-date').textContent = requestDate;
}

// Mostrar vista de rechazado
function showRejectedView(driverData) {
    loginView.style.display = 'none';
    mainUI.style.display = 'none';
    registrationView.style.display = 'none';
    pendingView.style.display = 'none';
    
    // Crear vista de rechazado
    const rejectedView = document.createElement('div');
    rejectedView.className = 'overlay-container';
    rejectedView.style.display = 'flex';
    rejectedView.innerHTML = `
        <div class="pending-box">
            <div class="pending-icon">
                <i class="fas fa-times-circle" style="color: #dc3545;"></i>
            </div>
            <h2>Solicitud Rechazada</h2>
            <p>Tu solicitud para ser conductor ha sido rechazada.</p>
            <p><strong>Motivo:</strong> ${driverData.rejectionReason || 'No especificado'}</p>
            <p>Si tienes alguna pregunta, contacta a soporte.</p>
            <button onclick="signOut(auth)" class="btn-secondary">Cerrar Sesión</button>
        </div>
    `;
    document.body.appendChild(rejectedView);
}

// Mostrar vista de suspendido
function showSuspendedView(driverData) {
    loginView.style.display = 'none';
    mainUI.style.display = 'none';
    registrationView.style.display = 'none';
    pendingView.style.display = 'none';
    
    // Crear vista de suspendido
    const suspendedView = document.createElement('div');
    suspendedView.className = 'overlay-container';
    suspendedView.style.display = 'flex';
    suspendedView.innerHTML = `
        <div class="pending-box">
            <div class="pending-icon">
                <i class="fas fa-ban" style="color: #ffc107;"></i>
            </div>
            <h2>Cuenta Suspendida</h2>
            <p>Tu cuenta de conductor ha sido suspendida temporalmente.</p>
            <p><strong>Motivo:</strong> ${driverData.suspensionReason || 'No especificado'}</p>
            <p>Contacta a soporte para más información.</p>
            <button onclick="signOut(auth)" class="btn-secondary">Cerrar Sesión</button>
        </div>
    `;
    document.body.appendChild(suspendedView);
}

loginButton.addEventListener('click', async () => {
    try {
        // Ejecutar reCAPTCHA antes del login
        let recaptchaToken;
        try {
            recaptchaToken = await UIUtils.executeRecaptcha('driver_login');
        } catch (recaptchaError) {
            console.warn('Error con reCAPTCHA, continuando sin verificación:', recaptchaError);
            // Continuar sin reCAPTCHA si hay problemas de red
            recaptchaToken = 'bypass';
        }
        
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
    if (onlineToggle.checked) { onlineToggle.checked = false; goOffline(); }
    signOut(auth).catch(err => console.error("Sign Out Error:", err));
});

// Exponer signOut y auth globalmente para las vistas de rechazado/suspendido
window.signOut = signOut;
window.auth = auth;

// --- Registration Form Events ---
const registrationForm = document.getElementById('driver-registration-form');
const cancelRegistrationBtn = document.getElementById('cancel-registration');
const logoutPendingBtn = document.getElementById('logout-pending');

// Verificar que los elementos existen antes de agregar event listeners
if (!registrationForm) {
    console.error('Elemento driver-registration-form no encontrado');
}
if (!cancelRegistrationBtn) {
    console.error('Elemento cancel-registration no encontrado');
}
if (!logoutPendingBtn) {
    console.error('Elemento logout-pending no encontrado');
}

// Manejar envío del formulario de registro
if (registrationForm) {
    registrationForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
        // Verificar que todos los elementos del formulario existen
        const nameElement = document.getElementById('driver-name');
        const phoneElement = document.getElementById('driver-phone');
        const emailElement = document.getElementById('driver-email');
        const licenseElement = document.getElementById('driver-license');
        const licenseExpiryElement = document.getElementById('license-expiry');
        const vehicleMakeElement = document.getElementById('vehicle-make');
        const vehicleModelElement = document.getElementById('vehicle-model');
        const vehicleYearElement = document.getElementById('vehicle-year');
        const vehicleColorElement = document.getElementById('vehicle-color');
        const vehiclePlateElement = document.getElementById('vehicle-plate');
        const insuranceNumberElement = document.getElementById('insurance-number');
        const insuranceExpiryElement = document.getElementById('insurance-expiry');
        
        // Verificar que todos los elementos existen
        if (!nameElement || !phoneElement || !emailElement || !licenseElement || 
            !licenseExpiryElement || !vehicleMakeElement || !vehicleModelElement || 
            !vehicleYearElement || !vehicleColorElement || !vehiclePlateElement || 
            !insuranceNumberElement || !insuranceExpiryElement) {
            throw new Error('Algunos elementos del formulario no se encontraron');
        }
        
        const formData = {
            name: nameElement.value,
            phone: phoneElement.value,
            email: emailElement.value,
            license: licenseElement.value,
            licenseExpiry: licenseExpiryElement.value,
            vehicle: {
                make: vehicleMakeElement.value,
                model: vehicleModelElement.value,
                year: parseInt(vehicleYearElement.value),
                color: vehicleColorElement.value,
                plate: vehiclePlateElement.value
            },
            insurance: {
                number: insuranceNumberElement.value,
                expiry: insuranceExpiryElement.value
            },
            status: 'pending',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            uid: currentUser.uid,
            photoURL: currentUser.photoURL,
            rating: 0,
            totalTrips: 0,
            totalEarnings: 0
        };
        
        // Guardar en Firestore
        await setDoc(doc(db, "drivers", currentUser.uid), formData);
        
        // Mostrar vista de pendiente
        showPendingView(formData);
        
        console.log('Driver registration submitted successfully');
        
    } catch (error) {
        console.error('Error submitting driver registration:', error);
        alert('Error al enviar la solicitud. Por favor, intenta nuevamente.');
    }
    });
}

// Cancelar registro
if (cancelRegistrationBtn) {
    cancelRegistrationBtn.addEventListener('click', () => {
        signOut(auth).catch(err => console.error("Sign Out Error:", err));
    });
}

// Cerrar sesión desde vista pendiente
if (logoutPendingBtn) {
    logoutPendingBtn.addEventListener('click', () => {
        signOut(auth).catch(err => console.error("Sign Out Error:", err));
    });
}

function setupUIForLoggedInUser(user) {
    loginView.style.display = 'none';
    mainUI.style.display = 'block';
    driverProfilePic.src = user.photoURL || 'default-pic.png';
    driverProfileName.textContent = user.displayName || 'Conductor';
    updateDriverRatingDisplay(); // Display rating on login
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
    loginView.style.display = 'flex';
    mainUI.style.display = 'none';
    closeSideNav();
    resetTripState(true);
}

// --- Map Initialization ---
function initializeMap() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            pos => {
                // Ocultar banner si está visible
                hideLocationPermissionBanner();
                initMap({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            },
            (error) => {
                console.warn('Geolocation error:', error);
                let errorMessage = 'Error de geolocalización';
                
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'Acceso a ubicación denegado. Por favor, habilita la ubicación en tu navegador.';
                        showLocationPermissionBanner();
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'Información de ubicación no disponible.';
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'Tiempo de espera agotado para obtener ubicación.';
                        break;
                    default:
                        errorMessage = 'Error desconocido de geolocalización.';
                }
                
                console.log(errorMessage);
                // Mostrar notificación al usuario
                showNotificationToast(errorMessage);
                
                // Usar ubicación por defecto
                initMap({ lat: 34.0522, lng: -118.2437 });
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
            }
        );
    } else { 
        console.warn('Geolocation no está disponible en este navegador');
        initMap({ lat: 34.0522, lng: -118.2437 }); 
    }
}

// --- Location Permission Banner Functions ---
function showLocationPermissionBanner() {
    const banner = document.getElementById('location-permission-banner');
    if (banner) {
        banner.style.display = 'block';
    }
}

function hideLocationPermissionBanner() {
    const banner = document.getElementById('location-permission-banner');
    if (banner) {
        banner.style.display = 'none';
    }
}

function requestLocationPermission() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            pos => {
                hideLocationPermissionBanner();
                showNotificationToast('Ubicación habilitada correctamente');
                initMap({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            },
            (error) => {
                console.warn('Permission request failed:', error);
                showNotificationToast('No se pudo obtener la ubicación. Verifica los permisos del navegador.');
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
            }
        );
    }
}

document.addEventListener('map-ready', initializeMap);

function initMap(location) {
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
    
    try {
        // Verificar que el contenedor del mapa tiene dimensiones
        if (mapElement.offsetWidth === 0 || mapElement.offsetHeight === 0) {
            console.warn('El contenedor del mapa no tiene dimensiones. Reintentando...');
            setTimeout(() => initMap(location), 100);
            return;
        }
        
        map = new google.maps.Map(mapElement, { 
            center: location, 
            zoom: 14, 
            disableDefaultUI: true,
            mapId: 'driver_map' // Agregar mapId para evitar warnings
        });
        directionsService = new google.maps.DirectionsService();
        directionsRenderer = new google.maps.DirectionsRenderer({ suppressMarkers: true, preserveViewport: true });
        directionsRenderer.setMap(map);
        console.log("Map initialized successfully.");
    } catch (error) {
        console.error('Error initializing map:', error);
    }
}

// --- UI Interactions ---
menuBtn.addEventListener('click', () => { sideNav.style.width = "280px"; navOverlay.style.display = "block"; });
closeNavBtn.addEventListener('click', closeSideNav);
navOverlay.addEventListener('click', closeSideNav);
vehicleBtn.addEventListener('click', showVehicleModal);
closeVehicleModalBtn.addEventListener('click', () => vehicleModal.style.display = 'none');

// --- Location Permission Banner Events ---
const enableLocationBtn = document.getElementById('enable-location-btn');
const dismissLocationBtn = document.getElementById('dismiss-location-btn');

if (enableLocationBtn) {
    enableLocationBtn.addEventListener('click', requestLocationPermission);
}

if (dismissLocationBtn) {
    dismissLocationBtn.addEventListener('click', hideLocationPermissionBanner);
}

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
    const q = query(collection(db, "tripRequests"), where("status", "==", "pending"));
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
    
    // Usar originCoords en lugar de userLocation
    const userLocation = trip.originCoords || trip.userLocation;
    if (userLocation) {
        addRequestMarker(userLocation, trip.userName);
    }
    
    requestsList.appendChild(card);
}

requestsList.addEventListener('click', (e) => { if (e.target.classList.contains('accept-button')) acceptTrip(e.target.dataset.id); });
function addRequestMarker(position, title) { 
    const marker = createCustomMarker(position, map, title, '#ea4335');
    requestMarkers[title] = marker; 
}
function clearRequestMarkers() { Object.values(requestMarkers).forEach(marker => marker.setMap(null)); requestMarkers = {}; }

// --- Listen for Trip Rejection ---
function listenForTripRejection(tripId) {
    const tripRef = doc(db, "tripRequests", tripId);
    onSnapshot(tripRef, (docSnap) => {
        if (docSnap.exists()) {
            const tripData = docSnap.data();
            if (tripData.status === 'rejected' && tripData.rejectedBy === 'user') {
                // Usuario rechazó el viaje
                console.log("User rejected the trip");
                showNotificationToast('El usuario rechazó el viaje');
                resetTripState();
            }
        }
    });
}

// --- Listen for Trip Payment ---
function listenForTripPayment(tripId) {
    const tripRef = doc(db, "tripRequests", tripId);
    onSnapshot(tripRef, (docSnap) => {
        if (docSnap.exists()) {
            const tripData = docSnap.data();
            
            // Verificar si el cliente ha pagado (cuando se crea el documento en 'trips')
            if (tripData.tripId && tripData.status === 'accepted') {
                console.log("Client has paid, starting navigation to client");
                showNotificationToast('¡Cliente ha pagado! Iniciando navegación...');
                
                // Ocultar información de espera
                const tripInfo = document.getElementById('trip-info');
                if (tripInfo) {
                    tripInfo.remove();
                }
                
                // Iniciar navegación hacia el cliente
                const userLocation = tripData.originCoords || tripData.userLocation;
                if (userLocation) {
                    startNavigationToClient(userLocation);
                    
                    // Obtener ubicación actual del conductor y calcular ruta
                    navigator.geolocation.getCurrentPosition((pos) => {
                        const driverLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                        calculateAndDisplayRoute(driverLocation, userLocation, 'to_client');
                        startSharingLocation(driverLocation);
                    }, (err) => console.error("Geolocation error:", err));
                }
            }
        }
    });
}

// --- Accept & Manage Trip ---
async function acceptTrip(tripId) {
    if (activeTripId) return;
    activeTripId = tripId;
    const tripRef = doc(db, "tripRequests", tripId);
    const driverRef = doc(db, "drivers", currentUser.uid);
    try {
        const driverDoc = await getDoc(driverRef);
        const driverData = driverDoc.exists() ? driverDoc.data() : {};
        await updateDoc(tripRef, { status: 'accepted', driverId: currentUser.uid, driverInfo: { name: currentUser.displayName, photoURL: currentUser.photoURL, vehicle: driverData.vehicle || null } });
        const tripDoc = await getDoc(tripRef);
        currentTripData = tripDoc.data();
        
        // Mostrar pantalla de espera de pago
        requestsPanel.style.display = 'none';
        tripPanel.style.display = 'block';
        tripClientName.textContent = currentTripData.userName;
        clearRequestMarkers();
        
        // Crear marcador del cliente
        const userLocation = currentTripData.originCoords || currentTripData.userLocation;
        if (userLocation) {
            userMarker = createCustomMarker(userLocation, map, currentTripData.userName, '#4285f4');
        }
        
        // Crear marcador del destino si existe
        if (currentTripData.destinationCoords) {
            const destinationMarker = createCustomMarker(currentTripData.destinationCoords, map, currentTripData.destination || 'Destino', '#34A853', '🎯');
        }
        
        // Mostrar información del viaje
        showTripInfo(currentTripData);
        
        // Escuchar cambios en el viaje (pago del cliente)
        listenForTripPayment(tripId);
        
        // Escuchar si el usuario rechaza el viaje
        listenForTripRejection(tripId);
        
        // Guardar estado del viaje
        saveTripState();
        
        showNotificationToast('Viaje aceptado. Esperando confirmación de pago del cliente...');
    } catch (error) { console.error("Error accepting trip: ", error); activeTripId = null; }
}

function calculateAndDisplayRoute(origin, destination, phase = 'to_client') {
    directionsService.route({ 
        origin, 
        destination, 
        travelMode: 'DRIVING',
        provideRouteAlternatives: false,
        drivingOptions: {
            departureTime: new Date(),
            trafficModel: 'best_guess'
        }
    }, (result, status) => {
        if (status === 'OK') {
            // Configurar el renderizador para mostrar la ruta como en Google Maps
            directionsRenderer.setOptions({
                suppressMarkers: true, // No mostrar marcadores automáticos
                preserveViewport: false, // Permitir que el mapa se ajuste a la ruta
                polylineOptions: {
                    strokeColor: phase === 'to_client' ? '#4285F4' : '#34A853',
                    strokeWeight: 6,
                    strokeOpacity: 0.8,
                    zIndex: 1000
                }
            });
            
            directionsRenderer.setDirections(result);
            updateDoc(doc(db, "tripRequests", activeTripId), { routePolyline: result.routes[0].overview_polyline });
            
            // Mostrar información de la ruta
            const route = result.routes[0];
            const leg = route.legs[0];
            showRouteInfo(leg.distance.text, leg.duration.text, phase, leg.steps);
            
            // Ajustar el mapa para mostrar toda la ruta
            const bounds = new google.maps.LatLngBounds();
            route.legs.forEach(leg => {
                bounds.extend(leg.start_location);
                bounds.extend(leg.end_location);
            });
            map.fitBounds(bounds, 80); // 80px de padding
            
            // Mostrar marcadores personalizados en origen y destino
            showRouteMarkers(origin, destination, phase);
            
        } else { 
            console.error('Directions request failed: ' + status);
            // Fallback: mostrar ruta simple
            showSimpleRoute(origin, destination, phase);
        }
    });
}

// --- Trip Information Display ---
function showTripInfo(tripData) {
    // Crear o actualizar información del viaje
    let tripInfo = document.getElementById('trip-info');
    if (!tripInfo) {
        tripInfo = document.createElement('div');
        tripInfo.id = 'trip-info';
        tripInfo.style.cssText = `
            position: fixed;
            top: 130px;
            left: 20px;
            background: rgba(255, 255, 255, 0.95);
            padding: 16px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 500;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(0,0,0,0.1);
            max-width: 350px;
        `;
        document.body.appendChild(tripInfo);
    }
    
    const destination = tripData.destination || 'Destino no especificado';
    const estimatedDistance = tripData.estimatedDistance || 'Distancia no calculada';
    const estimatedFare = tripData.estimatedFare || 'Tarifa no calculada';
    
    tripInfo.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; color: #4285F4; font-weight: 600;">
            <i class="fas fa-info-circle"></i>
            <span>Información del Viaje</span>
        </div>
        <div style="margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                <i class="fas fa-user" style="color: #4285F4;"></i>
                <span><strong>Cliente:</strong> ${tripData.userName || 'Usuario'}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                <i class="fas fa-map-marker-alt" style="color: #34A853;"></i>
                <span><strong>Destino:</strong> ${destination}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                <i class="fas fa-road" style="color: #4285F4;"></i>
                <span><strong>Distancia:</strong> ${estimatedDistance}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
                <i class="fas fa-dollar-sign" style="color: #34A853;"></i>
                <span><strong>Tarifa:</strong> ${estimatedFare}</span>
            </div>
        </div>
        <div style="border-top: 1px solid #eee; padding-top: 8px; text-align: center;">
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">Estado:</div>
            <div style="font-size: 13px; color: #ffc107; font-weight: 600;">
                <i class="fas fa-clock"></i> Esperando pago del cliente
            </div>
        </div>
    `;
}

function showRouteInfo(distance, duration, phase = 'to_client', steps = []) {
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
            max-width: 350px;
            max-height: 400px;
            overflow-y: auto;
        `;
        document.body.appendChild(routeInfo);
    }
    
    const phaseText = phase === 'to_client' ? 'Hacia el cliente' : 'Hacia el destino';
    const phaseIcon = phase === 'to_client' ? 'fa-user' : 'fa-map-marker-alt';
    const phaseColor = phase === 'to_client' ? '#4285F4' : '#34A853';
    
    // Obtener las primeras 3 instrucciones
    const firstInstructions = steps.slice(0, 3).map(step => step.instructions.replace(/<[^>]*>/g, '')).join(' • ');
    
    routeInfo.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; color: ${phaseColor}; font-weight: 600;">
            <i class="fas ${phaseIcon}"></i>
            <span>${phaseText}</span>
        </div>
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
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">Próximas instrucciones:</div>
            <div id="next-instruction" style="font-size: 13px; color: #333; font-weight: 500; line-height: 1.4;">
                ${firstInstructions || 'Siguiendo la ruta optimizada...'}
            </div>
        </div>
        ${steps.length > 3 ? `
        <div style="margin-top: 8px; text-align: center;">
            <button id="show-all-instructions" style="background: ${phaseColor}; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;">
                Ver todas las instrucciones (${steps.length})
            </button>
        </div>
        ` : ''}
    `;
    
    // Agregar event listener para mostrar todas las instrucciones
    const showAllBtn = document.getElementById('show-all-instructions');
    if (showAllBtn) {
        showAllBtn.addEventListener('click', () => {
            showAllInstructions(steps, phase);
        });
    }
}

function showAllInstructions(steps, phase) {
    const phaseText = phase === 'to_client' ? 'Hacia el cliente' : 'Hacia el destino';
    const phaseColor = phase === 'to_client' ? '#4285F4' : '#34A853';
    
    const instructionsModal = document.createElement('div');
    instructionsModal.className = 'overlay-container';
    instructionsModal.style.display = 'flex';
    instructionsModal.innerHTML = `
        <div class="modal-box" style="max-width: 500px; max-height: 80vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h2 style="color: ${phaseColor}; margin: 0;">
                    <i class="fas fa-route"></i> Instrucciones de Navegación
                </h2>
                <button onclick="this.closest('.overlay-container').remove()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #666;">×</button>
            </div>
            <div style="margin-bottom: 16px; padding: 8px; background: #f8f9fa; border-radius: 8px;">
                <strong>${phaseText}</strong>
            </div>
            <div style="max-height: 400px; overflow-y: auto;">
                ${steps.map((step, index) => `
                    <div style="display: flex; gap: 12px; margin-bottom: 12px; padding: 8px; border-left: 3px solid ${phaseColor}; background: #f8f9fa;">
                        <div style="flex-shrink: 0; width: 24px; height: 24px; background: ${phaseColor}; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold;">
                            ${index + 1}
                        </div>
                        <div style="flex: 1;">
                            <div style="font-size: 14px; color: #333; margin-bottom: 4px;">
                                ${step.instructions.replace(/<[^>]*>/g, '')}
                            </div>
                            <div style="font-size: 12px; color: #666;">
                                ${step.distance?.text || ''} • ${step.duration?.text || ''}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    document.body.appendChild(instructionsModal);
}

// --- Route Visualization Functions ---
function showRouteMarkers(origin, destination, phase) {
    // Limpiar marcadores anteriores de ruta
    if (window.routeOriginMarker) routeOriginMarker.setMap(null);
    if (window.routeDestinationMarker) routeDestinationMarker.setMap(null);
    
    const originTitle = phase === 'to_client' ? 'Tu ubicación' : 'Cliente';
    const destinationTitle = phase === 'to_client' ? 'Cliente' : 'Destino';
    
    // Marcador de origen (conductor)
    window.routeOriginMarker = createCustomMarker(origin, map, originTitle, '#4285F4', '🚗');
    
    // Marcador de destino
    const destColor = phase === 'to_client' ? '#34A853' : '#FF6B35';
    const destEmoji = phase === 'to_client' ? '👤' : '🎯';
    window.routeDestinationMarker = createCustomMarker(destination, map, destinationTitle, destColor, destEmoji);
}

function showSimpleRoute(origin, destination, phase) {
    // Crear una línea recta simple entre origen y destino
    const simpleRoute = new google.maps.Polyline({
        path: [origin, destination],
        geodesic: true,
        strokeColor: phase === 'to_client' ? '#4285F4' : '#34A853',
        strokeOpacity: 0.8,
        strokeWeight: 6,
        map: map
    });
    
    // Mostrar marcadores
    showRouteMarkers(origin, destination, phase);
    
    // Ajustar vista
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(origin);
    bounds.extend(destination);
    map.fitBounds(bounds, 80);
    
    // Guardar referencia para limpiar después
    window.simpleRoute = simpleRoute;
}

// --- Navigation Flow Functions ---
function startNavigationToClient(clientLocation) {
    console.log('Starting navigation to client:', clientLocation);
    
    // Ocultar paneles normales
    requestsPanel.style.display = 'none';
    tripPanel.style.display = 'none';
    
    // Mostrar pantalla de navegación hacia el cliente
    drivingToClientScreen.style.display = 'flex';
    
    // Actualizar información en la pantalla
    if (navClientName && currentTripData) {
        navClientName.textContent = currentTripData.userName || 'Cliente';
    }
    
    // Calcular y mostrar ruta hacia el cliente
    navigator.geolocation.getCurrentPosition((pos) => {
        const driverLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        calculateAndDisplayRoute(driverLocation, clientLocation, 'to_client');
        
        // Actualizar información de tiempo y distancia
        updateNavigationInfo(driverLocation, clientLocation, 'to_client');
        
        // Iniciar actualizaciones de ubicación en tiempo real
        startLocationUpdates();
        
        // Mostrar instrucciones de navegación hacia el cliente
        showNotificationToast('¡En camino hacia el cliente! Siguiendo ruta optimizada');
    }, (err) => {
        console.error("Error getting driver location:", err);
    });
    
    // Cambiar fase de navegación
    navigationPhase = 'to_client';
    
    // Notificar al usuario que el conductor está en camino
    notifyUserDriverEnRoute();
}

function startNavigationToDestination() {
    console.log('Starting navigation to destination');
    
    // Ocultar pantalla de navegación hacia el cliente
    drivingToClientScreen.style.display = 'none';
    
    // Mostrar pantalla de navegación hacia el destino
    drivingToDestinationScreen.style.display = 'flex';
    
    // Actualizar información en la pantalla
    if (navDestination && currentTripData) {
        navDestination.textContent = currentTripData.destination || 'Destino';
    }
    
    // Calcular y mostrar ruta hacia el destino
    navigator.geolocation.getCurrentPosition((pos) => {
        const driverLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        calculateAndDisplayRoute(driverLocation, currentTripData.destinationCoords, 'to_destination');
        
        // Actualizar información de tiempo y distancia
        updateNavigationInfo(driverLocation, currentTripData.destinationCoords, 'to_destination');
        
        // Mostrar instrucciones de navegación hacia el destino
        showNotificationToast('¡Viaje iniciado! Siguiendo ruta hacia el destino');
    }, (err) => {
        console.error("Error getting driver location:", err);
    });
    
    // Cambiar fase de navegación
    navigationPhase = 'to_destination';
    
    // Notificar al usuario que el viaje ha comenzado
    notifyUserTripStarted();
}

function arrivedAtClient() {
    console.log('Driver arrived at client');
    
    // Ocultar pantalla de navegación hacia el cliente
    drivingToClientScreen.style.display = 'none';
    
    // Mostrar panel de viaje normal
    tripPanel.style.display = 'block';
    
    // Actualizar estado del viaje
    updateTripStatus('in_progress');
    
    // Notificar al usuario que el conductor ha llegado
    notifyUserDriverArrived();
    
    // Cambiar fase de navegación
    navigationPhase = 'none';
}

function completeTrip() {
    console.log('Completing trip');
    
    // Ocultar pantalla de navegación hacia el destino
    drivingToDestinationScreen.style.display = 'none';
    
    // Finalizar el viaje
    updateTripStatus('completed');
    
    // Cambiar fase de navegación
    navigationPhase = 'none';
}

function updateNavigationInfo(origin, destination, phase) {
    // Calcular distancia y tiempo estimado
    const distance = google.maps.geometry.spherical.computeDistanceBetween(
        new google.maps.LatLng(origin),
        new google.maps.LatLng(destination)
    ) / 1000; // en km
    
    const timeMinutes = Math.round(distance * 2); // Estimación: 2 minutos por km
    
    // Actualizar elementos según la fase
    if (phase === 'to_client') {
        if (navTimeToClient) navTimeToClient.textContent = `${timeMinutes} MIN`;
        if (navDistanceToClient) navDistanceToClient.textContent = `${distance.toFixed(1)} KM`;
    } else if (phase === 'to_destination') {
        if (navTimeToDestination) navTimeToDestination.textContent = `${timeMinutes} MIN`;
        if (navDistanceToDestination) navDistanceToDestination.textContent = `${distance.toFixed(1)} KM`;
    }
}

function startLocationUpdates() {
    // Actualizar ubicación cada 10 segundos
    const locationInterval = setInterval(() => {
        if (!activeTripId || navigationPhase === 'none') {
            clearInterval(locationInterval);
            return;
        }
        
        navigator.geolocation.getCurrentPosition((pos) => {
            const location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            
            // Actualizar ubicación en Firestore
            updateDoc(doc(db, "tripRequests", activeTripId), {
                driverLocation: location,
                lastLocationUpdate: serverTimestamp()
            });
            
            // Actualizar marcador del conductor en el mapa
            if (driverMarker) {
                updateMarkerPosition(driverMarker, location);
            }
            
            // Actualizar información de navegación si es necesario
            if (navigationPhase === 'to_client' && currentTripData?.originCoords) {
                updateNavigationInfo(location, currentTripData.originCoords, 'to_client');
            } else if (navigationPhase === 'to_destination' && currentTripData?.destinationCoords) {
                updateNavigationInfo(location, currentTripData.destinationCoords, 'to_destination');
            }
        }, (err) => {
            console.error("Error updating location:", err);
        });
    }, 10000);
}

function notifyUserDriverEnRoute() {
    // Notificar al usuario que el conductor está en camino
    if (currentTripData) {
        updateDoc(doc(db, "tripRequests", activeTripId), {
            driverEnRoute: true,
            driverEnRouteAt: serverTimestamp()
        });
    }
}

function notifyUserDriverArrived() {
    // Notificar al usuario que el conductor ha llegado
    if (currentTripData) {
        updateDoc(doc(db, "tripRequests", activeTripId), {
            driverArrived: true,
            driverArrivedAt: serverTimestamp()
        });
    }
}

function notifyUserTripStarted() {
    // Notificar al usuario que el viaje ha comenzado
    if (currentTripData) {
        updateDoc(doc(db, "tripRequests", activeTripId), {
            tripStarted: true,
            tripStartedAt: serverTimestamp()
        });
    }
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
    showNavigationIndicator('Modo Navegación');
    
    // Configurar actualización automática de vista
    startNavigationViewUpdates();
    
    // Guardar estado del viaje
    saveTripState();
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
            bounds.extend(getMarkerPosition(driverMarker));
            bounds.extend(getMarkerPosition(userMarker));
            map.fitBounds(bounds, 80);
        }
    }, 5000);
}

function deactivateNavigationMode() {
    navigationMode = false;
    
    // Restaurar zoom original solo si el mapa existe
    if (map && typeof map.setZoom === 'function') {
        map.setZoom(originalZoom);
    }
    
    // Remover indicador de navegación
    const navIndicator = document.getElementById('navigation-indicator');
    if (navIndicator) {
        navIndicator.style.transition = 'all 0.3s ease';
        navIndicator.style.transform = 'translateY(-20px)';
        navIndicator.style.opacity = '0';
        setTimeout(() => {
            if (navIndicator && navIndicator.parentNode) {
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
            if (routeInfo && routeInfo.parentNode) {
                routeInfo.parentNode.removeChild(routeInfo);
            }
        }, 300);
    }
    
    // Remover información del viaje
    const tripInfo = document.getElementById('trip-info');
    if (tripInfo) {
        tripInfo.style.transition = 'all 0.3s ease';
        tripInfo.style.transform = 'translateY(-20px)';
        tripInfo.style.opacity = '0';
        setTimeout(() => {
            if (tripInfo && tripInfo.parentNode) {
                tripInfo.parentNode.removeChild(tripInfo);
            }
        }, 300);
    }
}

startTripButton.addEventListener('click', () => startNavigationToDestination());
endTripButton.addEventListener('click', () => updateTripStatus('completed'));

// --- Navigation Toggle Events ---
toggleNavigationBtn.addEventListener('click', toggleNavigationMode);

// --- Navigation Screen Event Listeners ---
if (arrivedAtClientBtn) {
    arrivedAtClientBtn.addEventListener('click', () => {
        arrivedAtClient();
    });
}

if (completeTripBtn) {
    completeTripBtn.addEventListener('click', () => {
        completeTrip();
    });
}

async function updateTripStatus(status) {
    if (!activeTripId) return;

    try {
        const tripRequestRef = doc(db, "tripRequests", activeTripId);
        const tripRequestSnap = await getDoc(tripRequestRef);

        if (tripRequestSnap.exists()) {
            const tripRequestData = tripRequestSnap.data();
            const mainTripId = tripRequestData.tripId; // ID del documento en la colección 'trips'

            // Si existe un mainTripId, el usuario ha pagado y debemos actualizar el documento en 'trips'.
            if (mainTripId) {
                const tripRef = doc(db, "trips", mainTripId);
                await updateDoc(tripRef, { status: status });
                console.log(`Estatus del viaje ${mainTripId} actualizado a: ${status}`);
            } 
            
            // Actualizamos también la solicitud original para mantener la consistencia.
            await updateDoc(tripRequestRef, { status: status });

            // Lógica de finalización del viaje
            if (status === 'completed') {
                if (mainTripId) {
                    // En lugar de buscar inmediatamente, configuramos un listener para detectar cuando se añade la calificación
                    const tripRef = doc(db, "trips", mainTripId);
                    const unsubscribeTrip = onSnapshot(tripRef, async (tripDoc) => {
                        if (tripDoc.exists()) {
                            const tripData = tripDoc.data();
                            const rating = tripData.rating || 0;

                            if (rating > 0) {
                                // Detener el listener una vez que encontramos la calificación
                                unsubscribeTrip();
                                
                                const driverRef = doc(db, "drivers", currentUser.uid);
                                const driverDoc = await getDoc(driverRef);
                                const newNumTrips = (driverDoc.data()?.numTrips || 0) + 1;
                                const newTotalStars = (driverDoc.data()?.totalStars || 0) + rating;
                                
                                await setDoc(driverRef, { numTrips: newNumTrips, totalStars: newTotalStars }, { merge: true });
                                updateDriverRatingDisplay();
                                showNotificationToast(`¡Recibiste ${rating} estrella${rating > 1 ? 's' : ''}!`);
                                
                                // Ahora sí resetear el estado del viaje
                                resetTripState();
                            }
                        }
                    }, (error) => {
                        console.error("Error listening for trip rating:", error);
                        // Si hay error, resetear el estado después de un tiempo
                        setTimeout(() => resetTripState(), 5000);
                    });
                    
                    // Si después de 2 minutos no hay calificación, resetear el estado
                    setTimeout(() => {
                        unsubscribeTrip();
                        resetTripState();
                    }, 120000); // 2 minutos
                } else {
                    resetTripState();
                }
            }
        }
    } catch (error) {
        console.error("Error al actualizar el estado del viaje:", error);
        alert("No se pudo actualizar el estado del viaje.");
    }
}

// --- Location & Map Updates ---
function startSharingLocation(initialLocation) {
    if (driverMarker) driverMarker.setMap(null);
    // Crear marcador con fallback para compatibilidad
    driverMarker = createCustomMarker(initialLocation, map, 'Tu ubicación', '#4285F4');
    
    if (navigationMode) {
        // En modo navegación, centrar en la ruta completa
        updateNavigationView();
    } else {
        updateMapBounds();
    }
    
    locationWatcherId = navigator.geolocation.watchPosition((pos) => {
        const driverLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        updateDoc(doc(db, "tripRequests", activeTripId), { driverLocation });
        
        // Actualizar posición del marcador de manera compatible
        updateMarkerPosition(driverMarker, driverLocation);
        
        if (navigationMode) {
            updateNavigationView();
        } else {
            updateMapBounds();
        }
    }, (err) => console.error("Watch position error:", err), { enableHighAccuracy: true });
}



function updateMapBounds() {
    if (!userMarker || !driverMarker) return;
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(getMarkerPosition(userMarker));
    bounds.extend(getMarkerPosition(driverMarker));
    map.fitBounds(bounds, 60);
}

function resetTripState(isLogout = false) {
    if (locationWatcherId) navigator.geolocation.clearWatch(locationWatcherId);
    if (directionsRenderer && typeof directionsRenderer.setDirections === 'function') {
        directionsRenderer.setDirections({ routes: [] });
    }
    if (driverMarker && typeof driverMarker.setMap === 'function') {
        driverMarker.setMap(null);
    }
    if (userMarker && typeof userMarker.setMap === 'function') {
        userMarker.setMap(null);
    }
    locationWatcherId = null; activeTripId = null; driverMarker = null; userMarker = null;
    
    // Resetear estado de navegación
    resetNavigationState();
    
    // Desactivar modo de navegación solo si no es logout
    if (!isLogout) {
        deactivateNavigationMode();
    }
    
    // Limpiar información del viaje
    const tripInfo = document.getElementById('trip-info');
    if (tripInfo) tripInfo.remove();
    
    const routeInfo = document.getElementById('route-info');
    if (routeInfo) routeInfo.remove();
    
    tripPanel.style.display = 'none';
    if (!isLogout && onlineToggle && onlineToggle.checked) {
        requestsPanel.style.display = 'block';
        if (!unsubscribeFromRequests) listenForRequests();
    } else if (isLogout && onlineToggle) {
        onlineToggle.checked = false;
        goOffline();
    }
    
    // Limpiar estado persistente
    clearTripState();
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
            collection(db, "tripRequests"), 
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
                        collection(db, "tripRequests"), 
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

// --- Helper Functions ---
function getMarkerPosition(marker) {
    // Helper function to get position from both Marker and AdvancedMarkerElement
    if (marker && typeof marker.getPosition === 'function') {
        return marker.getPosition();
    } else if (marker && marker.position) {
        return marker.position;
    } else if (marker && marker.latLng) {
        return marker.latLng;
    }
    return null;
}

function updateMarkerPosition(marker, position) {
    if (!marker || !position) return;
    
    // Convertir posición a LatLng si es necesario
    const latLng = position.lat && position.lng ? 
        new google.maps.LatLng(position.lat, position.lng) : 
        position;
    
    if (marker && typeof marker.setPosition === 'function') {
        // Marker tradicional
        marker.setPosition(latLng);
    } else if (marker && marker.position) {
        // AdvancedMarkerElement
        marker.position = latLng;
    } else if (marker && marker.latLng) {
        // Otro tipo de marcador
        marker.latLng = latLng;
    }
}

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



function showNavigationIndicator(phase) {
    // Crear o actualizar indicador de navegación
    let navIndicator = document.getElementById('navigation-indicator');
    if (!navIndicator) {
        navIndicator = document.createElement('div');
        navIndicator.id = 'navigation-indicator';
        navIndicator.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #4285F4, #34A853);
            color: white;
            padding: 12px 24px;
            border-radius: 25px;
            font-size: 14px;
            font-weight: 600;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            backdrop-filter: blur(10px);
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        document.body.appendChild(navIndicator);
    }
    
    const icon = phase === 'Hacia el cliente' ? 'fa-user' : 'fa-map-marker-alt';
    navIndicator.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${phase}</span>
        <i class="fas fa-route"></i>
    `;
    
    // Animar entrada
    navIndicator.style.transform = 'translateX(-50%) translateY(-20px)';
    navIndicator.style.opacity = '0';
    setTimeout(() => {
        navIndicator.style.transition = 'all 0.3s ease';
        navIndicator.style.transform = 'translateX(-50%) translateY(0)';
        navIndicator.style.opacity = '1';
    }, 100);
}

function updateNavigationView() {
    if (!userMarker || !driverMarker) return;
    
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(getMarkerPosition(userMarker));
    bounds.extend(getMarkerPosition(driverMarker));
    
    // Mantener zoom de navegación y centrar en la ruta
    map.fitBounds(bounds, 80);
}

function resetNavigationState() {
    navigationMode = false;
    navigationPhase = 'none';
    currentTripData = null;
    
    // Ocultar indicadores
    const navIndicator = document.getElementById('navigation-indicator');
    if (navIndicator) navIndicator.remove();
    
    const routeInfo = document.getElementById('route-info');
    if (routeInfo) routeInfo.remove();
    
    const tripInfo = document.getElementById('trip-info');
    if (tripInfo) tripInfo.remove();
    
    // Limpiar ruta
    if (directionsRenderer) {
        directionsRenderer.setDirections({ routes: [] });
    }
    
    // Limpiar marcadores de ruta
    if (window.routeOriginMarker) {
        window.routeOriginMarker.setMap(null);
        window.routeOriginMarker = null;
    }
    if (window.routeDestinationMarker) {
        window.routeDestinationMarker.setMap(null);
        window.routeDestinationMarker = null;
    }
    if (window.simpleRoute) {
        window.simpleRoute.setMap(null);
        window.simpleRoute = null;
    }
    
    // Restaurar zoom original
    if (map && typeof map.setZoom === 'function') {
        map.setZoom(originalZoom);
    }
}


