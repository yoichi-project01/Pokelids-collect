import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, CONTENT_MAX_WIDTH } from '../theme';

export function ScreenContainer({
  children,
  style,
  padded = false,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  return <View style={[styles.base, padded && styles.padded, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    backgroundColor: colors.background,
    // react-native-web doesn't constrain width, so on a wide desktop browser
    // every screen stretches full-bleed. Capping and centering it here fixes
    // every screen at once.
    ...Platform.select({ web: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' } }),
  },
  padded: { padding: 16 },
});
