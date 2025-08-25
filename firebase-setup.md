# Firebase Setup Instructions

## 1. Habilitar Autenticación Anónima

1. Ve a la [Consola de Firebase](https://console.firebase.google.com/)
2. Selecciona tu proyecto `driverparty-d28cc`
3. Ve a **Authentication** en el menú lateral
4. Haz clic en **Sign-in method**
5. Busca **Anonymous** en la lista
6. Haz clic en **Enable** y luego **Save**

## 2. Configurar Reglas de Firestore

Ve a **Firestore Database** > **Rules** y actualiza las reglas:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write access to trips for authenticated users
    match /trips/{tripId} {
      allow read, write: if request.auth != null;
      
      // Allow driver presence updates only by the driver
      match /presence/driver {
        allow read: if request.auth != null;
        allow write: if request.auth != null;
      }
    }
  }
}
```

## 3. Configurar Google Maps API Key

1. Ve a la [Google Cloud Console](https://console.cloud.google.com/)
2. Selecciona tu proyecto
3. Ve a **APIs & Services** > **Credentials**
4. Haz clic en **Create Credentials** > **API Key**
5. Copia la API key
6. Crea un archivo `.env` en la raíz del proyecto con:

```
VITE_GOOGLE_MAPS_API_KEY=tu_api_key_aqui
```

## 4. Habilitar APIs de Google Maps

En la Google Cloud Console, habilita estas APIs:
- Maps JavaScript API
- Directions API
- Geocoding API
- Places API

## 5. Restringir la API Key (Opcional pero Recomendado)

1. En la Google Cloud Console, haz clic en tu API key
2. En **Application restrictions**, selecciona **HTTP referrers**
3. Agrega tu dominio (ej: `https://driverparty.netlify.app/*`)
4. En **API restrictions**, selecciona las APIs mencionadas arriba
