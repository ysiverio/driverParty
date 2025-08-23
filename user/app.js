
import { auth, db } from '../firebase-config.js';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, addDoc, doc, onSnapshot, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// DOM Elements
const loginView = document.getElementById('login-view');
const requestView = document.getElementById('request-view');
const waitingView = document.getElementById('waiting-view');
const loginButton = document.getElementById('login-button');
const requestDriverButton = document.getElementById('request-driver-button');
const tripStatusSpan = document.getElementById('trip-status');

let map;
let userMarker;
let driverMarker;
let currentUser;
let currentTripId;

// --- Authentication ---
loginButton.addEventListener('click', () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider)
        .catch((error) => {
            console.error("Error de autenticación:", error);
        });
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loginView.style.display = 'none';
        requestView.style.display = 'block';
        console.log("Usuario autenticado:", user.displayName);
    } else {
        currentUser = null;
        loginView.style.display = 'block';
        requestView.style.display = 'none';
        waitingView.style.display = 'none';
    }
});

// --- Map Initialization ---
document.addEventListener('map-ready', () => {
    // Get user's current location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            const userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            initMap(userLocation);
        }, () => {
            // Handle error or default location
            initMap({ lat: -34.397, lng: 150.644 });
            alert("No se pudo obtener tu ubicación. Se usará una ubicación por defecto.");
        });
    } else {
        // Browser doesn't support Geolocation
        initMap({ lat: -34.397, lng: 150.644 });
        alert("Tu navegador no soporta geolocalización.");
    }
});

function initMap(initialLocation) {
    map = new google.maps.Map(document.getElementById('map'), {
        center: initialLocation,
        zoom: 15,
        disableDefaultUI: true
    });

    userMarker = new google.maps.Marker({
        position: initialLocation,
        map: map,
        title: 'Tu ubicación'
    });
}

// --- Ride Request Logic ---
requestDriverButton.addEventListener('click', async () => {
    console.log('Estado al hacer clic:', { currentUser, map }); // Línea de depuración
    console.log('Estado al hacer clic:', { currentUser, map }); // Línea de depuración
    console.log('Estado al hacer clic:', { currentUser, map }); // Línea de depuración
    if (!currentUser || !map) return;

    const userLocation = {
        lat: map.getCenter().lat(),
        lng: map.getCenter().lng()
    };

    try {
        const docRef = await addDoc(collection(db, "trips"), {
            userId: currentUser.uid,
            userName: currentUser.displayName,
            userLocation: userLocation,
            status: 'pending',
            driverId: null,
            driverLocation: null,
            createdAt: new Date()
        });
        
        currentTripId = docRef.id;
        console.log("Viaje solicitado con ID:", currentTripId);
        
        requestView.style.display = 'none';
        waitingView.style.display = 'block';
        tripStatusSpan.textContent = 'Pendiente';

        listenToTripUpdates(currentTripId);

    } catch (e) {
        console.error("Error al solicitar el viaje: ", e);
        alert("Hubo un error al solicitar tu viaje. Inténtalo de nuevo.");
    }
});

// --- Real-time Trip Updates ---
function listenToTripUpdates(tripId) {
    const tripRef = doc(db, "trips", tripId);

    onSnapshot(tripRef, (docSnap) => {
        if (!docSnap.exists()) {
            console.error("El viaje ya no existe.");
            // Handle trip cancellation or deletion
            return;
        }

        const tripData = docSnap.data();
        tripStatusSpan.textContent = getStatusInSpanish(tripData.status);

        if (tripData.status === 'accepted' || tripData.status === 'in_progress') {
            if (tripData.driverLocation) {
                updateDriverMarker(tripData.driverLocation);
            }
        }
        
        if (tripData.status === 'completed' || tripData.status === 'cancelled') {
            // End of trip logic
            setTimeout(() => {
                waitingView.style.display = 'none';
                requestView.style.display = 'block';
                if(driverMarker) driverMarker.setMap(null);
            }, 5000); // Show final status for 5 seconds
        }
    });
}

function updateDriverMarker(location) {
    const driverPosition = new google.maps.LatLng(location.lat, location.lng);
    if (!driverMarker) {
        driverMarker = new google.maps.Marker({
            position: driverPosition,
            map: map,
            title: 'Tu Conductor',
            // A different icon for the driver
            icon: {
                url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png"
            }
        });
    } else {
        driverMarker.setPosition(driverPosition);
    }
    map.panTo(driverPosition);
}

function getStatusInSpanish(status) {
    switch (status) {
        case 'pending': return 'Pendiente';
        case 'accepted': return 'Aceptado, conductor en camino';
        case 'in_progress': return 'Viaje en curso';
        case 'completed': return 'Viaje completado';
        case 'cancelled': return 'Viaje cancelado';
        default: return status;
    }
}
