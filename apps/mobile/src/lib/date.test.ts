import { describe, expect, it } from 'vitest';
import { formatDateJST } from './date';

describe('formatDateJST', () => {
  it('formats an ordinary JST evening time', () => {
    expect(formatDateJST(new Date('2026-01-01T23:30:00+09:00'))).toBe('2026年1月1日');
  });

  it('accepts an ISO string directly, not just a Date', () => {
    expect(formatDateJST('2026-01-01T23:30:00+09:00')).toBe('2026年1月1日');
  });

  it('is JST 2026-01-02 just after midnight, even though the same instant is still 2026-01-01 in UTC', () => {
    // 2026-01-02T00:00:30+09:00 === 2026-01-01T15:00:30Z
    expect(formatDateJST(new Date('2026-01-02T00:00:30+09:00'))).toBe('2026年1月2日');
  });

  it('is still JST 2026-01-01 one second before midnight', () => {
    expect(formatDateJST(new Date('2026-01-01T23:59:59+09:00'))).toBe('2026年1月1日');
  });

  it('crosses a JST day boundary that formatting without an explicit timeZone would miss', () => {
    // This instant is 2026-01-01T00:00:01+09:00 in JST, but
    // 2025-12-31T15:00:01Z in UTC. A formatter relying on the process's
    // local timezone would show December 31st wherever that isn't JST
    // (e.g. a UTC-configured CI runner, or a future static-generation build
    // server — see 5-1 in TASKS.md).
    expect(formatDateJST(new Date('2025-12-31T15:00:01Z'))).toBe('2026年1月1日');
  });
});
