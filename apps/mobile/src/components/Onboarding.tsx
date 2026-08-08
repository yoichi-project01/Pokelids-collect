import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { requestLocationPermission } from '../lib/location';
import { hasSeenOnboarding, markOnboardingSeen } from '../lib/onboarding';
import { colors, radius, spacing, typography } from '../theme';

type Step = 'intro' | 'location';

// Shown once, on first launch (flag in AsyncStorage, same convention as
// guestStorage.ts). Two short screens rather than a longer slideshow —
// slideshows get swiped through unread — covering exactly what TASKS.md 6-1
// calls out as currently unexplained: guest recording, that it carries over
// on login, what the medals mean, and (separately, since it needs its own
// justification) why the app wants location access, asked for *before* the
// OS permission dialog rather than by it.
export function Onboarding() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<Step>('intro');
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    hasSeenOnboarding().then((seen) => {
      if (!seen) setVisible(true);
    });
  }, []);

  function finish() {
    setVisible(false);
    void markOnboardingSeen();
  }

  async function handleAllowLocation() {
    setRequesting(true);
    // Granted or denied, there's nothing more to ask here — a denial is
    // handled afterwards by the home screen's persistent banner (which can
    // also send the user to OS settings, unlike this one-time dialog).
    await requestLocationPermission();
    setRequesting(false);
    finish();
  }

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={finish}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {step === 'intro' ? (
            <>
              <Text style={styles.title}>ポケふたコレクトへようこそ</Text>
              <View style={styles.pointList}>
                <Text style={styles.point}>・ログインしなくても、記録を残せます</Text>
                <Text style={styles.point}>・記録は端末に保存され、あとからログインすれば引き継げます</Text>
                <Text style={styles.point}>
                  ・🥇 GOLDは位置情報が現地と一致した記録、🥈 SILVERは位置情報のない記録です
                </Text>
              </View>
              <Button title="次へ" onPress={() => setStep('location')} style={styles.primaryButton} />
              <Text style={styles.skipLink} onPress={finish} accessibilityRole="button">
                スキップ
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.title}>位置情報の利用について</Text>
              <Text style={styles.body}>
                近くのポケふたを探すために使います。並び替えのために一時的にサーバーへ送りますが、保存はされません。
              </Text>
              <Button
                title="位置情報を許可する"
                onPress={handleAllowLocation}
                loading={requesting}
                style={styles.primaryButton}
              />
              <Text style={styles.skipLink} onPress={finish} accessibilityRole="button">
                スキップ
              </Text>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
    width: '100%',
    maxWidth: 360,
  },
  title: { ...typography.title, textAlign: 'center' },
  pointList: { gap: spacing.sm },
  point: { ...typography.body, color: colors.textSecondary },
  body: { ...typography.body, color: colors.textSecondary },
  primaryButton: { marginTop: spacing.xs },
  skipLink: {
    ...typography.caption,
    textAlign: 'center',
    textDecorationLine: 'underline',
    paddingVertical: spacing.md,
    minHeight: 44,
  },
});
