# Quiz 2 - Grupo 4

Proyecto implementado con **React Native + Expo**.

## Opcion elegida

**Opcion 1 - Mis Lugares Favoritos**

La app permite:
- Obtener la ubicacion actual del usuario al abrir.
- Centrar el mapa en esa ubicacion.
- Guardar un lugar favorito con nombre al hacer tap largo en el mapa.
- Persistir lugares en SQLite.
- Mostrar marcadores guardados al reabrir la app.

## Stack usado

- Expo (React Native)
- expo-location
- expo-sqlite
- react-native-maps

## Requisitos previos

- Node.js LTS
- npm
- Expo Go (en telefono) o emulador Android/iOS

## Instalacion

```bash
npm install
```

## Ejecucion

```bash
npm run start
```

Luego puedes abrir en:
- Android: tecla `a` en la terminal o `npm run android`
- iOS (solo macOS): tecla `i` o `npm run ios`
- Web (referencia): `npm run web`

## Flujo funcional esperado

1. Abrir la app.
2. Aceptar permiso de ubicacion.
3. Ver mapa centrado en la posicion actual.
4. Hacer tap largo en cualquier punto del mapa.
5. Ingresar nombre del lugar y guardar.
6. Ver nuevo marcador en el mapa.
7. Cerrar y volver a abrir la app para confirmar persistencia de marcadores.

## Manejo de permisos y errores

- Si el usuario niega permiso de ubicacion, la app no crashea.
- Se muestra un mensaje informativo y el mapa usa una region por defecto.
- Aun asi, se pueden guardar lugares mediante tap largo.

## Estructura principal

- `App.js`: logica principal de mapa, permisos, modal y SQLite.
- `app.json`: permisos de ubicacion y plugin de SQLite.

## Demo sugerida (2-3 min)

1. Mostrar app recien abierta y solicitud de permiso.
2. Mostrar centrado en ubicacion actual.
3. Guardar 1-2 lugares con tap largo + modal.
4. Mostrar marcadores en mapa.
5. Cerrar y reabrir para verificar que siguen visibles.
