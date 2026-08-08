import fs from 'node:fs/promises';

// Fixed, grep-friendly prefix so every best-effort cleanup failure — a
// single photo's file, or a whole user's photo directory on account
// deletion — can be found the same way later: `grep ORPHAN_FILE`.
const LOG_PREFIX = 'ORPHAN_FILE';

// Best-effort filesystem removal: a failure here (permissions, a busy
// file, disk trouble) is logged rather than thrown, so the caller can
// always continue on to whatever DB operation actually defines "deleted"
// from the user's perspective. An orphaned file that's merely logged can
// be found and cleaned up later from the filesystem side; a DB row left
// behind pointing at a file that's already gone cannot be recovered from
// at all — so the DB step must never be blocked on this one.
export async function removeFileBestEffort(
  absolutePath: string,
  context: { userId: string; recursive?: boolean },
): Promise<void> {
  try {
    await fs.rm(absolutePath, { force: true, recursive: context.recursive ?? false });
  } catch (err) {
    console.error(`${LOG_PREFIX} user=${context.userId} path=${absolutePath}: ${(err as Error).message}`);
  }
}
