import { useEffect } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import type { PhotoMedal } from '@pokelids/shared';
import { hapticEmphasis, hapticSuccess } from '../lib/haptics';
import { MEDAL_BADGE_COLOR } from '../lib/medal';
import { colors, radius, spacing, typography } from '../theme';
import { Button } from './Button';

// Shown once, right after syncGuestCollectionsToAccount (7-9 phase 2) syncs
// at least one photo — the first moment a guest's medals become real, since
// phase 1 deliberately withheld them (guestPhotoCapture.ts shows distance
// only, never a medal, so the server stays the sole authority). Deliberately
// NOT CelebrationModal: that component's "next" section (7-4/7-5) is built
// around a single just-recorded poke lid with one summary/nearestUncollected
// to anchor on. A batch sync covers an arbitrary number of different poke
// lids at once with no single "next" — and the task this shipped under was
// explicit that the two roles must not be mixed. Partial-failure / limit-hit
// messaging is intentionally NOT duplicated here either: that stays on the
// existing 4-5-style toast (auth.tsx), which already has an established,
// consistent voice for "here's what didn't make it" — this modal only ever
// talks about what *did* sync, so it can stay unambiguously celebratory.
export function SyncCompleteModal({
  visible,
  recordsSyncedCount,
  medalCounts,
  onClose,
}: {
  visible: boolean;
  recordsSyncedCount: number;
  medalCounts: Record<PhotoMedal, number>;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!visible) return;
    hapticSuccess();
    if (medalCounts.GOLD > 0) hapticEmphasis();
  }, [visible, medalCounts.GOLD]);

  const hasMedals = medalCounts.GOLD > 0 || medalCounts.SILVER > 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.emoji}>🎉</Text>
          <Text style={styles.title}>同期が完了しました</Text>
          <Text style={styles.message}>{recordsSyncedCount}件の記録を保存しました</Text>
          {hasMedals && (
            <View style={styles.medalRow}>
              {medalCounts.GOLD > 0 && (
                <View style={[styles.medalBadge, { backgroundColor: MEDAL_BADGE_COLOR.GOLD.bg }]}>
                  <Text style={[styles.medalText, { color: MEDAL_BADGE_COLOR.GOLD.fg }]}>
                    🥇 {medalCounts.GOLD}個
                  </Text>
                </View>
              )}
              {medalCounts.SILVER > 0 && (
                <View style={[styles.medalBadge, { backgroundColor: MEDAL_BADGE_COLOR.SILVER.bg }]}>
                  <Text style={[styles.medalText, { color: MEDAL_BADGE_COLOR.SILVER.fg }]}>
                    🥈 {medalCounts.SILVER}個
                  </Text>
                </View>
              )}
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
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xxl,
  },
  emoji: { fontSize: 56 },
  title: { ...typography.largeTitle, fontSize: 22 },
  message: { ...typography.body, textAlign: 'center', color: colors.textSecondary },
  medalRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  medalBadge: { borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  medalText: { ...typography.bodyMedium },
  closeButton: { alignSelf: 'stretch', marginTop: spacing.md },
});
