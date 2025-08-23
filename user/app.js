console.log("user/app.js is running!");

// --- Map Initialization ---
document.addEventListener('map-ready', () => {
    console.log("Map ready event received.");
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => initMap({ lat: pos.coords.latitude, lng: pos.coords.longitude }), 
        () => initMap({ lat: 34.0522, lng: -118.2437 }));
    } else {
        initMap({ lat: 34.0522, lng: -118.2437 });
    }
});

function initMap(location) {
    console.log("Initializing map at:", location);
    map = new google.maps.Map(document.getElementById('map'), { center: location, zoom: 15, disableDefaultUI: true });
    userMarker = new google.maps.Marker({ position: location, map: map, title: 'Tu ubicación' });
}

let map, userMarker;