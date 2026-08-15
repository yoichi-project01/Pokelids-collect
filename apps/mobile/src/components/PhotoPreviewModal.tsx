import { isPhotoLocationMismatch, PHOTO_LOCATION_MISMATCH_THRESHOLD_METERS } from '@pokelids/shared';
import { Image, Modal, StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { formatDistanceMeters } from '../lib/formatDistance';
import { colors, radius, spacing, typography } from '../theme';

// Shown between picking a photo and actually uploading it. Without this,
// a blurry or finger-covered shot went straight to the server — see 4-4.
export function PhotoPreviewModal({
  visible,
  uri,
  source,
  distanceMeters = null,
  pokeLidMunicipality = '',
  onConfirm,
  onRetake,
  onDismiss,
}: {
  visible: boolean;
  uri: string | null;
  source: 'camera' | 'library';
  // The picked photo's EXIF-derived distance from the poke lid the user
  // selected, read client-side at pick time (see poke-lids/[id].tsx's
  // onPickPhoto) — null whenever the photo has no GPS in its EXIF, in
  // which case the warning below never renders (see this feature's own
  // design note: no location data is not evidence of a mistake).
  //
  // Optional — omitted (not just null) by the map's quick-record flow
  // (map.tsx/map.web.tsx via useQuickRecord), which only ever launches the
  // camera after its own QUICK_RECORD_RADIUS_METERS live-GPS gate already
  // confirmed the device is within 200m of this exact poke lid. That gate
  // is a stronger, earlier check than this warning (whole-device position
  // before the camera even opens, vs. one photo's EXIF after capture), so
  // wiring the same warning through there would either duplicate a check
  // that already passed or need its own poke-lid-coordinate plumbing this
  // hook doesn't currently carry — not worth it for a mistake that flow
  // structurally can't produce the way the browse-then-pick flow can.
  distanceMeters?: number | null;
  pokeLidMunicipality?: string;
  onConfirm: () => void;
  onRetake: () => void;
  // Android hardware back / iOS swipe-to-dismiss — closer to "never mind"
  // than "撮り直す", so it discards the pending photo rather than
  // relaunching the picker.
  onDismiss: () => void;
}) {
  if (!uri) return null;

  // A confirmation, not a block: GPS drifts near buildings/underground, and
  // some users register a photo later from home — neither is a mistake, so
  // this only ever adds a step, never a gate. `distanceMeters !== null` is
  // redundant with isPhotoLocationMismatch's own null check but keeps
  // TypeScript's control-flow narrowing happy for the template string below.
  const showLocationWarning =
    distanceMeters !== null &&
    isPhotoLocationMismatch(distanceMeters, PHOTO_LOCATION_MISMATCH_THRESHOLD_METERS);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Image source={{ uri }} style={styles.preview} />
          {showLocationWarning && distanceMeters !== null && (
            // attention, not danger — this never blocks recording (see the
            // showLocationWarning comment above), so it must not read as an
            // error. colors.background (not accentLight/goldSurface) keeps
            // it visually distinct from the medal badges (7-7) and the "あと
            // 1つ" attention text elsewhere (7-5), which are plain text with
            // no card of their own — this is the one attention-colored
            // element in the app that also needs its own boxed background,
            // since it sits between a photo and action buttons rather than
            // inline in a list row.
            <View style={styles.warning}>
              <Text style={styles.warningText}>
                この写真は「{pokeLidMunicipality}」から{formatDistanceMeters(distanceMeters)}
                離れた場所で撮影されています。{'\n'}選んだポケふたが違うかもしれません。
              </Text>
            </View>
          )}
          <Text style={styles.hint}>この写真で記録しますか？</Text>
          <View style={styles.actions}>
            <Button
              title={source === 'camera' ? '撮り直す' : '選び直す'}
              onPress={onRetake}
              variant="secondary"
              style={styles.actionButton}
            />
            <Button title="記録する" onPress={onConfirm} style={styles.actionButton} />
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
    padding: spacing.lg,
    gap: spacing.md,
    width: '100%',
    maxWidth: 420,
  },
  preview: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.md,
    backgroundColor: colors.background,
  },
  hint: { ...typography.bodyMedium, textAlign: 'center' },
  warning: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  warningText: { ...typography.footnote, color: colors.attention, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: spacing.sm },
  actionButton: { flex: 1 },
});
