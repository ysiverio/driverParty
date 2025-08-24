# Persistencia de Viajes en Curso

## 🎯 **Objetivo**
Implementar un sistema de persistencia que permita a usuarios y conductores recuperar automáticamente su viaje en curso cuando actualicen el navegador o cierren y vuelvan a abrir la aplicación.

## 🔧 **Funcionalidades Implementadas**

### **1. Almacenamiento Local**
- **localStorage**: Persistencia entre sesiones del navegador
- **Claves únicas**: 
  - Usuario: `driverParty_user_trip_state`
  - Driver: `driverParty_driver_trip_state`

### **2. Estados Persistidos**

#### **Usuario (`user/app.js`)**
```javascript
const tripState = {
    currentTripId,           // ID del viaje actual
    currentTripRequestId,    // ID de la solicitud de viaje
    currentTripDriverId,     // ID del conductor asignado
    navigationMode,          // Modo de navegación activo
    timestamp: Date.now()    // Timestamp para validación
};
```

#### **Driver (`driver/app.js`)**
```javascript
const tripState = {
    activeTripId,           // ID del viaje activo
    navigationMode,         // Modo de navegación activo
    timestamp: Date.now()   // Timestamp para validación
};
```

### **3. Funciones de Persistencia**

#### **Guardar Estado**
```javascript
function saveTripState() {
    const tripState = {
        // ... datos del estado
        timestamp: Date.now()
    };
    
    try {
        localStorage.setItem(TRIP_STORAGE_KEY, JSON.stringify(tripState));
        console.log('Estado del viaje guardado:', tripState);
    } catch (error) {
        console.error('Error guardando estado del viaje:', error);
    }
}
```

#### **Cargar Estado**
```javascript
function loadTripState() {
    try {
        const savedState = localStorage.getItem(TRIP_STORAGE_KEY);
        if (savedState) {
            const tripState = JSON.parse(savedState);
            
            // Verificar si el estado no es muy antiguo (máximo 24 horas)
            const isRecent = (Date.now() - tripState.timestamp) < (24 * 60 * 60 * 1000);
            
            if (isRecent) {
                // Restaurar variables de estado
                return true;
            } else {
                clearTripState();
            }
        }
    } catch (error) {
        console.error('Error cargando estado del viaje:', error);
        clearTripState();
    }
    return false;
}
```

#### **Limpiar Estado**
```javascript
function clearTripState() {
    try {
        localStorage.removeItem(TRIP_STORAGE_KEY);
        console.log('Estado del viaje limpiado');
    } catch (error) {
        console.error('Error limpiando estado del viaje:', error);
    }
}
```

### **4. Verificación y Restauración**

#### **Verificación Automática**
```javascript
async function checkAndRestoreActiveTrip() {
    if (!currentUser) return;
    
    const hasActiveTrip = loadTripState();
    if (!hasActiveTrip) return;
    
    // Verificar si el viaje aún existe en Firestore
    if (currentTripId) {
        const tripDoc = await getDoc(doc(db, "trips", currentTripId));
        if (tripDoc.exists()) {
            const tripData = tripDoc.data();
            
            // Si el viaje no está completado o cancelado, restaurarlo
            if (tripData.status !== 'completed' && tripData.status !== 'cancelled') {
                await restoreActiveTrip(tripData);
                return;
            }
        }
    }
    
    // Verificar solicitud de viaje activa
    if (currentTripRequestId) {
        const requestDoc = await getDoc(doc(db, "tripRequests", currentTripRequestId));
        if (requestDoc.exists()) {
            const requestData = requestDoc.data();
            
            if (requestData.status !== 'completed' && requestData.status !== 'cancelled' && requestData.status !== 'expired') {
                await restoreActiveTripRequest(requestData);
                return;
            }
        }
    }
    
    // Si no hay viaje válido, limpiar estado
    clearTripState();
    resetTripState();
}
```

### **5. Restauración de Estados**

