import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getApiBaseUrl } from '../lib/api';
import type { Coordinates } from '../lib/location';
import { buildMapHtml, type MapMarkerData } from '../lib/mapHtml';
import { colors, radius, spacing, typography } from '../theme';

// Web counterpart of HomeMapPreview.tsx — same non-interactive,
// centered-on-the-user preview, an <iframe> here instead of a WebView (same
// map.tsx/map.web.tsx split this app already has for the real map tab). See
// that file's own doc comment for the design reasoning (interactive: false,
// tap-through to the map tab).
const PREVIEW_ASPECT_RATIO = 21 / 9;
const PREVIEW_ZOOM = 12;

export function HomeMapPreview({
  markers,
  location,
  nearbyCount,
  nearbyRangeKm,
  onPress,
}: {
  markers: MapMarkerData[];
  location: Coordinates | null;
  nearbyCount: number | null;
  nearbyRangeKm: number;
  onPress: () => void;
}) {
  const html = useMemo(
    () =>
      buildMapHtml(
        markers,
        getApiBaseUrl(),
        location ? { lat: location.latitude, lng: location.longitude } : null,
        {
          interactive: false,
          initialView: location
            ? { lat: location.latitude, lng: location.longitude, zoom: PREVIEW_ZOOM }
            : undefined,
        },
      ),
    [markers, location],
  );

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="地図で見る"
      style={styles.container}
    >
      <iframe
        title="ポケふたマップのプレビュー"
        srcDoc={html}
        // pointerEvents: 'none' — same reasoning as the native variant's
        // WebView prop: the map itself is non-interactive already, this just
        // guarantees the outer Pressable/<a>-equivalent gets the click.
        style={{ border: 'none', width: '100%', height: '100%', pointerEvents: 'none' }}
      />
      <View style={styles.mapLabel}>
        <Text style={styles.mapLabelText}>地図で見る ›</Text>
      </View>
      {nearbyCount !== null && (
        <View style={styles.nearbyBadge}>
          <Text style={styles.nearbyBadgeText}>
            {nearbyRangeKm}kmに{nearbyCount}件
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: PREVIEW_ASPECT_RATIO,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  mapLabel: {
    position: 'absolute',
    left: spacing.sm,
    bottom: spacing.sm,
    backgroundColor: colors.overlay,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  mapLabelText: { ...typography.footnote, color: colors.white, fontWeight: '600' },
  nearbyBadge: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    backgroundColor: colors.overlay,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  nearbyBadgeText: { ...typography.footnote, color: colors.white, fontWeight: '700' },
});
