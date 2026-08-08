import { useEffect, useState } from 'react';
import { Animated, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PREFECTURES, type CollectionSummary, type PhotoMedal } from '@pokelids/shared';
import { Button } from './Button';
import { ListRow } from './ListRow';
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
  summary,
  totalPokeLidsNationwide,
  onClose,
  onRetake,
  onNavigateToNext,
}: {
  visible: boolean;
  medal: PhotoMedal | null;
  milestone: string | null;
  // Drives the "next" section (7-4): shown *after* the celebration itself,
  // never at the same time — see this component's layout below. `null`
  // hides the whole section (used when summary hasn't loaded, which
  // shouldn't happen in practice since it comes back with the same
  // response that triggers this modal).
  summary: CollectionSummary | null;
  // Non-null only when summary.isFirstCollection is true — computed by the
  // caller from the bundled poke-lids.json (7-7) rather than added as a
  // dedicated API field, since it's static data the client already has.
  totalPokeLidsNationwide: number | null;
  onClose: () => void;
  // Offered only for a NONE medal (a GPS mismatch is often just a bad fix,
  // not a bad location) — omit to hide the button entirely.
  onRetake?: () => void;
  // Tapping the nearest-uncollected suggestion — see summary.nearestUncollected.
  onNavigateToNext: (pokeLidId: string) => void;
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

  // Everything below is the "next" section (7-4) — deliberately rendered
  // *after* the celebration content above, never alongside it, so the
  // achievement isn't diluted. Shown regardless of `isCelebratory`: even a
  // calm NONE result should still point at what to try next.
  const prefectureName = summary ? PREFECTURES.find((p) => p.id === summary.prefecture.id)?.nameJa : null;
  const prefectureRemaining = summary ? summary.prefecture.total - summary.prefecture.collected : 0;
  // Skipped when the prefecture was just completed — `milestone` above
  // already announces that, and "あと0個" right after would read as a bug.
  const showPrefectureRemaining = Boolean(summary && prefectureName && prefectureRemaining > 0);
  const nearest = summary?.nearestUncollected ?? null;
  const hasNextSection = showPrefectureRemaining || nearest !== null || totalPokeLidsNationwide != null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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
            {hasNextSection && (
              <View style={styles.nextSection}>
                {totalPokeLidsNationwide != null && (
                  <Text style={styles.nextText}>全国に{totalPokeLidsNationwide}箇所あります</Text>
                )}
                {showPrefectureRemaining && (
                  <Text style={styles.nextText}>
                    {prefectureName}にはあと{prefectureRemaining}個あります
                  </Text>
                )}
                {nearest && (
                  <View style={styles.nearestBlock}>
                    <Text style={styles.nextLabel}>一番近い未収集のポケふた</Text>
                    <ListRow
                      title={nearest.municipality}
                      subtitle={`${(nearest.distanceMeters / 1000).toFixed(1)}km 先`}
                      imageUri={nearest.officialImageUrl}
                      onPress={() => onNavigateToNext(nearest.id)}
                    />
                  </View>
                )}
              </View>
            )}
          </ScrollView>
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
    width: '100%',
    maxWidth: 360,
    // Bounded (rather than sized to content) so the ScrollView below can
    // actually scroll instead of just expanding — the 7-4 "next" section
    // makes this card tall enough to overflow a small phone screen with a
    // milestone badge also showing.
    maxHeight: '100%',
    overflow: 'hidden',
  },
  scrollContent: { alignItems: 'center', gap: spacing.sm, padding: spacing.xxl, paddingBottom: spacing.lg },
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
  nextSection: { alignSelf: 'stretch', alignItems: 'stretch', gap: spacing.sm, marginTop: spacing.sm },
  nextText: { ...typography.footnote, textAlign: 'center' },
  nearestBlock: { gap: spacing.xs },
  nextLabel: { ...typography.footnote, textAlign: 'center' },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignSelf: 'stretch',
    padding: spacing.xxl,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  actionButton: { flex: 1 },
});
