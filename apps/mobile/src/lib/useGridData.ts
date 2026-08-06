import { useMemo } from 'react';

// FlatList's numColumns wraps each row in a bare View and gives every cell
// flex: 1; when the last row has fewer items than `columns`, those flex: 1
// cells absorb the row's leftover width and stretch — most visibly on
// PokeLidCard, whose image uses aspectRatio: 1, so a 3x-wide cell means a 3x
// tall image too. Padding `data` out to a multiple of `columns` with `null`
// placeholders (rendered as an empty, same-flex cell) keeps every card in
// every row the same width, no matter how many trailing items there are.
//
// Takes `columns` as an argument rather than a hardcoded constant so it
// keeps working once the column count becomes responsive (3-2).
export function useGridData<T>(data: T[], columns: number): (T | null)[] {
  return useMemo(() => {
    const remainder = data.length % columns;
    if (remainder === 0) return data;
    return [...data, ...Array<null>(columns - remainder).fill(null)];
  }, [data, columns]);
}

// A plain `(item) => item.id` keyExtractor crashes on the `null`
// placeholders useGridData adds — this gives each of them a stable,
// position-based key instead.
export function gridKeyExtractor<T>(keyOf: (item: T) => string) {
  return (item: T | null, index: number): string => (item === null ? `placeholder-${index}` : keyOf(item));
}
