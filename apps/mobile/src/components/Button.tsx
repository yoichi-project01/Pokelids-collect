import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  style,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.white : colors.textPrimary} />
      ) : (
        // A defensive floor, not the primary fix — copy that's short enough
        // to fit a half-width paired button (see PhotoPreviewModal,
        // Onboarding) is the actual fix. adjustsFontSizeToFit was
        // considered instead, but react-native-web doesn't implement it (a
        // no-op on this app's primary platform), and auto-shrinking text
        // would make button label size inconsistent across the app anyway.
        // numberOfLines={1} just guarantees a stray long title truncates
        // cleanly instead of wrapping into a squashed two-line button.
        <Text style={[styles.text, variantTextStyles[variant]]} numberOfLines={1}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
  },
  text: { fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.75 },
});

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: colors.accent },
  // borderStrong (7-8), not border — a secondary button's outline is what
  // makes it read as tappable at all (no fill to lean on), so it needs a
  // distinct edge, not a soft divider.
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong },
  ghost: { backgroundColor: 'transparent', minHeight: 40 },
  danger: { backgroundColor: 'transparent', minHeight: 40 },
});

const variantTextStyles = StyleSheet.create({
  primary: { color: colors.white },
  secondary: { color: colors.textPrimary },
  ghost: { color: colors.textSecondary },
  danger: { color: colors.danger },
});
