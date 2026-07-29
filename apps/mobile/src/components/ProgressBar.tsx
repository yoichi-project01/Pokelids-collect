import { StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '../theme';

// Muted while barely started, accent once meaningfully underway, gold at
// full completion — gives the bar itself a sense of building achievement.
function fillColor(ratio: number): string {
  if (ratio >= 1) return colors.gold;
  if (ratio >= 0.3) return colors.accent;
  return colors.textSecondary;
}

export function ProgressBar({ total, collected }: { total: number; collected: number }) {
  const ratio = total > 0 ? collected / total : 0;
  return (
    <View style={styles.row}>
      <View style={styles.track}>
        <View
          style={[styles.fill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: fillColor(ratio) }]}
        />
      </View>
      <Text style={styles.label}>
        {collected}/{total}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: '100%' },
  label: { ...typography.footnote, minWidth: 56, textAlign: 'right' },
});
