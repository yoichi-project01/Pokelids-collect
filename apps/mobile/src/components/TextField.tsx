import { StyleSheet, TextInput, type TextInputProps } from 'react-native';
import { colors, radius, spacing } from '../theme';

export function TextField(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.textTertiary} {...props} style={[styles.field, props.style]} />;
}

const styles = StyleSheet.create({
  field: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
  },
});
