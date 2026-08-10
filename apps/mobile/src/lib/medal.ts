import type { PhotoMedal } from '@pokelids/shared';
import { colors } from '../theme';

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

export interface MedalBadgeColor {
  bg: string;
  fg: string;
}

// A single dark `colors.gold` fill (tried in 8f5a480) reads as a muddy
// bronze dot/bar, not a gold medal — accessible but visually deflating for
// what ROADMAP.md calls the core of the app's payoff moment. Pairing a pale
// backdrop with the dark text/fill color (7-7) gets the "gold medal" look
// back without giving up the contrast fix; the backdrop itself is exempt
// from WCAG text-contrast rules since nothing is printed on it directly.
// SILVER/NONE are given the same {bg, fg} shape for one consistent badge
// component, using the design proposal's own values rather than inventing
// new ones.
export const MEDAL_BADGE_COLOR: Record<PhotoMedal, MedalBadgeColor> = {
  GOLD: { bg: colors.goldSurface, fg: colors.gold },
  SILVER: { bg: '#EDEEF0', fg: '#454C52' },
  // #4B5B57 is colors.textSecondary — reused rather than duplicated since
  // "unmatched" isn't really its own color identity, just a neutral badge.
  NONE: { bg: '#F1EFEA', fg: colors.textSecondary },
};

// Compact glyph for the settings screen's medal legend, where the badge is
// small enough that the full MEDAL_LABEL text wouldn't fit legibly.
export const MEDAL_SHORT_LABEL: Record<PhotoMedal, string> = {
  GOLD: '金',
  SILVER: '銀',
  NONE: '—',
};
