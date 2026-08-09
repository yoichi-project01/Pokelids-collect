import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { AppHeader } from '../../src/components/AppHeader';
import { WebSafeAreaFloor } from '../../src/components/WebSafeAreaFloor';
import { hapticLight } from '../../src/lib/haptics';
import { colors, CONTENT_MAX_WIDTH } from '../../src/theme';

// Fires on every tab-bar button press, including re-tapping the already-
// active tab (React Navigation's `tabPress` doesn't distinguish that from an
// actual switch, and tracking "is this already focused" just to skip it
// isn't worth the complexity for a Light-weight buzz — see 6-7's note to cut
// this if it turns out to feel excessive in practice).
const tabHapticListeners = { tabPress: () => hapticLight() };

// On a wide desktop browser, the tab bar is drawn by the navigator itself
// (outside ScreenContainer), so without this it stretches full-bleed while
// the content below stays capped at CONTENT_MAX_WIDTH — the tab icons end up
// spread edge-to-edge instead of lining up with the content. (The header
// needs a different fix — see AppHeader's comment for why headerStyle can't
// do this for the header the way tabBarStyle does here.)
const webCenteredBar = Platform.select({
  web: { maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' as const, width: '100%' as const },
});

// Investigated 2026-08-09: 9823682's viewport-fit=cover + 100dvh fix was
// necessary but not sufficient on Android Chrome. Confirmed via computed
// styles that (a) expo-router's ExpoRoot already wraps the whole app in
// SafeAreaProvider automatically (nothing missing in app/_layout.tsx), and
// (b) env(safe-area-inset-bottom) does parse (not stripped, not a CSP
// issue) but resolves to 0px — a known Android Chrome limitation, not a
// wiring bug: unlike iOS Safari's home indicator, Android Chrome doesn't
// reliably surface the gesture-nav area through that CSS env var, even for
// an installed standalone PWA (see manifest.json) with viewport-fit=cover.
// So insets.bottom read 0 and the tab bar (overflow: visible, no DOM
// clipping involved) rendered flush with the physical bottom edge, right
// under the OS gesture pill, which visually cuts off the label. Patching
// tabBarStyle.paddingBottom directly (as first proposed) would only
// redistribute the tab bar's *existing* fixed height rather than growing
// it, since BottomTabBar.js only grows `height` from the JS-computed
// insets.bottom, not from a style override — so the fix instead re-provides
// a corrected SafeAreaInsetsContext with a floor, letting the library's own
// (already-correct) height + padding computation pick it up like it does
// for a real iOS inset. See WebSafeAreaFloor for the floor value and why
// iOS is unaffected.
export default function TabsLayout() {
  return (
    <WebSafeAreaFloor>
      <TabsInner />
    </WebSafeAreaFloor>
  );
}

function TabsInner() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerShadowVisible: false,
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontWeight: '600', fontSize: 17 },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, ...webCenteredBar },
        ...(Platform.OS === 'web' && {
          header: ({ options, route }) => (
            <AppHeader
              title={
                typeof options.headerTitle === 'string' ? options.headerTitle : (options.title ?? route.name)
              }
            />
          ),
        }),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '一覧',
          headerTitle: '収集進捗',
          tabBarIcon: ({ color, size }) => <Ionicons name="albums" color={color} size={size} />,
        }}
        listeners={tabHapticListeners}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: '地図',
          headerTitle: '地図で見る',
          tabBarIcon: ({ color, size }) => <Ionicons name="map" color={color} size={size} />,
        }}
        listeners={tabHapticListeners}
      />
      <Tabs.Screen
        name="collection"
        options={{
          title: 'コレクション',
          headerTitle: '自分の収集記録',
          tabBarIcon: ({ color, size }) => <Ionicons name="images" color={color} size={size} />,
        }}
        listeners={tabHapticListeners}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '設定',
          headerTitle: '設定',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings" color={color} size={size} />,
        }}
        listeners={tabHapticListeners}
      />
    </Tabs>
  );
}