#### **Restaurar Viaje Activo (Usuario)**
```javascript
async function restoreActiveTrip(tripData) {
    try {
        // Restaurar UI del viaje
        tripPanel.style.display = 'block';
        requestPanel.style.display = 'none';
        
        // Actualizar UI con datos del viaje
        updateTripUI(tripData);
        
        // Restaurar información del conductor
        if (tripData.driverInfo && !hasShownDriverInfo) {
            displayDriverInfo(tripData.driverInfo);
        }
        
        // Restaurar ruta y marcadores
        if (tripData.routePolyline) {
            drawRoute(tripData.routePolyline);
        }
        if (tripData.driverLocation) {
            updateDriverMarker(tripData.driverLocation);
        }
        
        // Activar modo navegación si es necesario
        if (tripData.status === 'in_progress' && !navigationMode) {
            activateNavigationMode();
        }
        
        // Reconectar listener del viaje
        listenToTripUpdates(currentTripId);
        
        showNotificationToast('Viaje en curso restaurado');
    } catch (error) {
        console.error('Error restaurando viaje:', error);
        clearTripState();
        resetTripState();
    }
}
```

#### **Restaurar Solicitud de Viaje (Usuario)**
```javascript
async function restoreActiveTripRequest(requestData) {
    try {
        // Restaurar UI de la solicitud
        requestPanel.style.display = 'none';
        tripInfoContainer.style.display = 'block';
        
        // Actualizar estado según el status
        if (requestData.status === 'accepted') {
            tripStatusHeading.textContent = 'Conductor Encontrado';
            tripStatusDetails.textContent = 'Por favor, confirma los detalles y el pago para comenzar.';
            
            // Mostrar modal de confirmación de pago
            const driverRef = doc(db, "drivers", requestData.driverId);
            const driverDoc = await getDoc(driverRef);
            const driverData = driverDoc.exists() ? driverDoc.data() : {};
            showPaymentConfirmationModal(requestData, driverData);
        } else {
            tripStatusHeading.textContent = 'Buscando Conductor';
            tripStatusDetails.textContent = 'Estamos buscando un conductor disponible...';
        }
        
        // Reconectar listener de la solicitud
        listenToTripRequestUpdates(currentTripRequestId);
        
        showNotificationToast('Solicitud de viaje restaurada');
    } catch (error) {
        console.error('Error restaurando solicitud de viaje:', error);
        clearTripState();
        resetTripState();
    }
}
```

#### **Restaurar Viaje Activo (Driver)**
```javascript
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
        
        // Obtener ubicación actual y calcular ruta
        navigator.geolocation.getCurrentPosition((pos) => {
            const location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            calculateAndDisplayRoute(location, userLocation);
            startSharingLocation(location);
        }, (err) => console.error("Geolocation error:", err));
        
        // Activar modo navegación si es necesario
        if (tripData.status === 'in_progress' && !navigationMode) {
            activateNavigationMode(userLocation);
        }
        
        // Escuchar rechazo del usuario
        listenForTripRejection(activeTripId);
        
        showNotificationToast('Viaje en curso restaurado');
    } catch (error) {
        console.error('Error restaurando viaje:', error);
        clearTripState();
        resetTripState();
    }
}
```

## 🔄 **Puntos de Guardado Automático**

### **Usuario**
- ✅ **Solicitud de viaje**: Al crear una nueva solicitud
- ✅ **Confirmación de pago**: Al confirmar el pago y crear el viaje
- ✅ **Modo navegación**: Al activar el modo de navegación
- ✅ **Limpieza**: Al resetear el estado o cerrar sesión

### **Driver**
- ✅ **Aceptar viaje**: Al aceptar una solicitud de viaje
- ✅ **Modo navegación**: Al activar el modo de navegación
- ✅ **Limpieza**: Al resetear el estado o cerrar sesión

## 🛡️ **Validaciones y Seguridad**

### **1. Validación de Tiempo**
- **Límite**: 24 horas máximo
- **Propósito**: Evitar estados obsoletos
- **Acción**: Limpiar automáticamente estados antiguos

### **2. Verificación en Firestore**
- **Validación**: Verificar que el viaje/solicitud aún existe
- **Estados válidos**: Solo restaurar viajes no completados/cancelados
- **Fallback**: Limpiar estado si no es válido

### **3. Manejo de Errores**
- **Try-catch**: En todas las operaciones de localStorage
- **Logging**: Información detallada para debugging
- **Recuperación**: Limpiar estado en caso de error

## 📱 **Experiencia del Usuario**

### **1. Recuperación Automática**
- **Momento**: Al iniciar sesión (2 segundos después)
- **Notificación**: "Viaje en curso restaurado"
- **Estado**: UI completamente restaurada

