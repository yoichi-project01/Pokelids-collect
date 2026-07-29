import type { ReactNode } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

// Grayscale + dimmed for uncollected, full color once collected — same
// "pokédex" metaphor as the games: color fills in as you actually visit.
const grayscaleStyle = Platform.select<object>({
  web: { filter: 'grayscale(1)' },
  default: { filter: [{ grayscale: 1 }] },
});

export function PokeLidCard({
  imageUri,
  title,
  subtitle,
  collected,
  badge,
  onPress,
}: {
  imageUri?: string | null;
  title: string;
  subtitle?: string;
  collected: boolean;
  badge?: ReactNode;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}${collected ? '（収集済み）' : '（未収集）'}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.imageWrapper}>
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={[styles.image, !collected && styles.uncollectedImage, !collected && grayscaleStyle]}
            accessibilityLabel={title}
          />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]} />
        )}
        {badge && <View style={styles.badge}>{badge}</View>}
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {subtitle && (
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, gap: spacing.xs, padding: spacing.xs },
  pressed: { opacity: 0.7 },
  imageWrapper: { position: 'relative' },
  image: { width: '100%', aspectRatio: 1, borderRadius: radius.md, backgroundColor: colors.border },
  imagePlaceholder: { backgroundColor: colors.border },
  uncollectedImage: { opacity: 0.4 },
  badge: { position: 'absolute', bottom: 4, right: 4 },
  title: { ...typography.footnote, fontWeight: '600', color: colors.textPrimary },
  subtitle: { ...typography.footnote },
});
