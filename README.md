
# DriverParty - Plataforma de Transporte Profesional

## 🚀 Descripción

DriverParty es una plataforma completa de transporte que conecta conductores con usuarios de manera eficiente y segura. La aplicación incluye interfaces para conductores, usuarios y un panel de administración completo con sistema de configuración de precios dinámico.

## ✨ Características Principales

### 🎯 Funcionalidades Core
- **Sistema de Geolocalización en Tiempo Real**: Ubicación precisa de conductores y usuarios
- **Cálculo Automático de Rutas**: Optimización de rutas usando Google Maps API
- **Sistema de Calificaciones**: Calificación bidireccional entre conductores y usuarios
- **Notificaciones Sonoras**: Alertas audibles para nuevas solicitudes y actualizaciones
- **Modo de Navegación**: Interfaz optimizada para conductores durante viajes
- **Historial Completo**: Registro detallado de todos los viajes

### 💰 Sistema de Precios Dinámico
- **Configuración Flexible**: Precios por kilómetro configurables
- **Multiplicadores Dinámicos**: Hora pico y tarifas nocturnas
- **Cargos Adicionales**: Espera, cancelación y tarifa base
- **Vista Previa en Tiempo Real**: Cálculo instantáneo de precios
- **Comisiones Automáticas**: Cálculo de ganancias para conductores y plataforma

### 🛠️ Panel de Administración
- **Dashboard Completo**: Métricas en tiempo real
- **Gestión de Conductores**: Administración completa de conductores
- **Gestión de Usuarios**: Control de usuarios registrados
- **Historial de Viajes**: Consulta y exportación de datos
- **Analíticas Avanzadas**: Gráficos y estadísticas detalladas
- **Configuración General**: Personalización de la aplicación

## 🏗️ Arquitectura del Sistema

### 📁 Estructura de Archivos
```
driverParty/
├── admin/                 # Panel de administración
│   ├── index.html        # Interfaz de administración
│   ├── app.js           # Lógica de administración
│   └── style.css        # Estilos del panel admin
├── driver/               # Interfaz de conductores
│   ├── index.html       # Interfaz principal
│   ├── app.js          # Lógica de conductores
│   └── style.css       # Estilos de conductores
├── user/                 # Interfaz de usuarios
│   ├── index.html       # Interfaz principal
│   ├── app.js          # Lógica de usuarios
│   └── style.css       # Estilos de usuarios
├── config.js            # Configuración centralizada
├── firebase-config.js   # Configuración de Firebase
└── README.md           # Documentación
```

### 🔧 Tecnologías Utilizadas
- **Frontend**: HTML5, CSS3, JavaScript ES6+
- **Backend**: Firebase (Firestore, Authentication)
- **Mapas**: Google Maps API
- **Gráficos**: Chart.js
- **Iconos**: Font Awesome
- **Notificaciones**: Web Audio API

### 🔐 Sistema de Autenticación
- **Conductores y Usuarios**: Google Sign-In
- **Administración**: Email/Password con Firebase Auth
- **Recuperación de contraseña**: Sistema integrado
- **Sesiones seguras**: Manejo automático de tokens

### 🔥 Configuración de Firebase
- **Reglas de Seguridad**: `firestore.rules` - Control de acceso a datos
- **Índices Optimizados**: Crear manualmente en Firestore (ver sección de índices)
- **Estructuras Iniciales**: `init-firebase.html` - Configuración por defecto
- **Setup Administrador**: `setup-admin.html` - Crear usuario administrador
- **Colecciones Principales**:
  - `users` - Datos de usuarios
  - `drivers` - Datos de conductores
  - `trips` - Historial de viajes
  - `tripRequests` - Solicitudes activas
  - `configuration` - Configuración del sistema
  - `admins` - Usuarios administradores

### 📊 Índices de Firestore Necesarios
Crear manualmente en la consola de Firebase los siguientes índices compuestos:

**Colección: `trips`**
- `status` (Ascending) + `createdAt` (Descending)
- `driverId` (Ascending) + `createdAt` (Descending)
- `userId` (Ascending) + `createdAt` (Descending)

**Colección: `tripRequests`**
- `status` (Ascending) + `createdAt` (Descending)

## 🚀 Instalación y Configuración

### 📋 Prerrequisitos
- Node.js (versión 14 o superior)
- Cuenta de Firebase
- API Key de Google Maps
- Servidor web local o hosting

