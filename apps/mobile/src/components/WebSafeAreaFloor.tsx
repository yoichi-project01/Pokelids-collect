import type { PropsWithChildren } from 'react';
import { Platform } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';

// Android Chrome does not reliably report the height of the gesture
// navigation area through `env(safe-area-inset-bottom)` — verified directly
// (see the investigation notes in (tabs)/_layout.tsx): the SafeAreaProvider
// is mounted, viewport-fit=cover is set, and env() does parse, it just
// resolves to 0px. iOS Safari's home indicator, by contrast, reports a real
// value there. So `useSafeAreaInsets().bottom` is trustworthy on iOS but not
// on Android web, even though the gesture pill visually sits over the same
// pixels. 24 approximates Android's systemGestures() bottom inset on a
// gesture-nav device — comfortably larger than needed on 3-button-nav
// devices (which don't overlay content) and on desktop (no OS chrome to
// clear at all), so this floor is applied unconditionally on web rather
// than sniffed by user agent. `Math.max` means a real, larger iOS inset is
// never shrunk by this.
const ANDROID_GESTURE_BAR_FLOOR = 24;

export function WebSafeAreaFloor({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <SafeAreaInsetsContext.Provider
      value={{ ...insets, bottom: Math.max(insets.bottom, ANDROID_GESTURE_BAR_FLOOR) }}
    >
      {children}
    </SafeAreaInsetsContext.Provider>
  );
}
