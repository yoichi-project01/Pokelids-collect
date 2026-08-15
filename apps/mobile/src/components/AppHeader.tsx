import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, CONTENT_MAX_WIDTH, spacing } from '../theme';

// Web-only replacement for the default header (see (tabs)/_layout.tsx and
// app/_layout.tsx, which only wire this in for Platform.OS === 'web').
// react-navigation's built-in Header strips maxWidth/width/alignSelf out of
// headerStyle before applying it — Header.js destructures headerStyle down
// to a background/border/shadow/height allowlist and silently discards (with
// a console.warn) anything outside it — so there's no way to cap *that*
// component's own width. This one renders the same full-width background,
// but centers its content row at CONTENT_MAX_WIDTH, matching ScreenContainer
// and the tab bar underneath it.
const HEADER_HEIGHT = 56;
// 3-3's 44x44 minimum touch target — the previous 32x43px back button (a
// hitSlop=8 that, on web, doesn't actually enlarge the element's own
// measured bounding box the way it does on native) was found too small in
// real-device testing.
const MIN_TAP_TARGET = 44;

export function AppHeader({
  title,
  canGoBack,
  onBack,
}: {
  title: string;
  canGoBack?: boolean;
  onBack?: () => void;
}) {
  return (
    <View style={styles.background}>
      <View style={styles.row}>
        <View style={styles.side}>
          {canGoBack && (
            <Pressable
              onPress={onBack}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="戻る"
              style={styles.backButton}
            >
              <Text style={styles.backChevron}>‹</Text>
            </Pressable>
          )}
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.side} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  row: {
    // minHeight, not height: at max OS font scaling the 17px title can
    // exceed 56px, and a fixed height would clip it instead of letting the
    // row (and its surrounding background) grow to fit.
    minHeight: HEADER_HEIGHT,
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  // Balances the title's centering math (title is flex: 1 between two
  // equal-width sides) without needing to know in advance whether a back
  // button will actually render on the left. Matches backButton's own
  // minWidth so the two sides stay equal-width whether or not a button
  // actually renders on the left.
  side: { minWidth: MIN_TAP_TARGET },
  backButton: {
    minWidth: MIN_TAP_TARGET,
    minHeight: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backChevron: { fontSize: 28, fontWeight: '400', color: colors.accent, marginTop: -2 },
  title: { flex: 1, fontSize: 17, fontWeight: '600', color: colors.textPrimary },
});
