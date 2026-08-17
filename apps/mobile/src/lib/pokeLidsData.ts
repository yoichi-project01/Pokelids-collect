import { countsTowardProgress, type PokeLidDto } from '@pokelids/shared';
import BUNDLE from '../data/poke-lids.json';
import { fetchPokeLids, fetchPokeLidsVersion } from './api';

// The single entry point for the bundled poke-lids.json snapshot (7-7) —
// every screen that used to `import POKE_LIDS from '../data/poke-lids.json'`
// directly now goes through here instead, so there's exactly one place that
// understands the file's shape (`{ updatedAt, pokeLids }`, produced by
// apps/api/scripts/dump-poke-lids.ts). 5-1's static-generation plan for the
// detail pages is meant to reuse this same entry point, per TASKS.md 7-7.
const bundle = BUNDLE as { updatedAt: string; pokeLids: PokeLidDto[] };

// Synchronous and always available — this is what generateStaticParams()
// (evaluated in Node at build time, no network) and a detail screen's
// synchronous initial render must use. Everywhere else that only needs "the
// poke lid list, perfect freshness not required" (Onboarding's sample
// images, a guest record's municipality lookup) should read from here too,
// rather than re-importing the raw JSON path.
export const POKE_LIDS: PokeLidDto[] = bundle.pokeLids;

export const POKE_LIDS_BY_ID: Map<string, PokeLidDto> = new Map(POKE_LIDS.map((l) => [l.id, l]));

// "全国481箇所" (7-4/Onboarding/quick-record celebrations) — static data the
// client already has bundled, not worth a dedicated API field for. Computed
// once here instead of independently in three different call sites.
export const TOTAL_POKE_LIDS_NATIONWIDE = POKE_LIDS.filter((l) => countsTowardProgress(l.retiredAt)).length;

let cachedPokeLids: PokeLidDto[] = POKE_LIDS;
let cachedVersion: string = bundle.updatedAt;
let inFlight: Promise<PokeLidDto[]> | null = null;

// The version-checked replacement for the old full-list fetchPokeLids() call
// that collection.tsx and useMapMarkers.ts used to make on every focus
// (several hundred KB each time, for master data that only ever changes via
// an ETL re-scrape). Always hits GET /api/poke-lids/version first — a body
// of a couple dozen bytes — and only pays for the full list when the server
// reports something newer than whatever this session is currently holding
// (the bundled snapshot on the first call, or a previously live-fetched list
// after that). Concurrent callers share one in-flight check rather than each
// firing their own (the same reasoning as api.ts's own refreshingPromise for
// token refresh).
//
// A version-check failure (offline, server hiccup) falls back to whatever's
// cached instead of failing the caller — staying usable offline is 7-7's
// other stated goal, and a missed freshness check just means "still showing
// last known state," not broken.
export async function getFreshPokeLids(): Promise<PokeLidDto[]> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const { updatedAt } = await fetchPokeLidsVersion();
      // Plain string comparison, not Date parsing — both sides are ISO 8601
      // in the same fixed-width UTC format (toISOString()), where lexical
      // order already matches chronological order.
      if (updatedAt > cachedVersion) {
        cachedPokeLids = await fetchPokeLids();
        cachedVersion = updatedAt;
      }
    } catch {
      // Keep serving cachedPokeLids as-is.
    }
    return cachedPokeLids;
  })();
  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}
