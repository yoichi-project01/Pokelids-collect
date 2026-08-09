import type { PhotoMedal } from '@pokelids/shared';

// NONE used to read "未確認" — a photo badge that told the viewer something
// was pending verification, not that the GPS simply didn't match the poke
// lid's location. 📍 matches CelebrationModal's MEDAL_EMOJI for NONE, and
// the phrasing stays factual rather than alarming (4-4's "記録は保存されま
// した" tone) — this is a mismatch, not a failed upload.
export const MEDAL_LABEL: Record<PhotoMedal, string> = {
  GOLD: '🥇 位置情報一致',
  SILVER: '🥈 位置情報なし',
  NONE: '📍 位置情報不一致',
};

export const MEDAL_BADGE_COLOR: Record<PhotoMedal, string> = {
  GOLD: 'rgba(212, 160, 23, 0.9)',
  SILVER: 'rgba(148, 158, 168, 0.9)',
  NONE: 'rgba(153, 153, 153, 0.6)',
};
