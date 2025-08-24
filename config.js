// Configuración del sistema de precios y configuraciones generales
export const APP_CONFIG = {
    // Configuración de precios
    PRICING: {
        DEFAULT_DRIVER_RATE_PER_KM: 2.50, // Precio por km que se paga al conductor
        DEFAULT_USER_RATE_PER_KM: 3.50,   // Precio por km que se cobra al usuario
        MINIMUM_FARE: 5.00,               // Tarifa mínima
        BASE_FARE: 2.00,                  // Tarifa base
        SURGE_MULTIPLIER: 1.5,            // Multiplicador para horas pico
        NIGHT_RATE_MULTIPLIER: 1.2,       // Multiplicador para viajes nocturnos
        WAITING_FEE_PER_MINUTE: 0.50,     // Cargo por minuto de espera
        CANCELLATION_FEE: 3.00,           // Cargo por cancelación
    },
    
    // Configuración de la aplicación
    APP: {
        NAME: "DriverParty",
        VERSION: "2.0.0",
        SUPPORT_EMAIL: "support@driverparty.com",
        SUPPORT_PHONE: "+1-800-DRIVER",
        TERMS_URL: "https://driverparty.com/terms",
        PRIVACY_URL: "https://driverparty.com/privacy",
    },
    
    // Configuración de mapas
    MAP: {
        DEFAULT_ZOOM: 15,
        DRIVER_ZOOM: 18,
        USER_ZOOM: 16,
        NAVIGATION_ZOOM: 19,
        UPDATE_INTERVAL: 5000, // ms
        LOCATION_TIMEOUT: 10000, // ms
    },
    
    // Configuración de notificaciones
    NOTIFICATIONS: {
        SOUND_ENABLED: true,
        VIBRATION_ENABLED: true,
        TOAST_DURATION: 3000, // ms
        REQUEST_TIMEOUT: 30000, // ms
    },
    
    // Configuración de viajes
    TRIP: {
        MAX_WAIT_TIME: 300, // segundos
        AUTO_CANCEL_TIME: 600, // segundos
        RATING_TIMEOUT: 86400, // segundos (24 horas)
        MAX_DISTANCE: 100, // km
    },
    
    // Configuración de conductores
    DRIVER: {
        MIN_RATING: 4.0,
        MAX_ACTIVE_TRIPS: 1,
        AUTO_OFFLINE_AFTER: 3600, // segundos (1 hora)
        REQUIRED_FIELDS: ['name', 'phone', 'vehicle', 'license'],
    },
    
    // Configuración de usuarios
    USER: {
        MAX_ACTIVE_REQUESTS: 1,
        PAYMENT_METHODS: ['cash', 'card', 'digital_wallet'],
        DEFAULT_PAYMENT_METHOD: 'cash',
    },
    
    // Configuración de seguridad
    SECURITY: {
        MAX_LOGIN_ATTEMPTS: 5,
        LOCKOUT_DURATION: 900, // segundos (15 minutos)
        SESSION_TIMEOUT: 3600, // segundos (1 hora)
        PASSWORD_MIN_LENGTH: 8,
    }
};

// Funciones de utilidad para precios
export class PricingCalculator {
    constructor(config = APP_CONFIG.PRICING) {
        this.config = config;
    }
    
    // Calcular precio para el conductor
    calculateDriverEarnings(distance, duration = 0, waitingTime = 0) {
        const baseEarnings = distance * this.config.DEFAULT_DRIVER_RATE_PER_KM;
        const waitingEarnings = waitingTime * this.config.WAITING_FEE_PER_MINUTE;
        const totalEarnings = baseEarnings + waitingEarnings;
        
        return Math.max(totalEarnings, this.config.MINIMUM_FARE);
    }
    
    // Calcular precio para el usuario
    calculateUserFare(distance, duration = 0, waitingTime = 0, surgeMultiplier = 1) {
        const baseFare = this.config.BASE_FARE;
        const distanceFare = distance * this.config.DEFAULT_USER_RATE_PER_KM;
        const waitingFare = waitingTime * this.config.WAITING_FEE_PER_MINUTE;
        const subtotal = baseFare + distanceFare + waitingFare;
        const totalFare = subtotal * surgeMultiplier;
        
        return Math.max(totalFare, this.config.MINIMUM_FARE);
    }
    
    // Calcular comisión de la plataforma
    calculatePlatformCommission(userFare, driverEarnings) {
        return userFare - driverEarnings;
    }
    
