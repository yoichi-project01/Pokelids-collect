import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { AppHeader } from '../../src/components/AppHeader';
import { colors, CONTENT_MAX_WIDTH } from '../../src/theme';

// On a wide desktop browser, the tab bar is drawn by the navigator itself
// (outside ScreenContainer), so without this it stretches full-bleed while
// the content below stays capped at CONTENT_MAX_WIDTH — the tab icons end up
// spread edge-to-edge instead of lining up with the content. (The header
// needs a different fix — see AppHeader's comment for why headerStyle can't
// do this for the header the way tabBarStyle does here.)
const webCenteredBar = Platform.select({
  web: { maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' as const, width: '100%' as const },
});

export default function TabsLayout() {
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
          headerTitle: 'ポケふた収集進捗',
          tabBarIcon: ({ color, size }) => <Ionicons name="albums" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: '地図',
          headerTitle: '地図で見る',
          tabBarIcon: ({ color, size }) => <Ionicons name="map" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="collection"
        options={{
          title: 'コレクション',
          headerTitle: '自分の収集記録',
          tabBarIcon: ({ color, size }) => <Ionicons name="images" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '設定',
          headerTitle: '設定',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
