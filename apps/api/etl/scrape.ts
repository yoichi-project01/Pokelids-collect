import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { prisma } from '../src/lib/prisma';
import { PREFECTURES } from '../src/data/prefectures';

const BASE = 'https://local.pokemon.jp';
const REQUEST_DELAY_MS = 200;
const CONTACT_EMAIL = process.env.ETL_CONTACT_EMAIL ?? 'admin@example.com';
const USER_AGENT = `pokelids-collect.jp personal ETL (family use, non-commercial; contact: ${CONTACT_EMAIL})`;
const PHOTO_STORAGE_PATH = process.env.PHOTO_STORAGE_PATH ?? '/data/photos';
const OFFICIAL_IMAGES_DIR = path.join(PHOTO_STORAGE_PATH, 'official');

// 公式サイトのリニューアルでセレクタが壊れると、パース件数が0件になっても
// warn+continue するだけで正常終了してしまう。DB が上書きされる前に食い止める。
const MIN_COUNT_RATIO = 0.9;
const FORCE = process.argv.includes('--force');

const prefByNameJa = new Map(PREFECTURES.map((p) => [p.nameJa, p]));
// Hokkaido has no 都/道/府/県 stripped variant issue, but build a lenient lookup too.
const prefByNameJaLenient = new Map(PREFECTURES.map((p) => [p.nameJa.replace(/[都道府県]$/, ''), p]));

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.text();
}