### ⚙️ Configuración Inicial

1. **Clonar el repositorio**
```bash
git clone https://github.com/ysiverio/driverParty.git
cd driverParty
```

2. **Configurar Firebase**
   - Crear proyecto en Firebase Console
   - Habilitar Authentication (Google Sign-In)
   - Habilitar Firestore Database
   - Configurar reglas de seguridad

3. **Configurar Google Maps API**
   - Obtener API Key de Google Cloud Console
   - Habilitar Maps JavaScript API
   - Habilitar Directions API
   - Habilitar Geocoding API

4. **Actualizar configuración**
   - Editar `firebase-config.js` con tus credenciales
   - Agregar API Key de Google Maps en las interfaces

5. **Configurar Firebase**
   - **Reglas de Seguridad**: Copiar el contenido de `firestore.rules` a la consola de Firebase
   - **Índices**: Crear manualmente los índices necesarios en Firestore (ver sección de índices)
   - **Estructuras de Datos**: Abrir `init-firebase.html` en el navegador y hacer clic en "Inicializar Firebase"

6. **Configurar usuario administrador**
   - Abrir `setup-admin.html` en el navegador
   - Hacer clic en "Configurar Administrador"
   - Usar las credenciales generadas para acceder al panel

7. **Ejecutar la aplicación**
```bash
# Usar servidor local (ejemplo con Python)
python -m http.server 8000

# O con Node.js
npx http-server
```

## 📱 Interfaces de Usuario

### 👨‍💼 Panel de Administración (`/admin`)
- **URL**: `http://localhost:8000/admin/`
- **Login**: `http://localhost:8000/admin/login.html`
- **Autenticación**: Email/Password con Firebase Auth
- **Credenciales por defecto**: 
  - Email: `admin@driverparty.com`
  - Contraseña: `AdminDriverParty2024!`
  - **⚠️ IMPORTANTE**: Cambiar la contraseña después del primer acceso
- **Dashboard**: Métricas en tiempo real
- **Configuración de Precios**: Gestión completa de tarifas
- **Gestión de Conductores**: Administración de conductores
- **Gestión de Usuarios**: Control de usuarios
- **Historial de Viajes**: Consulta de datos
- **Analíticas**: Gráficos y estadísticas
- **Configuración General**: Personalización

### 🚗 Interfaz de Conductores (`/driver`)
- **Autenticación**: Google Sign-In
- **Mapa Interactivo**: Ubicación en tiempo real
- **Solicitudes de Viaje**: Notificaciones y aceptación
- **Modo de Navegación**: Interfaz optimizada para viajes
- **Historial de Viajes**: Registro completo
- **Calificaciones**: Sistema de rating
- **Notificaciones**: Alertas sonoras
- **Perfil**: Gestión de información personal

### 👤 Interfaz de Usuarios (`/user`)
- **Autenticación**: Google Sign-In
- **Solicitud de Viaje**: Origen y destino
- **Seguimiento en Tiempo Real**: Ubicación del conductor
- **Información del Conductor**: Perfil y calificaciones
- **Modo de Navegación**: Durante el viaje
- **Historial**: Viajes realizados
- **Calificaciones**: Rating del conductor
- **Notificaciones**: Alertas sonoras

## 💰 Sistema de Precios

### 🎛️ Configuración Dinámica
```javascript
// Ejemplo de configuración
{
    DEFAULT_DRIVER_RATE_PER_KM: 2.50,    // Precio por km (conductor)
    DEFAULT_USER_RATE_PER_KM: 3.50,      // Precio por km (usuario)
    MINIMUM_FARE: 5.00,                  // Tarifa mínima
    BASE_FARE: 2.00,                     // Tarifa base
    SURGE_MULTIPLIER: 1.5,               // Multiplicador hora pico
    NIGHT_RATE_MULTIPLIER: 1.2,          // Multiplicador nocturno
    WAITING_FEE_PER_MINUTE: 0.50,        // Cargo por espera
    CANCELLATION_FEE: 3.00               // Cargo por cancelación
}
```

### 📊 Cálculo de Precios
- **Precio Usuario**: Base + (Distancia × Tarifa/km) + Cargos adicionales
- **Ganancia Conductor**: Distancia × Tarifa conductor + Cargos de espera
- **Comisión Plataforma**: Precio usuario - Ganancia conductor

