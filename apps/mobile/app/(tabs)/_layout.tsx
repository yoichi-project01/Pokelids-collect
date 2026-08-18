import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { AppHeader } from '../../src/components/AppHeader';
import { hapticLight } from '../../src/lib/haptics';
import { CHROME_MAX_WIDTH, colors } from '../../src/theme';

// Fires on every tab-bar button press, including re-tapping the already-
// active tab (React Navigation's `tabPress` doesn't distinguish that from an
// actual switch, and tracking "is this already focused" just to skip it
// isn't worth the complexity for a Light-weight buzz — see 6-7's note to cut
// this if it turns out to feel excessive in practice).
const tabHapticListeners = { tabPress: () => hapticLight() };

// On a wide desktop browser, the tab bar is drawn by the navigator itself
// (outside ScreenContainer), so without this it stretches full-bleed. Capped
// at CHROME_MAX_WIDTH, not ScreenContainer's own (wider) CONTENT_MAX_WIDTH —
// see that constant's comment in theme.ts: 4 tab icons spread across a
// 1040px bar leave awkwardly large gaps between them, so this stays at the
// narrower pre-2026-08-17 width intentionally, same choice AppHeader makes
// for its own row. (The header needs a different fix — see AppHeader's
// comment for why headerStyle can't do this for the header the way
// tabBarStyle does here.)
const webCenteredBar = Platform.select({
  web: { maxWidth: CHROME_MAX_WIDTH, alignSelf: 'center' as const, width: '100%' as const },
});

export default function TabsLayout() {
  return <TabsInner />;
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
        // react-navigation's default tabBarLabelStyle only sets fontSize: 10
        // with no explicit lineHeight, so it falls back to the browser's
        // `normal` line-height metric. That metric is derived from the font's
        // ascent/descent hints, which for Latin text roughly match the actual
        // glyph ink — but Japanese glyphs (measured directly via computed
        // style: fontSize 10px, line-height normal computing to a 10px box)
        // render taller than that, so numberOfLines=1's overflow:hidden clips
        // ~3px off the bottom of every Japanese label. Raising lineHeight
        // gives the line box enough headroom to contain the full glyph.
        tabBarLabelStyle: { fontSize: 10, lineHeight: 14 },
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
          title: 'ホーム',
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
        name="pokedex"
        options={{
          title: '図鑑',
          headerTitle: 'ポケふた図鑑',
          tabBarIcon: ({ color, size }) => <Ionicons name="book" color={color} size={size} />,
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
