import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../theme';

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
  base: { flex: 1, backgroundColor: colors.background },
  padded: { padding: 16 },
});
