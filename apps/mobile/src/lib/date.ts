// This app's dates are all "where in Japan, and when" — visitedAt is always
// a trip to a physical poke lid in Japan, so JST is the only timezone that
// makes sense to display in, regardless of where the device (or, once 5-1's
// static generation lands, the build server) actually is. An explicit
// `timeZone` makes Intl.DateTimeFormat ignore the runtime's local timezone
// entirely, so this is deterministic no matter what TZ the process runs
// under.
const JST_DATE_FORMATTER = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

export function formatDateJST(date: Date | string): string {
  return JST_DATE_FORMATTER.format(typeof date === 'string' ? new Date(date) : date);
}
