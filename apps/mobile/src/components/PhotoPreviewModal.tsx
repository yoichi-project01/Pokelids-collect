import { Image, Modal, StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { colors, radius, spacing, typography } from '../theme';

// Shown between picking a photo and actually uploading it. Without this,
// a blurry or finger-covered shot went straight to the server — see 4-4.
export function PhotoPreviewModal({
  visible,
  uri,
  source,
  onConfirm,
  onRetake,
  onDismiss,
}: {
  visible: boolean;
  uri: string | null;
  source: 'camera' | 'library';
  onConfirm: () => void;
  onRetake: () => void;
  // Android hardware back / iOS swipe-to-dismiss — closer to "never mind"
  // than "撮り直す", so it discards the pending photo rather than
  // relaunching the picker.
  onDismiss: () => void;
}) {
  if (!uri) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Image source={{ uri }} style={styles.preview} />
          <Text style={styles.hint}>この写真で記録しますか？</Text>
          <View style={styles.actions}>
            <Button
              title={source === 'camera' ? '撮り直す' : '選び直す'}
              onPress={onRetake}
              variant="secondary"
              style={styles.actionButton}
            />
            <Button title="これで記録する" onPress={onConfirm} style={styles.actionButton} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    width: '100%',
    maxWidth: 420,
  },
  preview: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.md,
    backgroundColor: colors.background,
  },
  hint: { ...typography.bodyMedium, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: spacing.sm },
  actionButton: { flex: 1 },
});
