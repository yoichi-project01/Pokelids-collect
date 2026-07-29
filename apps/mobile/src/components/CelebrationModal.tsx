import { useEffect, useState } from 'react';
import { Animated, Modal, StyleSheet, Text, View } from 'react-native';
import type { PhotoMedal } from '@pokelids/shared';
import { Button } from './Button';
import { colors, radius, spacing, typography } from '../theme';

const MEDAL_EMOJI: Record<PhotoMedal, string> = { GOLD: '🥇', SILVER: '🥈', NONE: '📍' };
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
}: {
  visible: boolean;
  medal: PhotoMedal | null;
  milestone: string | null;
  onClose: () => void;
}) {
  const [scale] = useState(() => new Animated.Value(0));
  const [rotate] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!visible) return;
    scale.setValue(0);
    rotate.setValue(0);
    Animated.sequence([
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
      Animated.timing(rotate, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [visible, medal, scale, rotate]);

  if (!medal) return null;

  const rotateDeg = rotate.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '0deg'] });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Animated.Text style={[styles.medalEmoji, { transform: [{ scale }, { rotate: rotateDeg }] }]}>
            {MEDAL_EMOJI[medal]}
          </Animated.Text>
          <Text style={styles.title}>記録しました！</Text>
          <Text style={styles.message}>{MEDAL_MESSAGE[medal]}</Text>
          {milestone && (
            <View style={styles.milestoneBadge}>
              <Text style={styles.milestoneText}>🎉 {milestone}</Text>
            </View>
          )}
          <Button title="とじる" onPress={onClose} style={styles.closeButton} />
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
  milestoneBadge: {
    backgroundColor: colors.accentLight,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  milestoneText: { ...typography.bodyMedium, color: colors.accent },
  closeButton: { marginTop: spacing.md, alignSelf: 'stretch' },
});
