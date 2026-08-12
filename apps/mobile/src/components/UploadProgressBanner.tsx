import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

// Floats over the map during the quick-record upload (6-6) — the map has no
// natural place in its own layout for an inline progress bar the way the
// poke-lid detail screen does, and this is exactly the "electricity is weak"
// scenario (CLAUDE.md) where an upload can visibly take a while. Reused as-is
// for guest-photo sync (7-9 phase 2, see auth.tsx) since it's already generic
// over `progress` — only the label needed to become a prop, since "アップ
// ロード中" doesn't describe what's happening during a sync.
export function UploadProgressBanner({
  progress,
  label = 'アップロード中',
}: {
  progress: number | null;
  label?: string;
}) {
  const percent = Math.round((progress ?? 0) * 100);
  return (
    <View style={styles.banner} pointerEvents="none">
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${percent}%` }]} />
      </View>
      <Text style={styles.label}>
        {label}… {percent}%
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
    shadowColor: colors.black,
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.accent },
  label: { ...typography.footnote, textAlign: 'center' },
});
