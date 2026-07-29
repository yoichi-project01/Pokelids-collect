import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { colors, radius, spacing } from '../theme';

export const PasswordField = forwardRef<TextInput, TextInputProps>(function PasswordField(props, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.wrapper}>
      <TextInput
        ref={ref}
        placeholderTextColor={colors.textTertiary}
        secureTextEntry={!visible}
        textContentType="password"
        {...props}
        style={[styles.field, props.style]}
      />
      <Pressable
        onPress={() => setVisible((v) => !v)}
        style={styles.toggle}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'パスワードを隠す' : 'パスワードを表示する'}
      >
        <Ionicons name={visible ? 'eye-off' : 'eye'} size={20} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { position: 'relative', justifyContent: 'center' },
  field: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingRight: spacing.xxl,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
  },
  toggle: { position: 'absolute', right: spacing.md, padding: spacing.xs },
});
