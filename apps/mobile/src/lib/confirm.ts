import { Alert, Platform } from 'react-native';

// react-native-web's Alert.alert is a no-op, so a confirmation dialog that
// awaits its button callbacks would hang forever on web. Fall back to the
// browser's native confirm() there instead.
// Same no-op-on-web problem as Alert.alert's confirm buttons (see below),
// but for a plain notice with no response to wait for.
export function alertAsync(title: string, message: string): void {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

export function confirmAsync(
  title: string,
  message: string,
  confirmLabel: string = '保存する',
): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'キャンセル', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, onPress: () => resolve(true) },
    ]);
  });
}
