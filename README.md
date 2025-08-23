
# DriverParty

DriverParty es una aplicación web simple que simula la funcionalidad básica de una aplicación de transporte tipo Uber. Consta de dos interfaces separadas: una para los usuarios que solicitan un viaje y otra para los conductores que aceptan y completan los viajes.

## Características Principales

- **Dos Interfaces Separadas:** Aplicaciones web independientes para el `Usuario` y el `Conductor`.
- **Autenticación de Google:** Inicio de sesión seguro para usuarios y conductores utilizando Firebase Authentication.
- **Geolocalización en Tiempo Real:** Seguimiento de la ubicación del conductor en el mapa del usuario utilizando Firestore y la API de Geolocalización del navegador.
- **Cálculo de Rutas:** Muestra la ruta desde la ubicación del conductor hasta el punto de recogida del usuario utilizando la API de Direcciones de Google Maps.
- **Flujo de Viaje Completo:**
    - El usuario solicita un conductor.
    - El conductor ve la solicitud y la acepta.
    - La ruta se muestra en ambos mapas.
    - El conductor puede marcar el viaje como "iniciado" y "completado".
- **Sistema de Calificación:** Al finalizar el viaje, el usuario puede calificar al conductor con una puntuación de 1 a 5 estrellas.
- **Interfaz Moderna:** La interfaz de usuario ha sido rediseñada para ser intuitiva y similar a las aplicaciones de transporte modernas.

## Estructura del Proyecto

```
/
├── driver/         # Contiene los archivos de la aplicación del conductor
│   ├── app.js
│   ├── index.html
│   └── style.css
├── user/           # Contiene los archivos de la aplicación del usuario
│   ├── app.js
│   ├── index.html
│   └── style.css
├── firebase-config.js  # Archivo de configuración de Firebase
└── README.md
```

## Configuración

Para ejecutar esta aplicación, necesitas configurar tus propias claves de API para Firebase y Google Maps.

### 1. Firebase

La aplicación utiliza Firebase para la autenticación y como base de datos en tiempo real (Firestore).

1.  Crea un nuevo proyecto en la [Consola de Firebase](https://console.firebase.google.com/).
2.  Crea una nueva aplicación web dentro de tu proyecto de Firebase.
3.  Copia las credenciales de configuración de tu aplicación.
4.  Pega tus credenciales en el archivo `firebase-config.js`. Debería tener la siguiente estructura:

    ```javascript
    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
    import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
    import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

    const firebaseConfig = {
      apiKey: "TU_API_KEY",
      authDomain: "TU_AUTH_DOMAIN",
      projectId: "TU_PROJECT_ID",
      storageBucket: "TU_STORAGE_BUCKET",
      messagingSenderId: "TU_MESSAGING_SENDER_ID",
      appId: "TU_APP_ID"
    };

    const app = initializeApp(firebaseConfig);
    export const auth = getAuth(app);
    export const db = getFirestore(app);
    ```

5.  En la configuración de Firestore, asegúrate de establecer las reglas de seguridad adecuadas para permitir la lectura y escritura en la colección `trips` y `drivers`.

### 2. Google Maps

La aplicación utiliza la API de Google Maps para mostrar los mapas, las rutas y los marcadores.

1.  Ve a la [Consola de Google Cloud](https://console.cloud.google.com/) y crea un nuevo proyecto.
2.  Habilita las siguientes APIs para tu proyecto:
    - **Maps JavaScript API**
    - **Directions API**
    - **Geolocation API**
3.  Crea una clave de API (API Key).
4.  Reemplaza la clave `AIzaSyA52yOcPfK4EoW-KrsjlWJ2oyIs5P1Qvc8` en los archivos `user/index.html` y `driver/index.html` con tu propia clave de API.

    Busca esta línea en ambos archivos:
    ```html
    <script async defer src="https://maps.googleapis.com/maps/api/js?key=TU_NUEVA_API_KEY&callback=initMap&libraries=geometry"></script>
    ```

## Cómo Ejecutar el Proyecto

Dado que este es un proyecto basado en HTML, CSS y JavaScript del lado del cliente, no requiere un servidor de backend complejo. Sin embargo, para evitar problemas de CORS (Cross-Origin Resource Sharing) al cargar los módulos de JavaScript, se recomienda servir los archivos desde un servidor web local.

Una forma sencilla de hacerlo es utilizando Python:

1.  Abre una terminal en la raíz del directorio del proyecto.
2.  Ejecuta el siguiente comando:
    ```bash
    # Para Python 3
    python -m http.server
    ```
3.  Abre tu navegador y ve a `http://localhost:8000/`.
4.  Desde ahí, puedes navegar a `user/index.html` o `driver/index.html`.
