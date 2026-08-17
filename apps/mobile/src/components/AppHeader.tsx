import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CHROME_MAX_WIDTH, colors, spacing } from '../theme';

// Web-only replacement for the default header (see (tabs)/_layout.tsx and
// app/_layout.tsx, which only wire this in for Platform.OS === 'web').
// react-navigation's built-in Header strips maxWidth/width/alignSelf out of
// headerStyle before applying it — Header.js destructures headerStyle down
// to a background/border/shadow/height allowlist and silently discards (with
// a console.warn) anything outside it — so there's no way to cap *that*
// component's own width. This one renders the same full-width background,
// but centers its content row at CHROME_MAX_WIDTH — narrower than
// ScreenContainer's own CONTENT_MAX_WIDTH on wide screens (see that
// constant's own comment in theme.ts for why header/tab-bar chrome doesn't
// widen the same way card grids do), matching the tab bar underneath it.
// Grown from 56 (a bare 44x44 icon and a screen name go there natively too);
// this is a `minHeight`, not a `height` (see the `row` style below), so it's
// only the baseline for a single-line title — the two-line brand+title stack
// this header now always renders pushes it taller on its own regardless of
// this constant.
const HEADER_HEIGHT = 72;
// 3-3's 44x44 minimum touch target — the previous 32x43px back button (a
// hitSlop=8 that, on web, doesn't actually enlarge the element's own
// measured bounding box the way it does on native) was found too small in
// real-device testing.
const MIN_TAP_TARGET = 44;

// Web-only (see this file's own top comment) fix for a browser tab telling
// you nothing about which site it is once you're several tabs deep — every
// screen's own <title> already says "…- ポケふたコレクト" (the browser tab
// itself), but nothing in the visible page said it once you were actually
// looking at the app, outside of the home screen's own hero text. Shown
// above the screen name on every web screen (not just home) — home's own
// "収集進捗" title is no more self-explanatory out of context than
// "設定" or "都道府県別一覧" are, so singling it out wouldn't fix this
// anywhere else a tab might be pinned.
const SERVICE_NAME = 'ポケふたコレクト';

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
        <View style={styles.titleStack}>
          <Text style={styles.serviceName} numberOfLines={1}>
            {SERVICE_NAME}
          </Text>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>
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
    // minHeight, not height: at max OS font scaling, or when the service
    // name + title stack wraps to more than two lines total, the content can
    // exceed HEADER_HEIGHT — a fixed height would clip it instead of letting
    // the row (and its surrounding background) grow to fit.
    minHeight: HEADER_HEIGHT,
    width: '100%',
    maxWidth: CHROME_MAX_WIDTH,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  titleStack: { flex: 1, alignItems: 'center' },
  // Balances the title stack's centering math (titleStack is flex: 1
  // between two equal-width sides) without needing to know in advance
  // whether a back button will actually render on the left. Matches
  // backButton's own minWidth so the two sides stay equal-width whether or
  // not a button actually renders on the left.
  side: { minWidth: MIN_TAP_TARGET },
  backButton: {
    minWidth: MIN_TAP_TARGET,
    minHeight: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backChevron: { fontSize: 28, fontWeight: '400', color: colors.accent, marginTop: -2 },
  serviceName: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  title: { fontSize: 17, fontWeight: '600', color: colors.textPrimary },
});
