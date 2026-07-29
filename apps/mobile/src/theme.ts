export const colors = {
  background: '#F2F2F7',
  surface: '#FFFFFF',
  border: '#E5E5EA',
  textPrimary: '#1C1C1E',
  textSecondary: '#8E8E93',
  textTertiary: '#C7C7CC',
  black: '#000000',
  white: '#FFFFFF',
  danger: '#FF3B30',
  overlay: 'rgba(0, 0, 0, 0.55)',
};

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
