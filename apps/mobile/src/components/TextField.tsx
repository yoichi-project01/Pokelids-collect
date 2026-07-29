import { forwardRef } from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';
import { colors, radius, spacing } from '../theme';

export const TextField = forwardRef<TextInput, TextInputProps>(function TextField(props, ref) {
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={colors.textTertiary}
      {...props}
      style={[styles.field, props.style]}
    />
  );
});

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
