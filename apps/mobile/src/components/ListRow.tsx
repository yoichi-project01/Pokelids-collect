import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

export function ListRow({
  title,
  subtitle,
  imageUri,
  right,
  onPress,
  showChevron = true,
}: {
  title: string;
  subtitle?: string;
  imageUri?: string | null;
  right?: ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      {imageUri && <Image source={{ uri: imageUri }} style={styles.thumb} />}
      <View style={styles.textBlock}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {right}
      {showChevron && <Text style={styles.chevron}>›</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pressed: { backgroundColor: colors.background },
  thumb: { width: 48, height: 48, borderRadius: radius.sm, backgroundColor: colors.background },
  textBlock: { flex: 1, gap: 2 },
  title: { ...typography.bodyMedium },
  subtitle: { ...typography.caption },
  chevron: { fontSize: 20, color: colors.textTertiary, marginLeft: spacing.xs },
});
