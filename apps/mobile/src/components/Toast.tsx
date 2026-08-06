import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { setToastListener, type ToastMessage } from '../lib/toast';
import { colors, radius, spacing, typography } from '../theme';

const DISMISS_AFTER_MS = 4000;
const FADE_MS = 200;

// Mounted once in the root layout. react-native-web's Alert.alert is a
// no-op, so this is the notify counterpart to confirm.ts's window.confirm
// fallback — except it works the same way on native and web, so no platform
// branch is needed here.
export function Toast() {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setToastListener((next) => {
      setToast(next);
      opacity.setValue(0);
      Animated.timing(opacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true }).start();
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(dismiss, DISMISS_AFTER_MS);
    });
    return () => setToastListener(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dismiss() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(
      ({ finished }) => {
        if (finished) setToast(null);
      },
    );
  }

  if (!toast) return null;

  return (
    <Animated.View style={[styles.wrapper, { opacity }]} pointerEvents="box-none">
      <Pressable
        onPress={dismiss}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[styles.card, toast.type === 'error' ? styles.cardError : styles.cardSuccess]}
      >
        <Text style={[styles.title, toast.type === 'error' ? styles.textError : styles.textSuccess]}>
          {toast.title}
        </Text>
        <Text style={styles.message}>{toast.message}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.xxl,
    alignItems: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.xs,
    width: '100%',
    maxWidth: 360,
  },
  cardError: { borderColor: colors.danger },
  cardSuccess: { borderColor: colors.accent },
  title: { ...typography.bodyMedium },
  textError: { color: colors.danger },
  textSuccess: { color: colors.accent },
  message: { ...typography.caption },
});
