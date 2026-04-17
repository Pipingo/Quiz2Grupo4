import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import * as SQLite from 'expo-sqlite';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  PanResponder,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
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

  const [editingPlace, setEditingPlace] = useState(null);
  const [editName, setEditName] = useState('');
  const [showPlacesList, setShowPlacesList] = useState(false);

  const mapRef = useRef(null);
  const pan = useState(new Animated.ValueXY({ x: 16, y: 340 }))[0];

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      pan.extractOffset();
    },
    onPanResponderMove: Animated.event(
      [null, { dx: pan.x, dy: pan.y }],
      { useNativeDriver: false }
    ),
    onPanResponderRelease: () => {
      pan.flattenOffset();
    },
  });

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
        } catch (error) {}

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

  const deletePlace = async (id) => {
    Alert.alert('Eliminar lugar', '¿Seguro que deseas eliminar este lugar?', [
      {
        text: 'Cancelar',
        style: 'cancel',
      },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await db.runAsync('DELETE FROM places WHERE id = ?;', [id]);
          await loadPlaces();
        },
      },
    ]);
  };

  const focusPlaceOnMap = (place) => {
    const newRegion = {
      latitude: place.latitude,
      longitude: place.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };

    setRegion(newRegion);
    mapRef.current?.animateToRegion(newRegion, 1000);
    setShowPlacesList(false);
  };

  const openEditModal = (place) => {
    setEditingPlace(place);
    setEditName(place.name);
  };

  const updatePlace = async () => {
    if (!editingPlace || !editName.trim()) return;

    await db.runAsync('UPDATE places SET name = ? WHERE id = ?;', [
      editName.trim(),
      editingPlace.id,
    ]);

    await loadPlaces();
    setEditingPlace(null);
    setEditName('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mis Lugares Favoritos</Text>
        <Text style={styles.subtitle}>{permissionMessage}</Text>
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

      <Animated.View
        pointerEvents="box-only"
        style={[
          styles.statsCard,
          {
            transform: pan.getTranslateTransform(),
          },
        ]}
        {...panResponder.panHandlers}
      >
        <Text style={styles.statsTitle}>Lugares guardados</Text>
        <Text style={styles.statsNumber}>{places.length}</Text>
      </Animated.View>

      <Pressable
        style={styles.toggleListButton}
        onPress={() => setShowPlacesList(!showPlacesList)}
      >
        <Text style={styles.toggleListButtonText}>
          {showPlacesList ? 'Ocultar lugares' : 'Ver lugares guardados'}
        </Text>
      </Pressable>

      {showPlacesList && (
        <View style={styles.listContainer}>
          <Text style={styles.listTitle}>Tus lugares</Text>

          <FlatList
            data={places}
            keyExtractor={(item) => item.id.toString()}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.placeCard}
                onPress={() => focusPlaceOnMap(item)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.placeName}>{item.name}</Text>

                  {item.description ? (
                    <Text style={styles.placeDescription}>{item.description}</Text>
                  ) : null}

                  <Text style={styles.placeCoords}>
                    {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => openEditModal(item)}
                >
                  <Text style={styles.editButtonText}>Editar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deletePlace(item.id)}
                >
                  <Text style={styles.deleteButtonText}>Eliminar</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {isLoadingLocation && (
        <View style={styles.loadingOverlay}>
          <Text style={styles.loadingText}>Cargando ubicacion...</Text>
        </View>
      )}

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalBackdrop}>
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
                <Pressable
                  style={[styles.button, styles.buttonSecondary]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.buttonSecondaryText}>Cancelar</Text>
                </Pressable>

                <Pressable
                  style={[styles.button, styles.buttonPrimary]}
                  onPress={savePlace}
                >
                  <Text style={styles.buttonPrimaryText}>Guardar</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={!!editingPlace}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingPlace(null)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Editar lugar</Text>

              <TextInput
                style={styles.input}
                value={editName}
                onChangeText={setEditName}
                placeholder="Nuevo nombre"
              />

              <View style={styles.actionsRow}>
                <Pressable
                  style={[styles.button, styles.buttonSecondary]}
                  onPress={() => setEditingPlace(null)}
                >
                  <Text style={styles.buttonSecondaryText}>Cancelar</Text>
                </Pressable>

                <Pressable
                  style={[styles.button, styles.buttonPrimary]}
                  onPress={updatePlace}
                >
                  <Text style={styles.buttonPrimaryText}>Guardar</Text>
                </Pressable>
              </View>
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
    backgroundColor: '#eef2f7',
  },

  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
    backgroundColor: '#2563eb',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },

  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
  },

  subtitle: {
    marginTop: 6,
    fontSize: 13,
    color: '#dbeafe',
    lineHeight: 18,
  },

  map: {
    flex: 1,
  },

  statsCard: {
    position: 'absolute',
    zIndex: 999,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
  },

  statsTitle: {
    fontSize: 12,
    color: '#64748b',
  },

  statsNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2563eb',
    marginTop: 2,
  },

  toggleListButton: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: '#2563eb',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
    zIndex: 999,
    elevation: 10,
  },

  toggleListButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },

  listContainer: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 20,
    maxHeight: 180,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },

  listTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },

  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 14,
    marginBottom: 10,
  },

  placeName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },

  placeDescription: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    marginBottom: 4,
  },

  placeCoords: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },

  editButton: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginLeft: 8,
  },

  editButtonText: {
    color: '#2563eb',
    fontWeight: '700',
    fontSize: 12,
  },

  deleteButton: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginLeft: 8,
  },

  deleteButtonText: {
    color: '#dc2626',
    fontWeight: '700',
    fontSize: 12,
  },

  loadingOverlay: {
    position: 'absolute',
    bottom: 260,
    alignSelf: 'center',
    backgroundColor: 'rgba(15,23,42,0.85)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 16,
  },

  loadingText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },

  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 28,
    gap: 14,
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },

  input: {
    borderWidth: 1,
    borderColor: '#d1d9e6',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#f8fafc',
    fontSize: 15,
    color: '#0f172a',
  },

  descriptionInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },

  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },

  button: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    minWidth: 100,
    alignItems: 'center',
  },

  buttonSecondary: {
    backgroundColor: '#e2e8f0',
  },

  buttonPrimary: {
    backgroundColor: '#2563eb',
  },

  buttonSecondaryText: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 14,
  },

  buttonPrimaryText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
});