## 🔧 Funcionalidades Avanzadas

### 🎵 Sistema de Notificaciones
- **Notificaciones Sonoras**: Tones personalizables
- **Alertas Visuales**: Toasts informativos
- **Vibración**: Soporte para dispositivos móviles
- **Configuración**: Control de volumen y duración

### 🗺️ Modo de Navegación
- **Zoom Automático**: Ajuste automático del mapa
- **Información en Tiempo Real**: Distancia, duración, siguiente instrucción
- **Indicadores Visuales**: Estado de navegación
- **Optimización**: Interfaz simplificada para conducción

### 📈 Analíticas y Reportes
- **Dashboard en Tiempo Real**: Métricas actualizadas
- **Gráficos Interactivos**: Chart.js para visualización
- **Exportación de Datos**: Funcionalidad de descarga
- **Filtros Avanzados**: Búsqueda y filtrado de datos

## 🔒 Seguridad

### 🛡️ Medidas Implementadas
- **Autenticación Google**: Login seguro
- **Reglas de Firestore**: Validación de datos
- **Validación de Entrada**: Sanitización de datos
- **Control de Acceso**: Permisos por rol
- **Encriptación**: Datos sensibles protegidos

### 📋 Reglas de Firestore
```javascript
// Ejemplo de reglas de seguridad
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Usuarios solo pueden leer/escribir sus propios datos
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Conductores solo pueden leer/escribir sus propios datos
    match /drivers/{driverId} {
      allow read, write: if request.auth != null && request.auth.uid == driverId;
    }
    
    // Viajes: usuarios y conductores involucrados pueden leer/escribir
    match /trips/{tripId} {
      allow read, write: if request.auth != null && 
        (resource.data.userId == request.auth.uid || 
         resource.data.driverId == request.auth.uid);
    }
  }
}
```

## 📊 Estado de Desarrollo

### ✅ Funcionalidades Completadas
- [x] Sistema de autenticación Google
- [x] Geolocalización en tiempo real
- [x] Cálculo de rutas optimizadas
- [x] Sistema de calificaciones
- [x] Notificaciones sonoras
- [x] Modo de navegación
- [x] Historial de viajes
- [x] Panel de administración
- [x] Sistema de precios dinámico
- [x] Gestión de conductores y usuarios
- [x] Analíticas y reportes
- [x] Configuración general
- [x] Interfaz responsive
- [x] Validaciones de seguridad

### 🚧 Funcionalidades en Desarrollo
- [ ] Sistema de pagos integrado
- [ ] Chat en tiempo real
- [ ] Notificaciones push
- [ ] Modo offline
- [ ] Integración con GPS nativo
- [ ] Sistema de recompensas
- [ ] API REST pública
- [ ] Aplicación móvil nativa

### 📋 Próximas Funcionalidades
- [ ] Integración con Stripe/PayPal
- [ ] Sistema de cupones y descuentos
- [ ] Programación de viajes
- [ ] Viajes compartidos
- [ ] Sistema de fidelización
- [ ] Reportes avanzados
- [ ] Integración con redes sociales
- [ ] Sistema de soporte en vivo

## 🤝 Contribución

### 📝 Cómo Contribuir
1. Fork el proyecto
2. Crear una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir un Pull Request

### 🐛 Reportar Bugs
- Usar el sistema de Issues de GitHub
- Incluir pasos para reproducir el error
- Adjuntar capturas de pantalla si es necesario
- Especificar el navegador y sistema operativo

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 📞 Soporte

### 📧 Contacto
- **Email**: support@driverparty.com
- **Teléfono**: +1-800-DRIVER
- **Documentación**: [docs.driverparty.com](https://docs.driverparty.com)

### 🔗 Enlaces Útiles
- **Sitio Web**: [driverparty.com](https://driverparty.com)
- **Panel de Administración**: [admin.driverparty.com](https://admin.driverparty.com)
- **API Documentation**: [api.driverparty.com](https://api.driverparty.com)

## 🙏 Agradecimientos

- **Google Maps API** por la funcionalidad de mapas
- **Firebase** por el backend robusto
- **Font Awesome** por los iconos
- **Chart.js** por las visualizaciones
- **Comunidad de desarrolladores** por el soporte

---

**DriverParty v2.0.0** - Conectando el mundo, un viaje a la vez 🚗✨