// Downloads the official artwork once at scrape time and stores it under our
// own storage, so the running app serves it from our origin instead of
// hotlinking local.pokemon.jp on every page view. Falls back to the remote
// URL if the download fails, so a transient error here doesn't drop the
// image entirely.
async function downloadOfficialImage(remoteUrl: string, officialRef: string): Promise<string> {
  try {
    const res = await fetch(remoteUrl, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) throw new Error(`GET ${remoteUrl} -> ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const ext = path.extname(new URL(remoteUrl).pathname) || '.jpg';
    const filename = `${officialRef}${ext}`;
    await fs.mkdir(OFFICIAL_IMAGES_DIR, { recursive: true });
    await fs.writeFile(path.join(OFFICIAL_IMAGES_DIR, filename), buffer);
    return `/api/official-images/${filename}`;
  } catch (err) {
    console.warn(`Failed to download official image for ${officialRef}: ${(err as Error).message}`);
    return remoteUrl;
  }
}

interface ListEntry {
  descId: string;
  prefSlug: string;
}

interface ListEntriesResult {
  entries: ListEntry[];
  zeroCountPrefs: string[];
}

async function collectListEntries(): Promise<ListEntriesResult> {
  const entries: ListEntry[] = [];
  const zeroCountPrefs: string[] = [];
  for (const pref of PREFECTURES) {
    const url = `${BASE}/manhole/${pref.slug}.html`;
    let html: string;
    try {
      html = await fetchText(url);
    } catch (err) {
      console.warn(`Skipping ${pref.slug}: ${(err as Error).message}`);
      zeroCountPrefs.push(pref.slug);
      await sleep(REQUEST_DELAY_MS);
      continue;
    }
    const $ = cheerio.load(html);
    const countBefore = entries.length;
    $('a.manhole-detail[href]').each((_, el) => {
      const href = $(el).attr('href') ?? '';
      const match = href.match(/\/manhole\/desc\/(\d+)\//);
      if (match) entries.push({ descId: match[1], prefSlug: pref.slug });
    });
    const foundCount = entries.length - countBefore;
    if (foundCount === 0) zeroCountPrefs.push(pref.slug);
    console.log(`${pref.slug}: found ${foundCount} entries`);
    await sleep(REQUEST_DELAY_MS);
  }
  // de-dupe by descId, keep first occurrence
  const seen = new Set<string>();
  const deduped = entries.filter((e) => {
    if (seen.has(e.descId)) return false;
    seen.add(e.descId);
    return true;
  });
  return { entries: deduped, zeroCountPrefs };
}

interface ScrapedLid {
  officialRef: string;
  name: string;
  pokemonFeatured: string[];
  prefectureId: number;
  municipality: string;
  address: string;
  latitude: number;
  longitude: number;
  officialImageUrl: string | null;
  officialSourceUrl: string;
}

async function fetchDetail(descId: string): Promise<ScrapedLid | null> {
  const detailUrl = `${BASE}/manhole/desc/${descId}/?is_modal=1`;
  const canonicalUrl = `${BASE}/manhole/desc/${descId}/`;
  const html = await fetchText(detailUrl);
  const $ = cheerio.load(html);

  const title = $('.detail-manhole .heading h1').first().text().trim();
  const [prefRaw, municipalityRaw] = title.split('/');
  const prefName = (prefRaw ?? '').trim();
  const municipality = (municipalityRaw ?? '').trim();

  const pref = prefByNameJa.get(prefName) ?? prefByNameJaLenient.get(prefName);
  if (!pref) {
    console.warn(`Unrecognized prefecture "${prefName}" for desc/${descId}, skipping`);
    return null;
  }

  const imgSrc = $('.detail-manhole .heading img').first().attr('src');
  const remoteImageUrl = imgSrc ? new URL(imgSrc, BASE).toString() : null;
  const officialImageUrl = remoteImageUrl ? await downloadOfficialImage(remoteImageUrl, descId) : null;

  const pokemonFeatured: string[] = [];
  $('.zukan li a span').each((i, el) => {
    if (i % 2 === 0) {
      const text = $(el).text().trim();
      if (text) pokemonFeatured.push(text);
    }
  });

  const address = $('.block.map p').first().text().trim();

  const mapHref = $('.googlemap-link a').first().attr('href') ?? '';
  const qMatch = mapHref.match(/[?&]q=([-0-9.]+),([-0-9.]+)/);
  if (!qMatch) {
    console.warn(`No coordinates found for desc/${descId}, skipping`);
    return null;
  }
  const latitude = Number(qMatch[1]);
  const longitude = Number(qMatch[2]);

  return {
    officialRef: descId,
    name: pokemonFeatured.length > 0 ? `${municipality}｜${pokemonFeatured.join('・')}` : municipality,
    pokemonFeatured,
    prefectureId: pref.id,
    municipality,
    address,
    latitude,
    longitude,
    officialImageUrl,
    officialSourceUrl: canonicalUrl,
  };
}

async function main() {
  console.log('Step 1: collecting manhole list entries from prefecture pages...');
  const { entries: listEntries, zeroCountPrefs } = await collectListEntries();
  console.log(`Found ${listEntries.length} unique manhole IDs`);
  if (zeroCountPrefs.length > 0) {
    console.warn(`0件だった都道府県 (${zeroCountPrefs.length}件): ${zeroCountPrefs.join(', ')}`);
  }

  console.log('Step 2: fetching detail pages...');
  const results: ScrapedLid[] = [];
  for (const [i, entry] of listEntries.entries()) {
    try {
      const detail = await fetchDetail(entry.descId);
      if (detail) results.push(detail);
    } catch (err) {
      console.warn(`Failed to fetch desc/${entry.descId}: ${(err as Error).message}`);
    }
    if ((i + 1) % 25 === 0) console.log(`  ...${i + 1}/${listEntries.length}`);
    await sleep(REQUEST_DELAY_MS);
  }
  console.log(`Successfully scraped ${results.length} poke lids`);

  // セレクタ崩壊などで件数が急減した場合、DB 更新・スナップショット書き込みの
  // どちらも行わずに止める。ここで止めないと 2-1（論理削除）実装後は
  // 全ポケふたが「撤去済み」として上書きされてしまう。
  // retiredAt: null のみを母数にする — 2-1 導入後は正規の撤去が積み重なる
  // ため、撤去済みも含めた全件数を基準にすると、健全なスクレイプでも比率が
  // じわじわ下がって誤検知するようになってしまう。
  const previousCount = await prisma.pokeLid.count({ where: { retiredAt: null } });
  if (previousCount > 0 && results.length < previousCount * MIN_COUNT_RATIO) {
    const message = `スクレイプ件数が前回比${Math.round(MIN_COUNT_RATIO * 100)}%を下回りました（前回 ${previousCount} 件 → 今回 ${results.length} 件）。公式サイトのリニューアルでセレクタが変わった可能性があります。意図的に実行する場合は --force を付けてください。`;
    if (!FORCE) {
      throw new Error(message);
    }
    console.warn(`${message} --force が指定されているため続行します。`);
  }

  const rawDir = path.join(__dirname, 'raw');
  await fs.mkdir(rawDir, { recursive: true });
  const snapshotPath = path.join(rawDir, `poke-lids-${new Date().toISOString().slice(0, 10)}.json`);
  await fs.writeFile(snapshotPath, JSON.stringify(results, null, 2));
  console.log(`Snapshot written to ${snapshotPath}`);

  console.log('Step 3: upserting into database...');
  for (const lid of results) {
    await prisma.pokeLid.upsert({
      where: { officialRef: lid.officialRef },
      update: { ...lid, lastSyncedAt: new Date() },
      create: { ...lid, lastSyncedAt: new Date() },
    });
  }
  console.log(`Upserted ${results.length} poke lids into the database`);

  // 上の件数安全装置を通過した後（＝スクレイプ結果が信頼できる場合）にのみ
  // 実行する。安全装置より前に置くと、セレクタ崩壊で results が空に近い
  // ときに既存の全ポケふたを撤去済みにしてしまう。
  console.log('Step 4: marking retired / restored poke lids...');
  const scrapedRefs = results.map((r) => r.officialRef);

  const retired = await prisma.pokeLid.updateMany({
    where: { officialRef: { not: null, notIn: scrapedRefs }, retiredAt: null },
    data: { retiredAt: new Date() },
  });
  if (retired.count > 0) {
    console.log(`Marked ${retired.count} poke lid(s) as retired (no longer listed on the official site)`);
  }

  const restored = await prisma.pokeLid.updateMany({
    where: { officialRef: { in: scrapedRefs }, retiredAt: { not: null } },
    data: { retiredAt: null },
  });
  if (restored.count > 0) {
    console.log(`Restored ${restored.count} previously-retired poke lid(s) that reappeared`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
