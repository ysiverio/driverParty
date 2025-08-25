# DriverParty - Navegación Tipo "Modo Conducción"

Una aplicación web para navegación tipo "modo conducción" emulada usando Google Maps JavaScript API y Firebase Firestore. Diseñada para el caso de uso "conductor designado" donde llevamos al cliente en su propio auto.

## 🚀 Características

- **Navegación en tiempo real**: Vista de conducción con zoom 16-17, centrada en el auto
- **Sincronización bidireccional**: Driver y cliente ven las mismas instrucciones y ubicación
- **Actualización de posición**: Cada 1.5 segundos con throttling inteligente
- **Recálculo automático**: Si el desvío supera 40m de la ruta
- **Avance automático de pasos**: Basado en proximidad (30m al final del step)
- **Interfaz moderna**: Diseño responsive con modo oscuro

## 🛠️ Stack Tecnológico

- **Frontend**: HTML5 + CSS3 + JavaScript nativo (ES Modules)
- **Mapas**: Google Maps JavaScript API (DirectionsService + DirectionsRenderer + Geometry Library)
- **Backend**: Firebase Firestore (tiempo real)
- **Autenticación**: Firebase Auth (anónimo)
- **Hosting**: Cualquier servidor web estático

## 📁 Estructura del Proyecto

```
driverParty/
├── public/
│   ├── index.html          # Página principal de selección de rol
│   ├── driver.html         # Interfaz del conductor
│   ├── client.html         # Interfaz del cliente
│   └── styles.css          # Estilos globales
├── src/
│   ├── firebase.js         # Configuración y servicios de Firebase
│   ├── maps.js             # Operaciones de Google Maps
│   ├── directions.js       # Cálculo de rutas y direcciones
│   ├── location.js         # Seguimiento de ubicación
│   ├── trips.js            # Operaciones de viajes
│   └── utils.js            # Utilidades y formateo
├── env.example             # Variables de entorno de ejemplo
└── README.md               # Este archivo
```

## 🔧 Configuración

### 1. Configurar Firebase

1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com/)
2. Habilita Firestore Database
3. Configura las reglas de seguridad (ver sección de reglas)
4. Obtén la configuración de tu proyecto

### 2. Configurar Google Maps API

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un proyecto o selecciona el existente
3. Habilita las siguientes APIs:
   - Maps JavaScript API
   - Directions API
   - Geometry Library
4. Crea una clave de API y restríngela por dominio

### 3. Configurar Variables de Entorno

Copia `env.example` a `.env` y configura tus valores:

```bash
# Google Maps API
VITE_GOOGLE_MAPS_API_KEY=tu_clave_de_google_maps

# Firebase
VITE_FIREBASE_API_KEY=tu_clave_de_firebase
VITE_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu-proyecto-id
# ... resto de configuración
```

### 4. Reglas de Firestore

Configura estas reglas en tu Firestore:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Colección de viajes
    match /trips/{tripId} {
      // Permitir lectura a clientId y driverId del viaje
      allow read: if request.auth != null && 
        (resource.data.clientId == request.auth.uid || 
         resource.data.driverId == request.auth.uid);
      
      // Permitir escritura al clientId o driverId
      allow write: if request.auth != null && 
        (resource.data.clientId == request.auth.uid || 
         resource.data.driverId == request.auth.uid);
      
      // Subcolección de presencia del conductor
      match /presence/driver {
        // Solo el driverId puede escribir su presencia
        allow write: if request.auth != null && 
          get(/databases/$(database)/documents/trips/$(tripId)).data.driverId == request.auth.uid;
        
        // Permitir lectura a clientId y driverId
        allow read: if request.auth != null && 
          (get(/databases/$(database)/documents/trips/$(tripId)).data.clientId == request.auth.uid || 
           get(/databases/$(database)/documents/trips/$(tripId)).data.driverId == request.auth.uid);
      }
    }
  }
}
```

## 🚀 Instalación y Ejecución

### Opción 1: Servidor Local Simple

```bash
# Clona el repositorio
git clone <tu-repositorio>
cd driverParty

