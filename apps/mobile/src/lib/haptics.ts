import * as Haptics from 'expo-haptics';
import { AccessibilityInfo } from 'react-native';

// Cached synchronously so every haptic* function below can be a plain,
// fire-and-forget call — matching how they're actually used, inline in
// event handlers, not awaited as part of an async flow.
//
// Refreshed both once at import time and on every OS-level change (not just
// read once at startup): the "reduce motion" accessibility setting can be
// toggled mid-session from the OS settings app, with no app restart, and
// this app's behavior should follow along immediately rather than needing a
// reload. `AccessibilityInfo.addEventListener` returns an EmitterSubscription
// on native and an equivalent `{ remove() }` object on react-native-web
// (backed by a `prefers-reduced-motion` media query listener there) — both
// long-lived for the process's entire lifetime here, same pattern as
// toast.ts/api.ts's single module-level listeners.
let reduceMotion = false;

void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
  reduceMotion = enabled;
});
AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
  reduceMotion = enabled;
});

// Exported for CelebrationModal, whose spring + rotate entrance animation is
// exactly the kind of motion this OS setting exists to suppress — for
// someone with a vestibular disorder or motion-sickness sensitivity this
// isn't a matter of taste, it can make them physically ill. Read fresh here
// (a plain function, not a value snapshotted at import time) so a mid-session
// toggle is picked up the next time the modal opens.
export function isReduceMotionEnabled(): boolean {
  return reduceMotion;
}

// expo-haptics doesn't need a Platform.OS branch — on web it's backed by the
// Web Vibration API (or, on iOS Safari where that's unsupported, a
// checkbox-click trick that borrows Safari's own switch-toggle haptic; see
// node_modules/expo-haptics/src/ExpoHaptics.web.ts) and degrades to doing
// nothing rather than throwing when neither is available. Still wrapped
// defensively: a haptic failing must never break the action (recording, an
// error toast) it's attached to. This repo has hit "type-checks but doesn't
// actually work on web" twice before (1-3's Alert.alert, 6-5's
// RefreshControl) — this guards the opposite failure mode, an exception from
// the feedback call breaking the real one.
function fireAndForget(promise: Promise<void>): void {
  promise.catch(() => {});
}

// The base "it worked" pulse — used for a successful record (SILVER/NONE;
// GOLD adds hapticEmphasis on top) and wired into showToast's 'success' type
// in toast.ts so most call sites need no individual haptics call at all.
// Not suppressed under reduce-motion: this is functional status information
// (did the action succeed?), not a decorative flourish, and someone using
// this app one-handed/outdoors specifically because they're not looking at
// the screen still needs to know their record actually saved.
export function hapticSuccess(): void {
  fireAndForget(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

// エラー・拒否 — wired into showToast's default 'error' type in toast.ts.
// Same reduce-motion exemption as hapticSuccess, for the same reason.
export function hapticError(): void {
  fireAndForget(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}

// The extra weight on top of hapticSuccess for a GOLD record — reinforces it
// as the best of the three outcomes. This one *is* suppressed under
// reduce-motion: unlike the base success/error pulse, it's pure added
// emphasis, not information the user would otherwise miss.
export function hapticEmphasis(): void {
  if (reduceMotion) return;
  fireAndForget(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
}

// フィルタ切り替え・タブ切り替え — nothing succeeded or failed here, purely
// decorative reinforcement of a tap, so (unlike hapticSuccess/hapticError)
// this is fully suppressed under reduce-motion rather than just toned down.
export function hapticLight(): void {
  if (reduceMotion) return;
  fireAndForget(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}
