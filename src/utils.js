// Utils module
// Utility functions for formatting, icons, and deep links

// Strip HTML tags from text
function stripHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.innerHTML = str;
    return div.textContent || div.innerText || '';
}

// Format instruction for display
function formatInstruction(step) {
    if (!step) return '';
    
    // Use plain instructions if available, otherwise strip HTML
    let instruction = step.plain_instructions || stripHtml(step.html_instructions || '');
    
    // Clean up common patterns
    instruction = instruction
        .replace(/<b>/g, '')
        .replace(/<\/b>/g, '')
        .replace(/<div>/g, '')
        .replace(/<\/div>/g, '')
        .replace(/<span>/g, '')
        .replace(/<\/span>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    
    return instruction;
}

// Map maneuver to icon/font-awesome class
function getManeuverIcon(maneuver) {
    const iconMap = {
        'straight': 'fas fa-arrow-up',
        'left': 'fas fa-arrow-left',
        'right': 'fas fa-arrow-right',
        'slight-left': 'fas fa-arrow-up',
        'slight-right': 'fas fa-arrow-up',
        'sharp-left': 'fas fa-arrow-left',
        'sharp-right': 'fas fa-arrow-right',
        'u-turn-left': 'fas fa-undo',
        'u-turn-right': 'fas fa-redo',
        'ramp-left': 'fas fa-arrow-left',
        'ramp-right': 'fas fa-arrow-right',
        'merge': 'fas fa-code-branch',
        'fork-left': 'fas fa-arrow-left',
        'fork-right': 'fas fa-arrow-right',
        'ferry': 'fas fa-ship',
        'roundabout-left': 'fas fa-circle',
        'roundabout-right': 'fas fa-circle'
    };
    
    return iconMap[maneuver] || 'fas fa-arrow-up';
}

// Map maneuver to arrow direction
function getManeuverArrow(maneuver) {
    const arrowMap = {
        'straight': '↑',
        'left': '←',
        'right': '→',
        'slight-left': '↖',
        'slight-right': '↗',
        'sharp-left': '←',
        'sharp-right': '→',
        'u-turn-left': '↶',
        'u-turn-right': '↷',
        'ramp-left': '←',
        'ramp-right': '→',
        'merge': '↗',
        'fork-left': '←',
        'fork-right': '→',
        'ferry': '⛴',
        'roundabout-left': '↺',
        'roundabout-right': '↻'
    };
    
    return arrowMap[maneuver] || '↑';
}

// Format distance for display
function formatDistance(meters) {
    if (!meters || meters < 0) return '0 m';
    
    if (meters < 1000) {
        return `${Math.round(meters)} m`;
    } else {
        return `${(meters / 1000).toFixed(1)} km`;
    }
}

// Format duration for display
function formatDuration(seconds) {
    if (!seconds || seconds < 0) return '0 min';
    
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) {
        return `${minutes} min`;
    } else {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        if (remainingMinutes === 0) {
            return `${hours}h`;
        } else {
            return `${hours}h ${remainingMinutes}min`;
        }
    }
}

// Generate Google Maps deep link
function generateGoogleMapsDeepLink(origin, destination, travelMode = 'driving') {
    const originStr = typeof origin === 'string' ? origin : `${origin.lat},${origin.lng}`;
    const destinationStr = typeof destination === 'string' ? destination : `${destination.lat},${destination.lng}`;
    
    const params = new URLSearchParams({
        api: '1',
        origin: originStr,
        destination: destinationStr,
        travelmode: travelMode,
        dir_action: 'navigate'
    });
    
    return `https://www.google.com/maps/dir/?${params.toString()}`;
}

// Generate Apple Maps deep link
function generateAppleMapsDeepLink(origin, destination) {
    const originStr = typeof origin === 'string' ? origin : `${origin.lat},${origin.lng}`;
    const destinationStr = typeof destination === 'string' ? destination : `${destination.lat},${destination.lng}`;
    
    return `http://maps.apple.com/?saddr=${encodeURIComponent(originStr)}&daddr=${encodeURIComponent(destinationStr)}&dirflg=d`;
}

// Generate universal deep link (detects platform)
function generateUniversalDeepLink(origin, destination, travelMode = 'driving') {
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (userAgent.includes('iphone') || userAgent.includes('ipad') || userAgent.includes('ipod')) {
        return generateAppleMapsDeepLink(origin, destination);
    } else {
        return generateGoogleMapsDeepLink(origin, destination, travelMode);
    }
}

// Debounce function
function debounce(func, wait, immediate) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func(...args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func(...args);
    };
}

// Throttle function
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Sleep function
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Generate random ID
function generateId(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Validate coordinates
function isValidCoordinates(lat, lng) {
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

// Calculate distance between two points (Haversine formula)
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

// Format time for display
function formatTime(date) {
    if (!date) return '';
    
    const d = new Date(date);
    return d.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Format date for display
function formatDate(date) {
    if (!date) return '';
    
    const d = new Date(date);
    return d.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Format relative time
function formatRelativeTime(date) {
    if (!date) return '';
    
    const now = new Date();
    const d = new Date(date);
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays} días`;
    
    return formatDate(date);
}

// Copy text to clipboard
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (error) {
        console.error('Failed to copy text:', error);
        return false;
    }
}

// Show notification
function showNotification(title, options = {}) {
    if (!('Notification' in window)) {
        console.warn('Notifications not supported');
        return;
    }
    
    if (Notification.permission === 'granted') {
        new Notification(title, options);
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                new Notification(title, options);
            }
        });
    }
}

// Export functions
export {
    stripHtml,
    formatInstruction,
    getManeuverIcon,
    getManeuverArrow,
    formatDistance,
    formatDuration,
    generateGoogleMapsDeepLink,
    generateAppleMapsDeepLink,
    generateUniversalDeepLink,
    debounce,
    throttle,
    sleep,
    generateId,
    isValidCoordinates,
    calculateDistance,
    formatTime,
    formatDate,
    formatRelativeTime,
    copyToClipboard,
    showNotification
};
