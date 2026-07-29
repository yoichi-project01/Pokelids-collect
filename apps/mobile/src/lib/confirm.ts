import { Alert, Platform } from 'react-native';

// react-native-web's Alert.alert is a no-op, so a confirmation dialog that
// awaits its button callbacks would hang forever on web. Fall back to the
// browser's native confirm() there instead.
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
