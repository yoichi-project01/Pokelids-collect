import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius } from '../theme';

// The map screens (map.tsx / map.web.tsx) render the poke lid list inside a
// WebView/iframe running Leaflet, not a FlatList or ScrollView, so there's
// nowhere to attach the platform pull-to-refresh gesture (see 6-5 in
// TASKS.md). This button is the map's equivalent: same underlying
// useMapMarkers().reload() as the other screens' onRefresh, just triggered
// by a tap instead of a swipe.
const HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 };

export function MapRefreshButton({ refreshing, onPress }: { refreshing: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={refreshing}
      hitSlop={HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel="地図を更新"
      style={({ pressed }) => [
        styles.button,
        pressed && !refreshing && styles.pressed,
        refreshing && styles.disabled,
      ]}
    >
      {refreshing ? (
        <ActivityIndicator size="small" color={colors.textSecondary} />
      ) : (
        <Text style={styles.icon}>⟳</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    marginLeft: 'auto',
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    borderWidth: 1,
    // borderStrong (7-8), not border — this is a tappable button, not a
    // divider.
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
  icon: { fontSize: 16, color: colors.textSecondary },
});
