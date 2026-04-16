import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import * as SQLite from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';

const FALLBACK_REGION = {
  latitude: 4.711,
  longitude: -74.0721,
  latitudeDelta: 0.03,
  longitudeDelta: 0.03,
};

export default function App() {
  const [db, setDb] = useState(null);
  const [places, setPlaces] = useState([]);
  const [region, setRegion] = useState(FALLBACK_REGION);
  const [permissionStatus, setPermissionStatus] = useState('pending');
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [placeName, setPlaceName] = useState('');
  const [selectedCoordinate, setSelectedCoordinate] = useState(null);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const database = await SQLite.openDatabaseAsync('favorites.db');
        setDb(database);

        await database.execAsync(
          `CREATE TABLE IF NOT EXISTS places (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL
          );`
        );

        await loadPlaces(database);
        await requestAndCenterUserLocation();
      } catch (error) {
        Alert.alert('Error', 'No se pudo inicializar la base de datos local.');
        setPermissionStatus('denied');
        setIsLoadingLocation(false);
      }
    };

    bootstrap();
  }, []);

  const loadPlaces = async (databaseRef = db) => {
    if (!databaseRef) return;
    const rows = await databaseRef.getAllAsync(
      'SELECT id, name, latitude, longitude FROM places ORDER BY id DESC;'
    );
    setPlaces(rows);
  };

  const requestAndCenterUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermissionStatus('denied');
        setIsLoadingLocation(false);
        return;
      }

      setPermissionStatus('granted');
      const current = await Location.getCurrentPositionAsync({});

      setRegion({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    } catch (error) {
      setPermissionStatus('denied');
      Alert.alert(
        'Ubicacion no disponible',
        'No fue posible obtener la ubicacion actual. Se mostrara una zona por defecto.'
      );
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const permissionMessage = useMemo(() => {
    if (permissionStatus === 'pending') return 'Solicitando permiso de ubicacion...';
    if (permissionStatus === 'denied') {
      return 'Permiso de ubicacion denegado. Puedes guardar lugares en el mapa igualmente.';
    }
    return 'Mantener presionado el mapa para guardar un lugar favorito.';
  }, [permissionStatus]);

  const handleLongPress = (event) => {
    const coordinate = event.nativeEvent.coordinate;
    setSelectedCoordinate(coordinate);
    setPlaceName('');
    setModalVisible(true);
  };

  const savePlace = async () => {
    if (!db || !selectedCoordinate) return;

    const trimmedName = placeName.trim();
    if (!trimmedName) {
      Alert.alert('Nombre requerido', 'Ingresa un nombre para el lugar.');
      return;
    }

    await db.runAsync(
      'INSERT INTO places (name, latitude, longitude) VALUES (?, ?, ?);',
      [trimmedName, selectedCoordinate.latitude, selectedCoordinate.longitude]
    );

    await loadPlaces();
    setModalVisible(false);
    setSelectedCoordinate(null);
    setPlaceName('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mis Lugares Favoritos</Text>
        <Text style={styles.subtitle}>{permissionMessage}</Text>
      </View>

      <MapView
        style={styles.map}
        region={region}
        onRegionChangeComplete={setRegion}
        onLongPress={handleLongPress}
        showsUserLocation={permissionStatus === 'granted'}
        showsMyLocationButton={permissionStatus === 'granted'}
      >
        {places.map((place) => (
          <Marker
            key={place.id}
            coordinate={{
              latitude: place.latitude,
              longitude: place.longitude,
            }}
            title={place.name}
            description={`Lat: ${place.latitude.toFixed(5)} | Lng: ${place.longitude.toFixed(5)}`}
          />
        ))}
      </MapView>

      {isLoadingLocation && (
        <View style={styles.loadingOverlay}>
          <Text style={styles.loadingText}>Cargando ubicacion...</Text>
        </View>
      )}

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nuevo lugar favorito</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej. Cafeteria de la esquina"
              value={placeName}
              onChangeText={setPlaceName}
              autoFocus
            />

            <View style={styles.actionsRow}>
              <Pressable style={[styles.button, styles.buttonSecondary]} onPress={() => setModalVisible(false)}>
                <Text style={styles.buttonSecondaryText}>Cancelar</Text>
              </Pressable>
              <Pressable style={[styles.button, styles.buttonPrimary]} onPress={savePlace}>
                <Text style={styles.buttonPrimaryText}>Guardar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f5f9',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#dbe3eb',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#14213d',
  },
  subtitle: {
    marginTop: 4,
    color: '#33415c',
  },
  map: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    bottom: 18,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  button: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  buttonSecondary: {
    backgroundColor: '#e2e8f0',
  },
  buttonPrimary: {
    backgroundColor: '#1d4ed8',
  },
  buttonSecondaryText: {
    color: '#0f172a',
    fontWeight: '600',
  },
  buttonPrimaryText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
