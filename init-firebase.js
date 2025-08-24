// Script para inicializar las estructuras de datos en Firebase
// Este script debe ejecutarse una sola vez para configurar las colecciones iniciales

import { 
    auth, 
    db,
    doc,
    setDoc,
    collection
} from './firebase-config.js';

// Configuración inicial de precios
const initialPricingConfig = {
    DEFAULT_DRIVER_RATE_PER_KM: 2.50,
    DEFAULT_USER_RATE_PER_KM: 3.50,
    MINIMUM_FARE: 5.00,
    BASE_FARE: 2.00,
    SURGE_MULTIPLIER: 1.5,
    NIGHT_RATE_MULTIPLIER: 1.2,
    WAITING_FEE_PER_MINUTE: 0.50,
    CANCELLATION_FEE: 3.00,
    PLATFORM_COMMISSION_PERCENTAGE: 15,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
};

// Configuración general de la aplicación
const initialGeneralConfig = {
    APP_NAME: 'DriverParty',
    SUPPORT_EMAIL: 'support@driverparty.com',
    SUPPORT_PHONE: '+1-800-DRIVER',
    DEFAULT_ZOOM: 15,
    UPDATE_INTERVAL: 5000,
    SOUND_ENABLED: true,
    VIBRATION_ENABLED: true,
    TOAST_DURATION: 3000,
    MAX_WAITING_TIME: 300, // 5 minutos
    MAX_TRIP_DISTANCE: 100, // 100 km
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
};

async function initializeFirebaseData() {
    try {
        console.log('Inicializando estructuras de datos en Firebase...');
        
        // Crear configuración de precios
        const pricingRef = doc(db, "configuration", "pricing");
        await setDoc(pricingRef, initialPricingConfig);
        console.log('✅ Configuración de precios creada');
        
        // Crear configuración general
        const generalRef = doc(db, "configuration", "general");
        await setDoc(generalRef, initialGeneralConfig);
        console.log('✅ Configuración general creada');
        
        console.log('🎉 Inicialización completada exitosamente');
        console.log('Las siguientes estructuras han sido creadas:');
        console.log('- configuration/pricing');
        console.log('- configuration/general');
        
    } catch (error) {
        console.error('❌ Error durante la inicialización:', error);
        
        if (error.code === 'permission-denied') {
            console.error('Error de permisos. Verifica las reglas de seguridad de Firestore.');
        }
    }
}

// Ejecutar solo si se llama directamente
if (typeof window !== 'undefined') {
    // En el navegador, agregar un botón para ejecutar
    const initButton = document.createElement('button');
    initButton.textContent = 'Inicializar Firebase';
    initButton.onclick = initializeFirebaseData;
    initButton.style.cssText = `
        position: fixed;
        top: 20px;
        left: 20px;
        padding: 10px 20px;
        background: #28a745;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        z-index: 10000;
        font-size: 14px;
    `;
    document.body.appendChild(initButton);
}

export { initializeFirebaseData };
