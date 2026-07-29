import * as Location from 'expo-location';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

// Never lets the caller hang if the user ignores the permission prompt or
// the device takes too long to get a fix — resolves to null instead.
export async function getCurrentLocation(timeoutMs = 8000): Promise<Coordinates | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    if (!position) return null;

    return { latitude: position.coords.latitude, longitude: position.coords.longitude };
  } catch {
    return null;
  }
}
