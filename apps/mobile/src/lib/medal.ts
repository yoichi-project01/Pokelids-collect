import type { PhotoMedal } from '@pokelids/shared';

export const MEDAL_LABEL: Record<PhotoMedal, string> = {
  GOLD: '🥇 位置情報一致',
  SILVER: '🥈 位置情報なし',
  NONE: '未確認',
};

export const MEDAL_BADGE_COLOR: Record<PhotoMedal, string> = {
  GOLD: 'rgba(212, 160, 23, 0.9)',
  SILVER: 'rgba(148, 158, 168, 0.9)',
  NONE: 'rgba(153, 153, 153, 0.6)',
};
