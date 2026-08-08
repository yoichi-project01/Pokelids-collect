import { useEffect, useState } from 'react';
import { Animated, Modal, StyleSheet, Text, View } from 'react-native';
import type { PhotoMedal } from '@pokelids/shared';
import { Button } from './Button';
import { colors, radius, spacing, typography } from '../theme';

const MEDAL_EMOJI: Record<PhotoMedal, string> = { GOLD: '🥇', SILVER: '🥈', NONE: '📍' };
const MEDAL_TITLE: Record<PhotoMedal, string> = {
  GOLD: '記録しました！',
  SILVER: '記録しました！',
  // No exclamation mark, and no bounce animation below — a GPS mismatch
  // after someone actually traveled to the spot isn't something to
  // celebrate, but the record itself did succeed, so this still reads as a
  // completed action rather than an error.
  NONE: '記録は保存されました',
};
const MEDAL_MESSAGE: Record<PhotoMedal, string> = {
  GOLD: '写真の位置情報が現地と一致しました！',
  SILVER: '写真に位置情報がありませんでした',
  NONE: '写真の位置情報が現地と一致しませんでした',
};

export function CelebrationModal({
  visible,
  medal,
  milestone,
  onClose,
  onRetake,
}: {
  visible: boolean;
  medal: PhotoMedal | null;
  milestone: string | null;
  onClose: () => void;
  // Offered only for a NONE medal (a GPS mismatch is often just a bad fix,
  // not a bad location) — omit to hide the button entirely.
  onRetake?: () => void;
}) {
  const isCelebratory = medal === 'GOLD' || medal === 'SILVER';
  const [scale] = useState(() => new Animated.Value(0));
  const [rotate] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!visible) return;
    if (!isCelebratory) {
      // Skip the spring/rotate bounce for NONE — jump straight to the
      // resting pose so the emoji just appears, calmly, with the modal's
      // own fade.
      scale.setValue(1);
      rotate.setValue(1);
      return;
    }
    scale.setValue(0);
    rotate.setValue(0);
    Animated.sequence([
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
      Animated.timing(rotate, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [visible, isCelebratory, scale, rotate]);

  if (!medal) return null;

  const rotateDeg = rotate.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '0deg'] });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Animated.Text style={[styles.medalEmoji, { transform: [{ scale }, { rotate: rotateDeg }] }]}>
            {MEDAL_EMOJI[medal]}
          </Animated.Text>
          <Text style={styles.title}>{MEDAL_TITLE[medal]}</Text>
          <Text style={styles.message}>{MEDAL_MESSAGE[medal]}</Text>
          {!isCelebratory && (
            <Text style={styles.retakeHint}>
              GPSがずれただけの可能性があります。もう一度撮影すると位置情報を確認できます。
            </Text>
          )}
          {milestone && (
            <View style={styles.milestoneBadge}>
              <Text style={styles.milestoneText}>🎉 {milestone}</Text>
            </View>
          )}
          <View style={styles.actions}>
            {!isCelebratory && onRetake && (
              <Button
                title="もう一度撮影する"
                onPress={onRetake}
                variant="secondary"
                style={styles.actionButton}
              />
            )}
            <Button title="とじる" onPress={onClose} style={styles.actionButton} />
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
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
    width: '100%',
    maxWidth: 360,
  },
  medalEmoji: { fontSize: 72 },
  title: { ...typography.largeTitle, fontSize: 22 },
  message: { ...typography.body, textAlign: 'center', color: colors.textSecondary },
  retakeHint: { ...typography.footnote, textAlign: 'center' },
  milestoneBadge: {
    backgroundColor: colors.accentLight,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  milestoneText: { ...typography.bodyMedium, color: colors.accent },
  actions: { flexDirection: 'row', gap: spacing.sm, alignSelf: 'stretch', marginTop: spacing.md },
  actionButton: { flex: 1 },
});
