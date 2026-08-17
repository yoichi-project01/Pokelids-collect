import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { getApiBaseUrl } from '../lib/api';
import type { Coordinates } from '../lib/location';
import { buildMapHtml, type MapMarkerData } from '../lib/mapHtml';
import { colors, radius, spacing, typography } from '../theme';

// Home screen redesign: a small, non-interactive map preview at the top of
// the screen (native — see HomeMapPreview.web.tsx for the iframe variant),
// reusing the exact same buildMapHtml the real map tab uses (useMapMarkers'
// full-fidelity marker rendering, clustering, pin coloring) but with
// `interactive: false` and centered on the user — see buildMapHtml's own
// doc comment for why. The whole thing is one tap target that hands off to
// the real map tab; it deliberately doesn't try to be a second, smaller map
// screen.
const PREVIEW_ASPECT_RATIO = 21 / 9;
// Roughly "a city," not "a neighborhood" — wide enough that a handful of
// nearby pins are visible without the preview reading as empty in
// less-dense areas, tight enough to still look meaningfully "zoomed in"
// versus the real map tab's own all-Japan default.
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
  // null when there's no location fix to count "nearby" against — the badge
  // is omitted entirely in that case, rather than showing a 0 that would
  // misleadingly read as "nothing nearby" instead of "unknown."
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
      <WebView
        style={StyleSheet.absoluteFill}
        originWhitelist={['*']}
        source={{ html }}
        scrollEnabled={false}
        // The map itself has no gestures to receive (interactive: false
        // above) — this just makes sure the *outer* Pressable reliably gets
        // every tap rather than the WebView's native view intercepting it
        // first on some Android versions.
        pointerEvents="none"
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
