import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// expo-secure-store isn't available on web, and AsyncStorage there is
// already backed by the browser's own storage rather than plaintext disk
// files, so it's an acceptable fallback. On native, AsyncStorage is
// unencrypted disk storage, so auth tokens go through SecureStore instead.
const useSecureStore = Platform.OS !== 'web';

export async function getStoredTokens(key: string): Promise<string | null> {
  return useSecureStore ? SecureStore.getItemAsync(key) : AsyncStorage.getItem(key);
}

export async function setStoredTokens(key: string, value: string): Promise<void> {
  await (useSecureStore ? SecureStore.setItemAsync(key, value) : AsyncStorage.setItem(key, value));
}

export async function removeStoredTokens(key: string): Promise<void> {
  await (useSecureStore ? SecureStore.deleteItemAsync(key) : AsyncStorage.removeItem(key));
}
