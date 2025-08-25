// Google Maps API module
// Handles async loading of Google Maps JavaScript API and map operations

let googleMapsLoaded = false;
let googleMapsPromise = null;

// Load Google Maps API asynchronously
function loadGoogleMapsAPI() {
    if (googleMapsPromise) {
        return googleMapsPromise;
    }

    googleMapsPromise = new Promise((resolve, reject) => {
        if (googleMapsLoaded) {
            resolve();
            return;
        }

        // Check if API key is available
        const apiKey = getGoogleMapsAPIKey();
        if (!apiKey) {
            reject(new Error('Google Maps API key not found. Please set VITE_GOOGLE_MAPS_API_KEY environment variable.'));
            return;
        }

        // Create script element
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry&callback=initGoogleMaps`;
        script.async = true;
        script.defer = true;

        // Global callback function
        window.initGoogleMaps = () => {
            googleMapsLoaded = true;
            resolve();
        };

        script.onerror = () => {
            reject(new Error('Failed to load Google Maps API'));
        };

        document.head.appendChild(script);
    });

    return googleMapsPromise;
}

// Get Google Maps API key from environment variable
function getGoogleMapsAPIKey() {
    // For development, you can set this in your .env file
    // For production, you should use a proper environment variable system
    const apiKey = import.meta.env?.VITE_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
        console.error('Google Maps API key not configured. Please set VITE_GOOGLE_MAPS_API_KEY in your .env file');
        console.error('Get your API key at: https://console.cloud.google.com/apis/credentials');
        return null;
    }
    
    return apiKey;
}

// Create map instance
async function createMap(elementId) {
    await loadGoogleMapsAPI();

    const mapElement = document.getElementById(elementId);
    if (!mapElement) {
        throw new Error(`Map element with id '${elementId}' not found`);
    }

    // Initialize map
    const map = new google.maps.Map(mapElement, {
        zoom: 14,
        center: { lat: 0, lng: 0 },
        disableDefaultUI: true,
        zoomControl: true,
        mapTypeControl: false,
        scaleControl: false,
        streetViewControl: false,
        rotateControl: false,
        fullscreenControl: false,
        styles: [
            {
                featureType: 'poi',
                elementType: 'labels',
                stylers: [{ visibility: 'off' }]
            }
        ]
    });

    // Initialize directions service and renderer
    const directionsService = new google.maps.DirectionsService();
    const directionsRenderer = new google.maps.DirectionsRenderer({
        suppressMarkers: true,
        preserveViewport: false
    });
    directionsRenderer.setMap(map);

    // Initialize markers
    const markers = {
        car: null,
        pickup: null,
        destination: null
    };

    // Create car marker
    function createCarMarker(position) {
        if (markers.car) {
            markers.car.setMap(null);
        }

        const carIcon = {
            url: createCarIconSVG(),
            scaledSize: new google.maps.Size(32, 32),
            anchor: new google.maps.Point(16, 16)
        };

        markers.car = new google.maps.Marker({
            position: position,
            map: map,
            icon: carIcon,
            title: 'Tu ubicación',
            zIndex: 1000
        });

        return markers.car;
    }

    // Create pickup marker
    function createPickupMarker(position) {
        if (markers.pickup) {
            markers.pickup.setMap(null);
        }

        markers.pickup = new google.maps.Marker({
            position: position,
            map: map,
            icon: {
                url: createPickupIconSVG(),
                scaledSize: new google.maps.Size(24, 24),
                anchor: new google.maps.Point(12, 12)
            },
            title: 'Punto de recogida'
        });

        return markers.pickup;
    }

    // Create destination marker
    function createDestinationMarker(position) {
        if (markers.destination) {
            markers.destination.setMap(null);
        }

        markers.destination = new google.maps.Marker({
            position: position,
            map: map,
            icon: {
                url: createDestinationIconSVG(),
                scaledSize: new google.maps.Size(24, 24),
                anchor: new google.maps.Point(12, 12)
            },
            title: 'Destino'
        });

        return markers.destination;
    }

    // Update car marker position and heading
    function updateCarMarker({ lat, lng, heading = 0 }) {
        const position = { lat, lng };
        
        if (!markers.car) {
            createCarMarker(position);
        } else {
            markers.car.setPosition(position);
        }

        // Update car icon rotation based on heading
        if (markers.car) {
            const carIcon = {
                url: createCarIconSVG(heading),
                scaledSize: new google.maps.Size(32, 32),
                anchor: new google.maps.Point(16, 16)
            };
            markers.car.setIcon(carIcon);
        }
    }

    // Render route on map
    function renderRoute(routeData, type = 'toPickup') {
        if (!routeData || !routeData.polyline) {
            console.warn('No route data provided');
            return;
        }

        // Clear existing route
        directionsRenderer.setDirections({ routes: [] });

        // Create directions request
        const request = {
            origin: routeData.origin || routeData.steps[0]?.start_location,
            destination: routeData.destination || routeData.steps[routeData.steps.length - 1]?.end_location,
            travelMode: google.maps.TravelMode.DRIVING
        };

        // Get directions
        directionsService.route(request, (result, status) => {
            if (status === 'OK') {
                directionsRenderer.setDirections(result);
                
                // Set camera to driving view
                setCameraToDrivingView();
            } else {
                console.error('Directions request failed:', status);
            }
        });
    }

    // Set camera to driving view (zoom 16-17, centered on car)
    function setCameraToDrivingView() {
        if (markers.car) {
            const position = markers.car.getPosition();
            map.setCenter(position);
            map.setZoom(17);
        }
    }

    // Recenter map on car
    function recenter() {
        if (markers.car) {
            const position = markers.car.getPosition();
            map.panTo(position);
        }
    }

    // Clear all markers
    function clearMarkers() {
        Object.values(markers).forEach(marker => {
            if (marker) {
                marker.setMap(null);
            }
        });
    }

    // Return map instance with methods
    return {
        map,
        directionsService,
        directionsRenderer,
        markers,
        createCarMarker,
        createPickupMarker,
        createDestinationMarker,
        updateCarMarker,
        renderRoute,
        setCameraToDrivingView,
        recenter,
        clearMarkers
    };
}

// Create car icon SVG
function createCarIconSVG(heading = 0) {
    const svg = `
        <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.3)"/>
                </filter>
            </defs>
            <g transform="rotate(${heading} 16 16)">
                <rect x="4" y="12" width="24" height="8" rx="2" fill="#4285F4" stroke="#fff" stroke-width="1" filter="url(#shadow)"/>
                <circle cx="10" cy="20" r="3" fill="#333"/>
                <circle cx="22" cy="20" r="3" fill="#333"/>
                <rect x="8" y="14" width="16" height="4" fill="#fff" opacity="0.8"/>
            </g>
        </svg>
    `;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

// Create pickup icon SVG
function createPickupIconSVG() {
    const svg = `
        <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" fill="#4CAF50" stroke="#fff" stroke-width="2"/>
            <path d="M12 2v20M2 12h20" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
        </svg>
    `;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

// Create destination icon SVG
function createDestinationIconSVG() {
    const svg = `
        <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#FF5722" stroke="#fff" stroke-width="1"/>
            <circle cx="12" cy="9" r="2.5" fill="#fff"/>
        </svg>
    `;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

// Export functions
export { 
    createMap, 
    loadGoogleMapsAPI, 
    getGoogleMapsAPIKey 
};
