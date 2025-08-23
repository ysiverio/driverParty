
# DriverParty - Aplicación de Transporte

Una aplicación completa de transporte que conecta conductores con usuarios, similar a Uber o Lyft.

## Características Principales

### 🔐 Autenticación
- Inicio de sesión con Google
- Gestión de sesiones de usuario
- Cerrar sesión seguro

### 🗺️ Funcionalidades del Mapa
- Integración con Google Maps API
- Geolocalización en tiempo real
- Cálculo de rutas
- Marcadores dinámicos para usuarios y conductores

### 👤 Interfaz de Usuario (user/)

#### Menú Principal
- **📱 Menú lateral deslizable** con todas las opciones
- **👤 Perfil de usuario** - Ver información del perfil
- **📋 Historial de viajes** - Ver todos los viajes realizados
- **🔔 Notificaciones** - Sistema de notificaciones
- **🚪 Cerrar sesión** - Salir de la aplicación

#### Funcionalidades de Viaje
- **🚗 Solicitar conductor** - Crear nueva solicitud de viaje
- **📍 Ubicación automática** - Detección de ubicación actual
- **🎯 Destino opcional** - Especificar destino
- **⏱️ Estado del viaje** - Seguimiento en tiempo real
- **👨‍💼 Información del conductor** - Ver datos del conductor asignado
- **🚙 Información del vehículo** - Marca, modelo, color, placa
- **⭐ Sistema de calificación** - Calificar al conductor después del viaje
- **🔊 Notificaciones sonoras** - Sonido cuando el viaje es aceptado

### 🚗 Interfaz del Conductor (driver/)

#### Menú Principal
- **📱 Menú lateral deslizable** con todas las opciones
- **⭐ Mi Calificación** - Ver promedio de calificaciones
- **📋 Historial de viajes** - Ver todos los viajes completados
- **🚙 Mi Vehículo** - Gestionar información del vehículo
- **🔔 Notificaciones** - Sistema de notificaciones
- **🚪 Cerrar sesión** - Salir de la aplicación

#### Funcionalidades de Conductor
- **🟢/🔴 Toggle Online/Offline** - Activar/desactivar disponibilidad
- **📱 Solicitudes en tiempo real** - Ver nuevas solicitudes de viaje
- **✅ Aceptar viajes** - Aceptar solicitudes de usuarios
- **🗺️ Navegación** - Rutas automáticas hacia el usuario
- **📍 Compartir ubicación** - Ubicación en tiempo real
- **▶️/⏹️ Control de viaje** - Iniciar y finalizar viajes
- **📊 Estadísticas** - Número de viajes y calificación promedio
- **🔊 Notificaciones sonoras** - Sonido cuando llega una nueva solicitud

## Funcionalidades de Menú Implementadas

### ✅ Interfaz de Usuario
- [x] **Menú lateral funcional** - Abrir/cerrar con animación
- [x] **Modal de perfil** - Mostrar foto y nombre del usuario
- [x] **Historial de viajes** - Lista completa de viajes con estados
- [x] **Sistema de notificaciones** - Modal de notificaciones
- [x] **Sistema de calificación** - Calificar conductores con estrellas
- [x] **Cerrar sesión** - Funcionalidad completa

### ✅ Interfaz del Conductor
- [x] **Menú lateral funcional** - Abrir/cerrar con animación
- [x] **Modal de calificación** - Mostrar promedio y estadísticas
- [x] **Historial de viajes** - Lista completa de viajes con detalles
- [x] **Gestión de vehículo** - Formulario para actualizar información
- [x] **Sistema de notificaciones** - Modal de notificaciones
- [x] **Cerrar sesión** - Funcionalidad completa

## 🔊 Sistema de Notificaciones Sonoras

### Características Implementadas
- **🔊 Notificaciones automáticas** - Sonidos generados con Web Audio API
- **🎵 Tono personalizado** - Frecuencias específicas para cada tipo de notificación
- **🔇 Control de volumen** - Toggle para activar/desactivar sonidos
- **📱 Notificaciones toast** - Mensajes visuales acompañados de sonido
- **🔄 Fallback robusto** - Sistema alternativo si Web Audio API no está disponible

### Cuándo se Reproducen
#### Para Conductores:
- **🆕 Nueva solicitud de viaje** - Cuando llega una solicitud pendiente
- **📱 Solicitudes en tiempo real** - Solo cuando está en modo "En línea"

#### Para Usuarios:
- **✅ Viaje aceptado** - Cuando un conductor acepta la solicitud
- **🎉 Confirmación visual** - Toast notification con mensaje de confirmación

### Controles de Audio
- **🔊 Toggle de sonido** - Control visible en ambas interfaces
- **🎛️ Icono dinámico** - Cambia entre volumen activo/mudo
- **💾 Persistencia** - El estado se mantiene durante la sesión
- **🎨 Feedback visual** - Color del icono indica el estado

## Tecnologías Utilizadas

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Firebase (Firestore, Authentication)
- **Mapas**: Google Maps API
- **Iconos**: Font Awesome
- **Fuentes**: Google Fonts (Roboto)

## Estructura del Proyecto

```
driverParty/
├── driver/                 # Interfaz del conductor
│   ├── index.html         # Página principal del conductor
│   ├── app.js            # Lógica del conductor
│   └── style.css         # Estilos del conductor
├── user/                  # Interfaz del usuario
│   ├── index.html        # Página principal del usuario
│   ├── app.js           # Lógica del usuario
│   └── style.css        # Estilos del usuario
├── firebase-config.js    # Configuración de Firebase
└── README.md            # Documentación
```

## Configuración

1. **Firebase**: Configurar proyecto en `firebase-config.js`
2. **Google Maps API**: Agregar clave de API en los archivos HTML
3. **Autenticación**: Habilitar Google Auth en Firebase Console

## Características de UX/UI

### 🎨 Diseño Moderno
- **Interfaz limpia** y minimalista
- **Colores consistentes** con la marca
- **Tipografía legible** (Roboto)
- **Iconos intuitivos** (Font Awesome)

### 📱 Responsive Design
- **Adaptable a móviles** y tablets
- **Navegación táctil** optimizada
- **Modales centrados** y accesibles

### ⚡ Experiencia de Usuario
- **Animaciones suaves** en transiciones
- **Feedback visual** en interacciones
- **Estados de carga** con spinners
- **Mensajes informativos** claros

### 🔧 Funcionalidades Avanzadas
- **Sincronización en tiempo real** con Firestore
- **Geolocalización precisa** con Google Maps
- **Gestión de estado** robusta
- **Manejo de errores** completo

## Estado de Desarrollo

✅ **Completado**: Todas las funcionalidades de menú implementadas
✅ **Completado**: Sistema de autenticación funcional
✅ **Completado**: Integración con mapas
✅ **Completado**: Gestión de viajes en tiempo real
✅ **Completado**: Sistema de calificaciones
✅ **Completado**: Historiales de viajes
✅ **Completado**: Gestión de perfiles y vehículos

## Próximas Mejoras

- [ ] **Chat en tiempo real** entre usuario y conductor
- [ ] **Pagos integrados** con Stripe/PayPal
- [ ] **Notificaciones push** con Firebase Cloud Messaging
- [ ] **Modo oscuro** para mejor experiencia nocturna
- [ ] **Múltiples idiomas** (español/inglés)
- [ ] **Accesibilidad** mejorada (WCAG 2.1)