    // Aplicar multiplicador de hora pico
    applySurgeMultiplier(baseFare, multiplier = this.config.SURGE_MULTIPLIER) {
        return baseFare * multiplier;
    }
    
    // Aplicar tarifa nocturna
    applyNightRate(baseFare, multiplier = this.config.NIGHT_RATE_MULTIPLIER) {
        return baseFare * multiplier;
    }
    
    // Verificar si es hora pico
    isSurgeHour() {
        const hour = new Date().getHours();
        return (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);
    }
    
    // Verificar si es tarifa nocturna
    isNightRate() {
        const hour = new Date().getHours();
        return hour >= 22 || hour <= 6;
    }
}

// Funciones de utilidad para validaciones
export class ValidationUtils {
    static isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    static isValidPhone(phone) {
        const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
        return phoneRegex.test(phone);
    }
    
    static isValidLicense(license) {
        return license && license.length >= 5;
    }
    
    static isValidVehicle(vehicle) {
        return vehicle && vehicle.plate && vehicle.model && vehicle.year;
    }
    
    static isValidDistance(distance) {
        return distance > 0 && distance <= APP_CONFIG.TRIP.MAX_DISTANCE;
    }
    
    static isValidRating(rating) {
        return rating >= 1 && rating <= 5;
    }
}

// Funciones de utilidad para formateo
export class FormatUtils {
    static formatCurrency(amount, currency = 'USD') {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: currency
        }).format(amount);
    }
    
    static formatDistance(distance) {
        if (distance < 1) {
            return `${Math.round(distance * 1000)}m`;
        }
        return `${distance.toFixed(1)}km`;
    }
    
    static formatDuration(minutes) {
        if (minutes < 60) {
            return `${Math.round(minutes)}min`;
        }
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = Math.round(minutes % 60);
        return `${hours}h ${remainingMinutes}min`;
    }
    
    static formatDateTime(date) {
        return new Intl.DateTimeFormat('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    }
    
    static formatTime(date) {
        return new Intl.DateTimeFormat('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    }
    
    static formatDate(date) {
        return new Intl.DateTimeFormat('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }).format(date);
    }
}

// Funciones de utilidad para UI
export class UIUtils {
    static showToast(message, type = 'info', duration = APP_CONFIG.NOTIFICATIONS.TOAST_DURATION) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        // Estilos del toast
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#007bff'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            font-size: 14px;
            font-weight: 500;
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;
        
        document.body.appendChild(toast);
        
        // Animar entrada
        setTimeout(() => {
            toast.style.transform = 'translateX(0)';
        }, 100);
        
        // Auto-remover
        setTimeout(() => {
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, duration);
    }
    
    static showLoading(message = 'Cargando...') {
        const loading = document.createElement('div');
        loading.className = 'loading-overlay';
        loading.innerHTML = `
            <div class="loading-content">
                <div class="spinner"></div>
                <p>${message}</p>
            </div>
        `;
        
        loading.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        
        document.body.appendChild(loading);
        return loading;
    }
    
    static hideLoading(loadingElement) {
        if (loadingElement && loadingElement.parentNode) {
            loadingElement.parentNode.removeChild(loadingElement);
        }
    }

    // Función para ejecutar reCAPTCHA
    static async executeRecaptcha(action = 'login') {
        try {
            if (typeof grecaptcha === 'undefined') {
                console.warn('reCAPTCHA no está disponible');
                return null;
            }
            
            const token = await grecaptcha.enterprise.execute('6LfiK7ArAAAAAH1DaE9lH6icleja0zxoV3JqjaEH', {
                action: action
            });
            
            console.log('reCAPTCHA token obtenido para acción:', action);
            return token;
        } catch (error) {
            console.error('Error ejecutando reCAPTCHA:', error);
            return null;
        }
    }
    
    static confirmDialog(message, onConfirm, onCancel) {
        const dialog = document.createElement('div');
        dialog.className = 'confirm-dialog';
        dialog.innerHTML = `
            <div class="dialog-content">
                <h3>Confirmar</h3>
                <p>${message}</p>
                <div class="dialog-actions">
                    <button class="btn-cancel">Cancelar</button>
                    <button class="btn-confirm">Confirmar</button>
                </div>
            </div>
        `;
        
        dialog.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        
        document.body.appendChild(dialog);
        
        // Event listeners
        dialog.querySelector('.btn-confirm').onclick = () => {
            document.body.removeChild(dialog);
            if (onConfirm) onConfirm();
        };
        
        dialog.querySelector('.btn-cancel').onclick = () => {
            document.body.removeChild(dialog);
            if (onCancel) onCancel();
        };
    }
}
