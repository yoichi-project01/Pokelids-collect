import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import {
  dismissInstallPrompt,
  getInstallPromptKind,
  setInstallPromptListener,
  triggerNativeInstallPrompt,
  type InstallPromptKind,
} from '../lib/installPrompt';
import { colors, radius, spacing, typography } from '../theme';

// 7-10: shown once a guest has a few records worth protecting (see
// installPrompt.ts's maybeShowInstallPrompt for exactly when). Deliberately
// smaller/lower-key than Onboarding's full "全国481箇所" card — this is a
// suggestion made in passing, not a first-run pitch.
export function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [kind, setKind] = useState<InstallPromptKind>('unavailable');
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    setInstallPromptListener(() => {
      // Re-checked at show time, not just at the maybeShowInstallPrompt
      // call site — kind can only be known synchronously right when
      // there's a captured beforeinstallprompt event or a UA to sniff, and
      // re-deriving it here keeps installPrompt.ts's own check and this
      // component's render from silently drifting apart.
      const currentKind = getInstallPromptKind();
      if (currentKind === 'unavailable') return;
      setKind(currentKind);
      setVisible(true);
    });
    return () => setInstallPromptListener(null);
  }, []);

  async function onDismiss() {
    setVisible(false);
    await dismissInstallPrompt();
  }

  async function onInstall() {
    setInstalling(true);
    try {
      await triggerNativeInstallPrompt();
    } finally {
      setInstalling(false);
      setVisible(false);
      // Accepted or declined, either way this specific prompt has done its
      // job — the OS-level install UI (if accepted) or the user's own
      // choice (if not) replaces the need to ask again soon.
      await dismissInstallPrompt();
    }
  }

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>ホーム画面に追加しませんか？</Text>
          {kind === 'native' ? (
            <>
              <Text style={styles.body}>
                アイコンからすぐ開けるようになり、記録もこの端末に残りやすくなります。
              </Text>
              <Button title="追加する" onPress={onInstall} loading={installing} />
              <Button title="あとで" onPress={onDismiss} variant="secondary" />
            </>
          ) : (
            <>
              <View style={styles.iosSteps}>
                <Text style={styles.body}>
                  <Ionicons name="share-outline" size={16} color={colors.textPrimary} />{' '}
                  共有ボタンをタップして
                </Text>
                <Text style={styles.body}>「ホーム画面に追加」を選んでください。</Text>
              </View>
              <Text style={styles.caption}>
                アイコンからすぐ開けるようになり、記録もこの端末に残りやすくなります。
              </Text>
              <Button title="わかりました" onPress={onDismiss} variant="secondary" />
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
    justifyContent: 'flex-end',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    width: '100%',
    maxWidth: 420,
  },
  title: { ...typography.bodyMedium, textAlign: 'center' },
  body: { ...typography.body, textAlign: 'center' },
  iosSteps: { gap: spacing.xs / 2 },
  caption: { ...typography.caption, textAlign: 'center' },
});
