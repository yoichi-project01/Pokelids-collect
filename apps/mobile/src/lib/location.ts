import * as Location from 'expo-location';
import { Linking, Platform } from 'react-native';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export type LocationPermissionStatus = 'granted' | 'denied' | 'undetermined';

type PermissionChangeListener = () => void;
// Single listener, mirroring toast.ts's setToastListener — currently only
// the home tab needs to know when permission changes elsewhere (the
// onboarding flow, or its own "許可する" tap), both of which go through
// requestLocationPermission below.
let permissionChangeListener: PermissionChangeListener | null = null;

export function setLocationPermissionChangedListener(fn: PermissionChangeListener | null): void {
  permissionChangeListener = fn;
}

// Check-only — never shows the OS permission dialog. Safe to call from
// anywhere, including on every screen mount.
export async function getLocationPermissionStatus(): Promise<LocationPermissionStatus> {
  const { status } = await Location.getForegroundPermissionsAsync();
  return status;
}

// Shows the OS permission dialog if the user hasn't decided yet. Only call
// this from somewhere that already explained why first (the onboarding
// location step, or an explicit "位置情報を許可する" tap) — see
// getCurrentLocation below for why nothing else should trigger it.
export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  permissionChangeListener?.();
  return status === 'granted';
}

// Jumps to this app's OS settings page so a previously-denied permission can
// be turned back on — requestLocationPermission alone can't do this, since
// iOS/Android won't re-show the OS dialog once denied. There's no web
// equivalent (a browser's own site-permissions UI isn't reachable via a
// link), so this is a no-op there; callers fall back to text guidance.
export function openLocationSettings(): void {
  if (Platform.OS === 'web') return;
  Linking.openSettings();
}

// Never shows the OS permission dialog — resolves to null immediately if
// permission isn't already granted, rather than prompting. Every screen that
// fetches location on mount (home, collection, poke-lid detail, the map)
// calls this, so it can't accidentally trigger a cold, unexplained OS
// prompt; getting permission granted in the first place has to go through
// requestLocationPermission instead.
export async function getCurrentLocation(timeoutMs = 8000): Promise<Coordinates | null> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
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