# Instala un servidor local (si no tienes uno)
npm install -g http-server

# Ejecuta el servidor
http-server public -p 8080

# Abre http://localhost:8080
```

### Opción 2: Con Vite (Recomendado)

```bash
# Instala dependencias
npm install

# Ejecuta en modo desarrollo
npm run dev

# Construye para producción
npm run build
```

### Opción 3: Firebase Hosting

```bash
# Instala Firebase CLI
npm install -g firebase-tools

# Inicia sesión
firebase login

# Inicializa el proyecto
firebase init hosting

# Despliega
firebase deploy
```

## 📱 Uso

### 1. Crear un Viaje

Para probar la aplicación, necesitas crear un viaje en Firestore con esta estructura:

```javascript
{
  "tripId": "trip_123456",
  "clientId": "client_uid",
  "driverId": null,
  "status": "requested",
  "pickup": {
    "lat": 40.7128,
    "lng": -74.0060,
    "address": "Nueva York, NY"
  },
  "destination": {
    "lat": 40.7589,
    "lng": -73.9851,
    "address": "Times Square, NY"
  },
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### 2. Flujo de Uso

1. **Abrir la aplicación**: `http://localhost:8080`
2. **Seleccionar rol**: Conductor o Cliente
3. **Ingresar ID del viaje**: Ej: `trip_123456`
4. **Seguir las instrucciones**:
   - **Conductor**: Aceptar → Llegué → Iniciar → Finalizar
   - **Cliente**: Ver progreso en tiempo real

### 3. Simular Movimiento

Para simular el movimiento del conductor durante las pruebas:

```javascript
// En la consola del navegador del conductor
function simulateMovement() {
  const positions = [
    { lat: 40.7128, lng: -74.0060 },
    { lat: 40.7150, lng: -74.0080 },
    { lat: 40.7180, lng: -74.0100 },
    // ... más posiciones
  ];
  
  let index = 0;
  setInterval(() => {
    if (index < positions.length) {
      // Simular actualización de posición
      const position = positions[index];
      // Esto actualizará el mapa automáticamente
      index++;
    }
  }, 2000);
}

simulateMovement();
```

## 🔄 Flujo de Estados del Viaje

```
requested → accepted → en_route_to_pickup → arrived → in_progress → completed
```

### Estados Detallados:

- **`requested`**: Cliente solicitó viaje, esperando conductor
- **`accepted`**: Conductor aceptó, calculando ruta al pickup
- **`en_route_to_pickup`**: Conductor en camino al cliente
- **`arrived`**: Conductor llegó al pickup, calculando ruta al destino
- **`in_progress`**: Viaje en progreso hacia el destino
- **`completed`**: Viaje finalizado

## 📊 Estructura de Datos

### Documento Trip (`trips/{tripId}`)

```javascript
{
  "tripId": "string",
  "clientId": "string",
  "driverId": "string",
  "status": "requested|accepted|en_route_to_pickup|arrived|in_progress|completed|canceled_by_client|canceled_by_driver",
  "pickup": { "lat": 0, "lng": 0, "address": "" },
  "destination": { "lat": 0, "lng": 0, "address": "" },
  "driverLocation": { "lat": 0, "lng": 0, "heading": 0, "ts": 0 },
  "routeToPickup": { "polyline": "", "steps": [] },
  "routeToDestination": { "polyline": "", "steps": [] },
  "currentLegIndex": 0,
  "currentStepIndex": 0,
  "metrics": { "distanceMeters": 0, "durationSec": 0, "actualDistanceMeters": 0, "actualDurationSec": 0 },
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### Presencia del Conductor (`trips/{tripId}/presence/driver`)

```javascript
{
  "lat": 0,
  "lng": 0,
  "heading": 0,
  "speed": 0,
  "ts": "timestamp"
}
```

## 🎯 Funcionalidades Clave

### Navegación Inteligente

- **Vista de conducción**: Zoom 16-17, centrada en el auto
- **Instrucciones paso a paso**: Con iconos y distancias
- **Avance automático**: Basado en proximidad al final del step
- **Recálculo**: Si el desvío supera 40m

### Sincronización en Tiempo Real

- **Posición del conductor**: Actualizada cada 1.5s
- **Estado del viaje**: Sincronizado entre cliente y conductor
- **Instrucciones**: Mismas para ambos usuarios
- **Progreso**: Visualización del avance del viaje

### Optimizaciones

- **Throttling**: Solo publica cambios significativos (>8m o >5° heading)
- **Caché de rutas**: Evita recálculos innecesarios
- **Lazy loading**: Carga de APIs bajo demanda
- **Responsive**: Funciona en móviles y desktop

## 🧪 Pruebas

### Pruebas Manuales

1. **Crear viaje de prueba**:
   ```javascript
   // En Firestore Console
   {
     "tripId": "test_trip_001",
     "clientId": "test_client",
     "status": "requested",
     "pickup": { "lat": 40.7128, "lng": -74.0060, "address": "Nueva York" },
     "destination": { "lat": 40.7589, "lng": -73.9851, "address": "Times Square" }
   }
   ```

2. **Abrir dos ventanas**:
   - `http://localhost:8080/driver.html?tripId=test_trip_001`
   - `http://localhost:8080/client.html?tripId=test_trip_001`

3. **Seguir el flujo completo**:
   - Aceptar viaje (driver)
   - Ver ruta al pickup
   - Marcar llegada
   - Iniciar viaje
   - Finalizar

### Pruebas de Movimiento

```javascript
// Simular movimiento realista
const route = [
  { lat: 40.7128, lng: -74.0060 },
  { lat: 40.7135, lng: -74.0065 },
  { lat: 40.7142, lng: -74.0070 },
  // ... más puntos
];

let currentIndex = 0;
const interval = setInterval(() => {
  if (currentIndex < route.length) {
    // Actualizar posición
    currentIndex++;
  } else {
    clearInterval(interval);
  }
}, 3000);
```

## 🚨 Limitaciones

### Modo Conducción Nativo

- **No disponible en API**: Google Maps no proporciona modo conducción nativo
- **Emulación**: Esta aplicación emula la experiencia
- **Alternativa**: Usar deep links a apps nativas (Google Maps, Apple Maps)

### Costos

- **Firestore**: Limitar escrituras a 1-2 Hz por conductor
- **Google Maps**: ~$5 por 1000 cargas de página
- **Optimización**: Usar throttling y caché

### Compatibilidad

- **Navegadores**: Chrome, Firefox, Safari, Edge (modernos)
- **Móviles**: iOS Safari, Chrome Mobile
- **Geolocalización**: Requiere HTTPS en producción

## 🔧 Personalización

### Cambiar Colores

Edita `public/styles.css`:

```css
:root {
  --primary-color: #4CAF50;
  --secondary-color: #2196F3;
  --background-color: #000;
  --text-color: #fff;
}
```

### Agregar Funcionalidades

1. **Notificaciones push**: Integrar Firebase Cloud Messaging
2. **Chat**: Agregar colección de mensajes
3. **Pagos**: Integrar Stripe/PayPal
4. **Calificaciones**: Sistema de rating post-viaje

## 📞 Soporte

### Problemas Comunes

1. **"Google Maps API key not found"**:
   - Verifica que `VITE_GOOGLE_MAPS_API_KEY` esté configurado
   - Asegúrate de que la clave tenga las APIs habilitadas

2. **"Firebase not initialized"**:
   - Verifica la configuración de Firebase en `src/firebase.js`
   - Asegúrate de que las reglas de Firestore permitan acceso

3. **"Geolocation not supported"**:
   - Usa HTTPS en producción
   - Verifica permisos del navegador

### Debugging

```javascript
// Habilitar logs detallados
localStorage.setItem('debug', 'true');

// Ver estado del viaje
console.log('Trip data:', tripData);

// Ver posición actual
console.log('Current position:', currentPosition);
```

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver `LICENSE` para más detalles.

## 🤝 Contribuciones

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

---

**DriverParty** - Navegación inteligente para conductores designados 🚗✨
