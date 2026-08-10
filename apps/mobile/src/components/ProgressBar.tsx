import { StyleSheet, Text, View } from 'react-native';
import { progressPercent } from '@pokelids/shared';
import { colors, typography } from '../theme';

// `colors.gold` is a dark, low-chroma brown chosen for its contrast as
// *text* on `colors.goldSurface` (see theme.ts / medal.ts) — used as a
// solid fill covering an entire bar, it reads as "dark bronze," not "gold,"
// which undersells the one moment (100%) this bar is meant to celebrate
// (ROADMAP.md: achievement payoff is worth more here than everywhere else).
// `goldSurface` alone is even less usable as a fill — it's a near-white
// backdrop meant to sit *behind* dark text, so on its own it barely reads
// as filled at all. A fill needs a color that still looks intentional at
// full saturation over a large area, which is a different constraint than
// text-on-backdrop contrast (a fill isn't WCAG text, so contrast isn't the
// limiting factor here — legibility of the "5 / 11" label past the fill
// end is, and that label sits outside the bar, not on top of it).
// The proposal's own reference mockup (7-7, pref2() in support.js) reaches
// the same conclusion for this exact case: a separate, more saturated
// #8A6100 for the 100% fill, distinct from the darker text-pairing `gold`.
const PROGRESS_GOLD_FILL = '#8A6100';

// Muted while barely started, accent once meaningfully underway, gold at
// full completion — gives the bar itself a sense of building achievement.
function fillColor(ratio: number): string {
  if (ratio >= 1) return PROGRESS_GOLD_FILL;
  if (ratio >= 0.3) return colors.accent;
  return colors.textSecondary;
}

// A track a few dozen px wide multiplied by a 1%-floor percentage can still
// round back down to a sub-pixel width — minWidth guarantees the fill is
// actually visible the moment there's at least one collected item, same
// motivation as progressPercent's own 1% floor.
const MIN_FILL_WIDTH = 3;

export function ProgressBar({ total, collected }: { total: number; collected: number }) {
  const ratio = total > 0 ? collected / total : 0;
  const percent = progressPercent(collected, total);
  return (
    <View style={styles.row}>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            {
              width: `${percent}%`,
              minWidth: collected > 0 ? MIN_FILL_WIDTH : 0,
              backgroundColor: fillColor(ratio),
            },
          ]}
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
