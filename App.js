import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import * as SQLite from 'expo-sqlite';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
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
  const [placeDescription, setPlaceDescription] = useState('');
  const [selectedCoordinate, setSelectedCoordinate] = useState(null);
  const [showList, setShowList] = useState(false);
  const mapRef = useRef(null);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const database = await SQLite.openDatabaseAsync('favorites.db');
        setDb(database);

        await database.execAsync(
          `CREATE TABLE IF NOT EXISTS places (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL
          );`
        );

        try {
          await database.execAsync('ALTER TABLE places ADD COLUMN description TEXT;');
        } catch (error) {
          // Si la columna ya existe o la base de datos no permite ALTER TABLE, se ignora.
        }

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
      'SELECT id, name, description, latitude, longitude FROM places ORDER BY id DESC;'
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
    setPlaceDescription('');
    setModalVisible(true);
  };

  const handlePlaceSelect = (place) => {
    const newRegion = {
      latitude: place.latitude,
      longitude: place.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };

    setRegion(newRegion);
    setShowList(false);

    if (mapRef.current && mapRef.current.animateToRegion) {
      mapRef.current.animateToRegion(newRegion, 500);
    }
  };

  const savePlace = async () => {
    if (!db || !selectedCoordinate) return;

    const trimmedName = placeName.trim();
    if (!trimmedName) {
      Alert.alert('Nombre requerido', 'Ingresa un nombre para el lugar.');
      return;
    }

    await db.runAsync(
      'INSERT INTO places (name, description, latitude, longitude) VALUES (?, ?, ?, ?);',
      [trimmedName, placeDescription.trim(), selectedCoordinate.latitude, selectedCoordinate.longitude]
    );

    await loadPlaces();
    setModalVisible(false);
    setSelectedCoordinate(null);
    setPlaceName('');
    setPlaceDescription('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTextWrapper}>
          <Text style={styles.title}>Mis Lugares Favoritos</Text>
          <Text style={styles.subtitle}>{permissionMessage}</Text>
        </View>
        <Pressable style={styles.hamburgerButton} onPress={() => setShowList((prev) => !prev)}>
          <Text style={styles.hamburgerText}>≡</Text>
        </Pressable>
      </View>

      <MapView
        ref={mapRef}
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
            description={
              place.description
                ? `${place.description} · ${place.latitude.toFixed(5)}, ${place.longitude.toFixed(5)}`
                : `Lat: ${place.latitude.toFixed(5)} | Lng: ${place.longitude.toFixed(5)}`
            }
          />
        ))}
      </MapView>

      {showList && (
        <Pressable style={styles.menuOverlay} onPress={() => setShowList(false)}>
          <Pressable style={styles.listSection} onPress={() => {}}>
            <Text style={styles.sectionTitle}>Lugares guardados</Text>
            <ScrollView contentContainerStyle={styles.listContent}>
              {places.length === 0 ? (
                <Text style={styles.emptyText}>No hay lugares guardados todavía.</Text>
              ) : (
                places.map((place) => (
                  <Pressable key={place.id} style={styles.placeCard} onPress={() => handlePlaceSelect(place)}>
                    <Text style={styles.placeName}>{place.name}</Text>
                    {place.description ? <Text style={styles.placeDescription}>{place.description}</Text> : null}
                    <Text style={styles.placeCoordinates}>
                      {place.latitude.toFixed(5)}, {place.longitude.toFixed(5)}
                    </Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      )}

      {isLoadingLocation && (
        <View style={styles.loadingOverlay}>
          <Text style={styles.loadingText}>Cargando ubicacion...</Text>
        </View>
      )}

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalBackdrop}
          keyboardVerticalOffset={80}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nuevo lugar favorito</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej. Cafetería de la esquina"
              value={placeName}
              onChangeText={setPlaceName}
              autoFocus
            />
            <TextInput
              style={[styles.input, styles.descriptionInput]}
              placeholder="Descripción opcional"
              value={placeDescription}
              onChangeText={setPlaceDescription}
              multiline
            />

            <View style={styles.actionsRow}>
              <Pressable style={[styles.button, styles.buttonSecondary]} onPress={() => setModalVisible(false)}>
                <Text style={styles.buttonSecondaryText}>Cancelar</Text>
              </Pressable>
              <Pressable style={[styles.button, styles.buttonPrimary, styles.buttonMarginLeft]} onPress={savePlace}>
                <Text style={styles.buttonPrimaryText}>Guardar</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  headerTextWrapper: {
    flex: 1,
    paddingRight: 10,
  },
  hamburgerButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#1d4ed8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hamburgerText: {
    color: '#ffffff',
    fontSize: 24,
    lineHeight: 24,
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
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
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
  buttonMarginLeft: {
    marginLeft: 10,
  },
  buttonSecondaryText: {
    color: '#0f172a',
    fontWeight: '600',
  },
  buttonPrimaryText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  dropdownArrow: {
    fontSize: 16,
    color: '#33415c',
  },
  menuOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.25)',
    zIndex: 100,
  },
  listSection: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 290,
    backgroundColor: '#ffffff',
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    paddingTop: 80,
    paddingHorizontal: 16,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#14213d',
    marginBottom: 14,
  },
  listContent: {
    paddingBottom: 8,
  },
  placeCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  placeName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  placeCoordinates: {
    marginTop: 4,
    color: '#475569',
    fontSize: 12,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14,
  },
});
