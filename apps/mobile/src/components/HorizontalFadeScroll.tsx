import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors } from '../theme';

// A right-edge fade-to-background overlay for horizontally scrolling card
// rows (home screen's "次に集めよう"/"もう少しで達成"), so a scrollable row
// reads as scrollable at a glance instead of relying on how much of the next
// card happens to peek past the screen edge — which varies by device width
// and was reported as too subtle to notice on some devices. Built from a few
// stacked semi-transparent strips rather than a real gradient: this app has
// no gradient library (e.g. expo-linear-gradient), and this is the only
// place that would need one, so a cheap approximation avoids pulling in a
// native dependency (extra native rebuild + Docker rebuild) for one visual
// hint.
//
// Purely decorative (pointerEvents="none", so it never intercepts the scroll
// or card taps underneath it) and only rendered once the row is actually
// measured to overflow its own width via onLayout/onContentSizeChange — a
// row short enough to already show every card entirely shouldn't hint at
// content that isn't there.
const FADE_STRIP_OPACITIES = [0.1, 0.28, 0.55, 0.85];
const FADE_STRIP_WIDTH = 10;

export function HorizontalFadeScroll({
  children,
  contentContainerStyle,
  fadeColor = colors.surface,
}: {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  // Matches the surrounding section's own background so the fade blends in
  // rather than reading as a gray box — index.tsx's two carousels both sit
  // on `colors.surface`, not the screen's own `colors.background`.
  fadeColor?: string;
}) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const overflowing = contentWidth > containerWidth;

  return (
    <View
      style={styles.wrapper}
      onLayout={(e: LayoutChangeEvent) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={contentContainerStyle}
        onContentSizeChange={(width) => setContentWidth(width)}
      >
        {children}
      </ScrollView>
      {overflowing && (
        <View style={styles.fade} pointerEvents="none">
          {FADE_STRIP_OPACITIES.map((opacity, i) => (
            <View key={i} style={[styles.fadeStrip, { opacity, backgroundColor: fadeColor }]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'relative' },
  fade: { position: 'absolute', top: 0, bottom: 0, right: 0, flexDirection: 'row' },
  fadeStrip: { width: FADE_STRIP_WIDTH },
});
