import { StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { colors, spacing, typography } from '../theme';

export function ErrorState({
  message = 'データを取得できませんでした',
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.message}>{message}</Text>
      <Button title="再試行" onPress={onRetry} variant="secondary" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  message: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
});
