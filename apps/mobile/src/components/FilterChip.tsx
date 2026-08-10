import { Pressable, StyleSheet, Text } from 'react-native';
import { hapticLight } from '../lib/haptics';
import { colors, radius, spacing, typography } from '../theme';

// The old <Text onPress> pills had a tap target of just the text bounds plus
// paddingVertical: spacing.xs — well under the 44px iOS/Android HIG minimum
// — and Text isn't announced as a button or reachable by Tab on web either.
// hitSlop grows the tappable area invisibly rather than inflating the chip's
// compact pill look with a literal minHeight.
const HIT_SLOP = { top: 10, bottom: 10, left: 8, right: 8 };

export function FilterChip({
  label,
  selected,
  onPress,
  inactiveBackgroundColor = colors.surface,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  // Chips sit on different backgrounds across screens (a plain screen
  // background on prefectures/[id].tsx, a colors.surface bar on the map
  // screens) and need to contrast with whichever it is when unselected.
  inactiveBackgroundColor?: string;
}) {
  // Only buzzes when the tap actually changes something — tapping the
  // already-selected chip is a no-op for the parent's state too, and firing
  // the haptic anyway on every repeat tap would just be noise (6-7 calls out
  // "触覚が過剰にならないよう注意する" specifically for this kind of control).
  function onPressWithHaptic() {
    if (!selected) hapticLight();
    onPress();
  }

  return (
    <Pressable
      onPress={onPressWithHaptic}
      hitSlop={HIT_SLOP}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: selected ? colors.accent : inactiveBackgroundColor },
        selected && styles.chipSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    // borderStrong (7-8), not border — an unselected chip is a tappable
    // toggle, not a divider, so its edge needs to read that way.
    borderColor: colors.borderStrong,
  },
  chipSelected: { borderColor: colors.accent },
  pressed: { opacity: 0.7 },
  label: { ...typography.footnote, fontWeight: '600', color: colors.textSecondary },
  labelSelected: { color: colors.white },
});
