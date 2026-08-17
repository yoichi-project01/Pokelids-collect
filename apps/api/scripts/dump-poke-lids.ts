import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../src/lib/prisma';
import { serializePokeLid } from '../src/routes/pokeLids';

// Snapshots the current poke lid data as a JSON file bundled straight into
// the mobile app (apps/mobile/src/data/poke-lids.json). Poke lid data only
// changes when the ETL scraper is re-run, so this is a manual step to run
// afterwards — not part of the normal build. It exists so that
// generateStaticParams() and the detail screen's initial render can use the
// full 481-entry dataset synchronously at build time, without depending on
// the API being reachable during `expo export`.
const OUTPUT_PATH = path.join(__dirname, '..', '..', 'mobile', 'src', 'data', 'poke-lids.json');

async function main() {
  const lids = await prisma.pokeLid.findMany({
    orderBy: [{ prefectureId: 'asc' }, { name: 'asc' }],
  });
  const serialized = lids.map(serializePokeLid);
  // The latest of every row's own `updatedAt` (bumped by Prisma on both an
  // ETL upsert and a 2-1 retire/restore) — read alongside GET
  // /api/poke-lids/version by apps/mobile's pokeLidsData.ts to detect that
  // this bundled snapshot has fallen behind the DB, without shipping the
  // full ~230KB list on every app load just to find out (7-7).
  const updatedAt = lids
    .reduce((max, l) => (l.updatedAt > max ? l.updatedAt : max), new Date(0))
    .toISOString();
  const output = { updatedAt, pokeLids: serialized };
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n', 'utf8');
  // Match the repo's Prettier formatting so `npm run format:check` (run in
  // CI) doesn't flag this generated file.
  execFileSync('npx', ['prettier', '--write', OUTPUT_PATH], {
    cwd: path.join(__dirname, '..', '..', '..'),
    stdio: 'inherit',
  });
  console.log(`Wrote ${serialized.length} poke lids (updatedAt=${updatedAt}) to ${OUTPUT_PATH}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
