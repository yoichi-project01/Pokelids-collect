export const colors = {
  background: '#F2F2F7',
  surface: '#FFFFFF',
  border: '#E5E5EA',
  textPrimary: '#1C1C1E',
  textSecondary: '#8E8E93',
  // #C7C7CC (the previous value) is ~1.6:1 against white — well under the
  // 4.5:1 WCAG AA minimum for text. This is readable outdoors in direct sun,
  // where this app is mostly used.
  textTertiary: '#6B7280',
  black: '#000000',
  white: '#FFFFFF',
  danger: '#FF3B30',
  overlay: 'rgba(0, 0, 0, 0.55)',
  // Deep teal — reads as "manhole iron / travel" without competing with the
  // poke lid artwork's own colors. Used for progress fills, primary actions,
  // and the collected badge.
  accent: '#0F766E',
  accentLight: '#CCFBF1',
  gold: '#D4A017',
};

// Shared by ScreenContainer and (tabs)/_layout.tsx's headerStyle/tabBarStyle
// (and the root Stack's headerStyle) — react-native-web doesn't constrain
// width on its own, so a wide desktop browser would otherwise stretch every
// one of them full-bleed independently.
export const CONTENT_MAX_WIDTH = 720;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
};

export const typography = {
  largeTitle: { fontSize: 28, fontWeight: '700' as const, color: colors.textPrimary },
  title: { fontSize: 20, fontWeight: '600' as const, color: colors.textPrimary },
  body: { fontSize: 16, color: colors.textPrimary },
  bodyMedium: { fontSize: 16, fontWeight: '600' as const, color: colors.textPrimary },
  caption: { fontSize: 13, color: colors.textSecondary },
  footnote: { fontSize: 12, color: colors.textSecondary },
};
