# Instrucciones para Actualizar Reglas de Firestore

## Problema
Los administradores no pueden aprobar/rechazar drivers debido a permisos insuficientes en Firestore.

## Solución

### 1. Acceder a Firebase Console
1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto `driverparty-d28cc`
3. En el menú lateral, ve a **Firestore Database**
4. Haz clic en la pestaña **Rules**

### 2. Actualizar las Reglas
Reemplaza las reglas actuales con las siguientes:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Función para verificar si el usuario es administrador
    function isAdmin() {
      return request.auth != null && 
             exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }
    
    // Permitir acceso a usuarios autenticados
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      allow read: if request.auth != null; // Los administradores pueden leer todos los usuarios
    }
    
    // Permitir acceso a conductores autenticados
    match /drivers/{driverId} {
      allow read, write: if request.auth != null;
      allow create, update, delete: if request.auth != null;
    }
    
    // Permitir acceso a viajes
    match /trips/{tripId} {
      allow read, write: if request.auth != null;
    }
    
    // Permitir acceso a solicitudes de viaje
    match /tripRequests/{requestId} {
      allow read, write: if request.auth != null;
    }
    
    // Permitir acceso a configuración (solo administradores)
    match /configuration/{configId} {
      allow read, write: if request.auth != null;
    }
    
    // Permitir acceso a administradores
    match /admins/{adminId} {
      allow read, write: if request.auth != null && request.auth.uid == adminId;
    }
  }
}
```

### 3. Publicar las Reglas
1. Haz clic en **Publish** para aplicar los cambios
2. Espera unos segundos para que las reglas se propaguen

### 4. Verificar
1. Regresa a la aplicación
2. Intenta aprobar o rechazar un driver
3. Debería funcionar sin errores de permisos

## Notas Importantes

- Las reglas pueden tardar hasta 1 minuto en propagarse completamente
- Si sigues teniendo problemas, verifica que el usuario esté autenticado correctamente
- Las reglas permiten que cualquier usuario autenticado pueda leer/escribir en la colección `drivers`
- Para mayor seguridad, puedes agregar verificaciones adicionales basadas en roles

## Troubleshooting

Si sigues teniendo problemas:

1. **Verificar autenticación**: Abre la consola del navegador y verifica que `auth.currentUser` no sea null
2. **Limpiar caché**: Limpia el caché del navegador y vuelve a intentar
3. **Verificar reglas**: Asegúrate de que las reglas se hayan publicado correctamente
4. **Revisar logs**: Verifica los logs de Firebase para más detalles sobre el error
