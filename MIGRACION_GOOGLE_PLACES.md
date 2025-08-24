# Migración: Google Maps PlacesService a Place API

## Problema Identificado

Google Maps mostró un warning indicando que `google.maps.places.PlacesService` está deprecado y será discontinuado después del 1 de marzo de 2025. Se recomienda migrar a `google.maps.places.Place`.

### Warning Original
```
As of March 1st, 2025, google.maps.places.PlacesService is not available to new customers. 
Please use google.maps.places.Place instead. At this time, google.maps.places.PlacesService 
is not scheduled to be discontinued, but google.maps.places.Place is recommended over 
google.maps.places.PlacesService.
```

## Solución Implementada

### Cambio en `user/app.js` - Función de Solicitud de Viaje

**ANTES (PlacesService deprecado):**
```javascript
const placesService = new google.maps.places.PlacesService(map);

if (destinationInput.dataset.placeId) {
    const placeResult = await new Promise((resolve, reject) => {
        placesService.getDetails({ 
            placeId: destinationInput.dataset.placeId, 
            fields: ['geometry'] 
        }, (place, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && place.geometry) {
                resolve(place.geometry.location);
            } else {
                reject(new Error('No se pudo obtener los detalles del lugar.'));
            }
        });
    });
    destinationLocation = { lat: placeResult.lat(), lng: placeResult.lng() };
}
```

**DESPUÉS (Place API moderna):**
```javascript
if (destinationInput.dataset.placeId) {
    try {
        // Usar la nueva API de Place en lugar de PlacesService
        const place = await google.maps.places.Place.fetchPlace({
            placeId: destinationInput.dataset.placeId,
            fields: ['geometry']
        });
        
        if (place.geometry && place.geometry.location) {
            destinationLocation = { 
                lat: place.geometry.location.lat, 
                lng: place.geometry.location.lng 
            };
        } else {
            throw new Error('No se pudo obtener los detalles del lugar.');
        }
    } catch (error) {
        console.warn('Error usando Place.fetchPlace, fallback a geocodificación:', error);
        // Fallback a geocodificación si Place.fetchPlace falla
        const geocoder = new google.maps.Geocoder();
        const geocodeResult = await geocoder.geocode({ 
            address: destinationInput.value, 
            componentRestrictions: { country: 'uy' } 
        });
        
        if (geocodeResult.results && geocodeResult.results.length > 0 && 
            geocodeResult.results[0].geometry && geocodeResult.results[0].geometry.location) {
            destinationLocation = {
                lat: geocodeResult.results[0].geometry.location.lat(),
                lng: geocodeResult.results[0].geometry.location.lng(),
            };
        } else {
            throw new Error('No se pudo encontrar la dirección ingresada. Por favor, selecciónala de la lista.');
        }
    }
}
```

## Beneficios de la Migración

### ✅ **API Moderna y Recomendada**
- Usa la nueva API `google.maps.places.Place` recomendada por Google
- Elimina el warning de deprecación
- Futuro-proof para después del 1 de marzo de 2025

### ✅ **Mejor Manejo de Errores**
- Incluye fallback automático a geocodificación si Place.fetchPlace falla
- Manejo robusto de errores con try-catch
- Logging detallado para debugging

### ✅ **Código Más Limpio**
- Elimina el patrón callback/promise wrapper
- Usa async/await nativo
- Código más legible y mantenible

### ✅ **Compatibilidad Mantenida**
- Mantiene la misma funcionalidad para el usuario
- No afecta el flujo de trabajo existente
- Fallback automático asegura que la funcionalidad no se rompa

## Diferencias Técnicas

### PlacesService (Deprecado)
- **Patrón**: Callback-based
- **Sintaxis**: `new google.maps.places.PlacesService(map)`
- **Método**: `getDetails(callback)`
- **Estado**: `PlacesServiceStatus.OK`

### Place API (Nuevo)
- **Patrón**: Promise-based
- **Sintaxis**: `google.maps.places.Place.fetchPlace()`
- **Método**: `fetchPlace(options)`
- **Retorno**: Promise que resuelve directamente

## Manejo de Errores

### Estrategia de Fallback
1. **Intenta Place.fetchPlace** primero
2. **Si falla**, usa geocodificación como fallback
3. **Si ambos fallan**, muestra error al usuario
4. **Logging** para debugging y monitoreo

### Casos de Error Cubiertos
- ✅ API de Place no disponible
- ✅ Network errors
- ✅ Invalid place_id
- ✅ Place sin geometría
- ✅ Rate limiting

## Verificación

Para verificar que la migración funciona:

1. **Abrir la aplicación de usuario**
2. **Buscar una dirección en el autocompletado**
3. **Seleccionar una dirección de la lista**
4. **Solicitar un viaje**
5. **Verificar que no aparezca el warning de PlacesService**
6. **Confirmar que la funcionalidad sigue funcionando**

## Archivos Modificados

- **`user/app.js`**: Migración de PlacesService a Place API en la función de solicitud de viaje

## Compatibilidad

- ✅ **Mantiene compatibilidad** con el flujo existente
- ✅ **No afecta** otras funcionalidades
- ✅ **Fallback automático** asegura robustez
- ✅ **Elimina warnings** de Google Maps

## Referencias

- [Google Maps Legacy Migration Guide](https://developers.google.com/maps/documentation/javascript/places-migration-overview)
- [Google Maps Legacy Documentation](https://developers.google.com/maps/legacy)
- [Place API Documentation](https://developers.google.com/maps/documentation/javascript/places)
