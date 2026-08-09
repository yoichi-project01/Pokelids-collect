import { useEffect, useState } from 'react';
import { Image, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { countsTowardProgress, type PokeLidDto } from '@pokelids/shared';
import POKE_LIDS from '../data/poke-lids.json';
import { Button } from './Button';
import { grayscaleStyle } from './PokeLidCard';
import { requestLocationPermission } from '../lib/location';
import { hasSeenOnboarding, markOnboardingSeen } from '../lib/onboarding';
import { colors, radius, spacing, typography } from '../theme';

type Step = 'intro' | 'location';

// Static across the app's lifetime (bundled JSON, same source as 7-4's
// totalPokeLidsNationwide) — computed once at module scope rather than
// inside the component so it isn't redone on every mount.
const TOTAL_POKE_LIDS_NATIONWIDE = (POKE_LIDS as PokeLidDto[]).filter((l) =>
  countsTowardProgress(l.retiredAt),
).length;

// First three with an image, deterministic (not random) so the screen
// doesn't shift between runs. Two are shown desaturated and one in full
// color purely to illustrate "collecting fills it in" — which three doesn't
// matter, since nothing here claims these specific ones are collected.
const SAMPLE_IMAGES = (POKE_LIDS as PokeLidDto[])
  .filter((l): l is PokeLidDto & { officialImageUrl: string } => Boolean(l.officialImageUrl))
  .slice(0, 3)
  .map((l) => l.officialImageUrl);

// Shown once, on first launch (flag in AsyncStorage, same convention as
// guestStorage.ts). Two short screens rather than a longer slideshow —
// slideshows get swiped through unread. The intro screen sells the app's
// scale and how little it asks of you; the medal system is explained later,
// in CelebrationModal, right when a first-time user actually earns one —
// explaining it here, before anyone has a single record, didn't land (6-1
// rework). Location stays a separate screen since it needs its own
// justification, asked for *before* the OS permission dialog rather than by
// it.
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
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {step === 'intro' ? (
              <>
                <Text style={styles.title}>全国{TOTAL_POKE_LIDS_NATIONWIDE}箇所のポケふたを集めよう</Text>
                <View style={styles.sampleRow}>
                  {SAMPLE_IMAGES.map((uri, index) => (
                    <Image
                      key={uri}
                      source={{ uri }}
                      style={[styles.sampleImage, index < 2 && grayscaleStyle]}
                    />
                  ))}
                </View>
                <Text style={styles.caption}>訪れて撮影すると、色がつきます</Text>
                <Text style={styles.body}>写真を撮るだけで記録。ログインは後からで大丈夫です</Text>
              </>
            ) : (
              <>
                <Text style={styles.title}>位置情報の利用について</Text>
                <Text style={styles.body}>
                  近くのポケふたを探すために使います。並び替えのために一時的にサーバーへ送りますが、保存はされません。
                </Text>
              </>
            )}
          </ScrollView>
          <View style={styles.actions}>
            <Button title="あとで" onPress={finish} variant="secondary" style={styles.actionButton} />
            {step === 'intro' ? (
              <Button title="次へ" onPress={() => setStep('location')} style={styles.actionButton} />
            ) : (
              <Button
                title="許可する"
                onPress={handleAllowLocation}
                loading={requesting}
                style={styles.actionButton}
              />
            )}
          </View>
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
    width: '100%',
    maxWidth: 360,
    // Bounded rather than sized to content so the ScrollView below can
    // actually scroll on a small screen or with large system font sizes,
    // instead of just overflowing the card (same approach as
    // CelebrationModal).
    maxHeight: '100%',
    overflow: 'hidden',
  },
  scrollContent: { alignItems: 'center', gap: spacing.md, padding: spacing.xl },
  title: { ...typography.title, textAlign: 'center' },
  sampleRow: { flexDirection: 'row', gap: spacing.sm, alignSelf: 'stretch' },
  sampleImage: { flex: 1, aspectRatio: 1, borderRadius: radius.md, backgroundColor: colors.border },
  caption: { ...typography.footnote, textAlign: 'center' },
  body: { ...typography.body, color: colors.textPrimary, textAlign: 'center' },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignSelf: 'stretch',
    padding: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  actionButton: { flex: 1 },
});