### **2. Transparencia**
- **Sin intervención**: No requiere acción del usuario
- **Continuidad**: El viaje continúa donde se quedó
- **Sincronización**: Estado actualizado con Firestore

### **3. Robustez**
- **Fallbacks**: Múltiples verificaciones
- **Limpieza**: Estados inválidos se eliminan automáticamente
- **Logging**: Información detallada para debugging

## 🔧 **Configuración**

### **Claves de Almacenamiento**
```javascript
// Usuario
const TRIP_STORAGE_KEY = 'driverParty_user_trip_state';

// Driver
const TRIP_STORAGE_KEY = 'driverParty_driver_trip_state';
```

### **Tiempo de Validación**
```javascript
// 24 horas en milisegundos
const MAX_AGE = 24 * 60 * 60 * 1000;
```

### **Delay de Verificación**
```javascript
// 2 segundos para permitir inicialización del mapa
setTimeout(async () => {
    await checkAndRestoreActiveTrip();
}, 2000);
```

## 📊 **Casos de Uso Cubiertos**

### **1. Usuario Actualiza Navegador**
1. Usuario tiene viaje en curso ✅
2. Actualiza navegador ✅
3. Inicia sesión ✅
4. Sistema detecta viaje activo ✅
5. Restaura estado completo ✅
6. Continúa el viaje ✅

### **2. Driver Actualiza Navegador**
1. Driver tiene viaje activo ✅
2. Actualiza navegador ✅
3. Inicia sesión ✅
4. Sistema detecta viaje activo ✅
5. Restaura estado completo ✅
6. Continúa el viaje ✅

### **3. Solicitud Pendiente**
1. Usuario solicita viaje ✅
2. Cierra navegador ✅
3. Vuelve a abrir ✅
4. Sistema restaura solicitud ✅
5. Continúa buscando conductor ✅

### **4. Viaje Completado**
1. Viaje termina ✅
2. Estado se limpia automáticamente ✅
3. No se restaura en próxima sesión ✅

## 🎯 **Beneficios**

### **1. Experiencia de Usuario**
- ✅ **Continuidad**: No se pierden viajes por actualizar
- ✅ **Conveniencia**: Recuperación automática
- ✅ **Confianza**: Sistema robusto y confiable

### **2. Funcionalidad**
- ✅ **Persistencia**: Estados se mantienen entre sesiones
- ✅ **Sincronización**: Estado actualizado con base de datos
- ✅ **Validación**: Solo estados válidos se restauran

### **3. Robustez**
- ✅ **Manejo de errores**: Try-catch en todas las operaciones
- ✅ **Limpieza automática**: Estados obsoletos se eliminan
- ✅ **Logging**: Información detallada para debugging

## 📝 **Archivos Modificados**

### **1. `user/app.js`**
- ✅ Funciones de persistencia (`saveTripState`, `loadTripState`, `clearTripState`)
- ✅ Verificación y restauración (`checkAndRestoreActiveTrip`, `restoreActiveTrip`, `restoreActiveTripRequest`)
- ✅ Puntos de guardado automático
- ✅ Integración con autenticación

### **2. `driver/app.js`**
- ✅ Funciones de persistencia (`saveTripState`, `loadTripState`, `clearTripState`)
- ✅ Verificación y restauración (`checkAndRestoreActiveTrip`, `restoreActiveTrip`)
- ✅ Puntos de guardado automático
- ✅ Integración con autenticación

## 🚀 **Estado Actual**

✅ **Sistema completo**: Persistencia implementada para usuario y driver
✅ **Recuperación automática**: Estados se restauran al iniciar sesión
✅ **Validación robusta**: Solo estados válidos se restauran
✅ **Manejo de errores**: Try-catch en todas las operaciones
✅ **Limpieza automática**: Estados obsoletos se eliminan
✅ **Experiencia fluida**: Sin intervención del usuario

## 🔮 **Próximos Pasos**

1. **Testing**: Probar recuperación en diferentes escenarios
2. **Monitoreo**: Observar logs para confirmar funcionamiento
3. **Optimización**: Ajustar tiempos de validación si es necesario
4. **Feedback**: Recopilar feedback de usuarios sobre la experiencia
