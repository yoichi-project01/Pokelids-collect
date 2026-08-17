import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { spacing } from '../theme';

// Shared by PokeLidCard's own card padding and this module's placeholder
// cells, so the two can't drift apart from each other independently.
export const GRID_CELL_PADDING = spacing.xs;

// Breakpoints are on window width, not the content width ScreenContainer
// actually caps the grid at on web (CONTENT_MAX_WIDTH, theme.ts) — a wide
// window still means a wide content area up to that cap, so a window this
// wide still gets the wider tiers below even past the point where the grid
// itself stops growing.
//
// SIX_COLUMN was added alongside CONTENT_MAX_WIDTH's 2026-08-17 widening
// (720 → 1200) — before that, no window was ever wide enough for the
// *capped* grid to usefully fit more than 5 columns, so there was nothing
// between 5 and "however many happened to fit," which never came up.
// Deliberately stops at 6, not 7: at CONTENT_MAX_WIDTH=1200, 7 columns works
// out to ~139px/card — the same size as a 320px phone's existing 2-column
// layout, i.e. "more small cards," not "bigger cards." 6 columns
// (~189px/card) actually reads as bigger, which matters more for an
// illustration-forward app than raw column count — see theme.ts's own
// comment on CONTENT_MAX_WIDTH for the same reasoning applied to the width
// cap itself. The threshold is picked relative to CONTENT_MAX_WIDTH itself
// (roughly window-width-at-which-the-1200px cap is already reached, plus
// margin) rather than an independent guess, since past that point window
// width no longer changes the grid's actual available space.
const SIX_COLUMN_MIN_WIDTH = 1300;
const FIVE_COLUMN_MIN_WIDTH = 600;
const THREE_COLUMN_MIN_WIDTH = 380;

export function useResponsiveColumns(): number {
  const { width } = useWindowDimensions();
  if (width >= SIX_COLUMN_MIN_WIDTH) return 6;
  if (width >= FIVE_COLUMN_MIN_WIDTH) return 5;
  if (width >= THREE_COLUMN_MIN_WIDTH) return 3;
  return 2;
}

// Same breakpoint as the 2-column grid floor above: below it, a screen is
// narrow enough that two-across layouts (e.g. stat cards) get cramped, so
// callers stack to a single column instead.
export function useIsNarrowScreen(): boolean {
  const { width } = useWindowDimensions();
  return width < THREE_COLUMN_MIN_WIDTH;
}

// FlatList's numColumns wraps each row in a bare View and gives every cell
// flex: 1; when the last row has fewer items than `columns`, those flex: 1
// cells absorb the row's leftover width and stretch — most visibly on
// PokeLidCard, whose image uses aspectRatio: 1, so a 3x-wide cell means a 3x
// tall image too. Padding `data` out to a multiple of `columns` with `null`
// placeholders (rendered as an empty, same-flex cell) keeps every card in
// every row the same width, no matter how many trailing items there are.
//
// Plain function (not a hook) so it can also be called once per section
// inside a loop — see chunkIntoRows below — where useGridData's hook form
// can't be (rules of hooks forbid calling a hook a variable number of times).
export function padToColumns<T>(data: T[], columns: number): (T | null)[] {
  const remainder = data.length % columns;
  if (remainder === 0) return data;
  return [...data, ...Array<null>(columns - remainder).fill(null)];
}

// Takes `columns` as an argument rather than a hardcoded constant so it
// works with useResponsiveColumns' dynamic column count above.
export function useGridData<T>(data: T[], columns: number): (T | null)[] {
  return useMemo(() => padToColumns(data, columns), [data, columns]);
}

// SectionList has no `numColumns` (that's FlatList-only), so a per-section
// grid (7-5's municipality grouping) has to chunk each section's items into
// fixed-width rows itself and render one row per SectionList item — this is
// that chunking, reusing padToColumns so the last row of each section gets
// the same placeholder treatment as a flat grid's last row.
export function chunkIntoRows<T>(data: T[], columns: number): (T | null)[][] {
  const padded = padToColumns(data, columns);
  const rows: (T | null)[][] = [];
  for (let i = 0; i < padded.length; i += columns) {
    rows.push(padded.slice(i, i + columns));
  }
  return rows;
}

// A plain `(item) => item.id` keyExtractor crashes on the `null`
// placeholders useGridData adds — this gives each of them a stable,
// position-based key instead.
export function gridKeyExtractor<T>(keyOf: (item: T) => string) {
  return (item: T | null, index: number): string => (item === null ? `placeholder-${index}` : keyOf(item));
}

// Same idea as gridKeyExtractor, but for chunkIntoRows' output: SectionList's
// data items are whole rows, not individual cards. A row always has at least
// one real (non-null) item — chunkIntoRows only pads the last row of
// non-empty input, never produces an all-placeholder row — so that item's id
// is a stable, globally-unique key for the row.
export function rowKeyExtractor<T>(keyOf: (item: T) => string) {
  return (row: (T | null)[]): string => {
    const first = row.find((item): item is T => item !== null);
    return first ? keyOf(first) : 'empty-row';
  };
}
