// Configuración de reCAPTCHA Enterprise
export const RECAPTCHA_CONFIG = {
    // Clave del sitio de reCAPTCHA Enterprise
    SITE_KEY: '6LfiK7ArAAAAAH1DaE9lH6icleja0zxoV3JqjaEH',
    
    // Acciones disponibles para diferentes tipos de autenticación
    ACTIONS: {
        DRIVER_LOGIN: 'driver_login',
        USER_LOGIN: 'user_login',
        ADMIN_LOGIN: 'admin_login',
        TRIP_REQUEST: 'trip_request',
        PAYMENT: 'payment',
        SIGNUP: 'signup'
    },
    
    // Configuración de puntuación mínima (0.0 a 1.0)
    MIN_SCORE: 0.5,
    
    // Tiempo de expiración del token (en segundos)
    TOKEN_EXPIRY: 120,
    
    // Configuración de reintentos
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000
};

// Función para ejecutar reCAPTCHA con configuración
export async function executeRecaptcha(action = RECAPTCHA_CONFIG.ACTIONS.DRIVER_LOGIN) {
    try {
        if (typeof grecaptcha === 'undefined') {
            console.warn('reCAPTCHA no está disponible');
            return null;
        }
        
        const token = await grecaptcha.enterprise.execute(RECAPTCHA_CONFIG.SITE_KEY, {
            action: action
        });
        
        console.log('reCAPTCHA token obtenido para acción:', action);
        return token;
    } catch (error) {
        console.error('Error ejecutando reCAPTCHA:', error);
        return null;
    }
}

// Función para validar el token del lado del servidor (ejemplo)
export async function validateRecaptchaToken(token, action) {
    // Esta función debería implementarse en el backend
    // para validar el token con la API de reCAPTCHA Enterprise
    
    try {
        // Ejemplo de validación (implementar en el servidor)
        const response = await fetch('/api/validate-recaptcha', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                token: token,
                action: action
            })
        });
        
        const result = await response.json();
        return result.success && result.score >= RECAPTCHA_CONFIG.MIN_SCORE;
    } catch (error) {
        console.error('Error validando reCAPTCHA:', error);
        return false;
    }
}

// Función para mostrar mensajes de error de reCAPTCHA
export function showRecaptchaError(message = 'Error de verificación de seguridad') {
    // Puedes personalizar cómo mostrar los errores
    alert(message + '. Por favor, intenta nuevamente.');
}

// Función para verificar si reCAPTCHA está disponible
export function isRecaptchaAvailable() {
    return typeof grecaptcha !== 'undefined' && grecaptcha.enterprise;
}
