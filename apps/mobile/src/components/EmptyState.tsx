import { StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { colors, spacing, typography } from '../theme';

// Every "there's nothing here" screen in the app (see TASKS.md 6-2) should
// end in something the user can tap next, not a dead end — never leave
// `actionLabel`/`onAction` unset unless there truly is no next action.
export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction && <Button title={actionLabel} onPress={onAction} style={styles.button} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
  title: { ...typography.bodyMedium, textAlign: 'center' },
  message: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  button: { marginTop: spacing.sm },
});
