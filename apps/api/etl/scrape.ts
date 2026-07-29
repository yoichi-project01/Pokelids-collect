import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { prisma } from '../src/lib/prisma';
import { PREFECTURES } from '../src/data/prefectures';

const BASE = 'https://local.pokemon.jp';
const REQUEST_DELAY_MS = 200;
const USER_AGENT =
  'pokelids-collect.jp personal ETL (family use, non-commercial; contact: setoyama.yoichi@gmail.com)';

const prefByNameJa = new Map(PREFECTURES.map((p) => [p.nameJa, p]));
// Hokkaido has no 都/道/府/県 stripped variant issue, but build a lenient lookup too.
const prefByNameJaLenient = new Map(
  PREFECTURES.map((p) => [p.nameJa.replace(/[都道府県]$/, ''), p]),
);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.text();
}

interface ListEntry {
  descId: string;
  prefSlug: string;
}

async function collectListEntries(): Promise<ListEntry[]> {
  const entries: ListEntry[] = [];
  for (const pref of PREFECTURES) {
    const url = `${BASE}/manhole/${pref.slug}.html`;
    let html: string;
    try {
      html = await fetchText(url);
    } catch (err) {
      console.warn(`Skipping ${pref.slug}: ${(err as Error).message}`);
      await sleep(REQUEST_DELAY_MS);
      continue;
    }
    const $ = cheerio.load(html);
    $('a.manhole-detail[href]').each((_, el) => {
      const href = $(el).attr('href') ?? '';
      const match = href.match(/\/manhole\/desc\/(\d+)\//);
      if (match) entries.push({ descId: match[1], prefSlug: pref.slug });
    });
    console.log(`${pref.slug}: found ${entries.filter((e) => e.prefSlug === pref.slug).length} entries so far`);
    await sleep(REQUEST_DELAY_MS);
  }
  // de-dupe by descId, keep first occurrence
  const seen = new Set<string>();
  return entries.filter((e) => {
    if (seen.has(e.descId)) return false;
    seen.add(e.descId);
    return true;
  });
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
  const officialImageUrl = imgSrc ? new URL(imgSrc, BASE).toString() : null;

  const pokemonFeatured: string[] = [];
  $('.zukan li a span').each((i, el) => {
    if (i % 2 === 0) {
      const text = $(el).text().trim();
      if (text) pokemonFeatured.push(text);
    }
  });

  const address = $('.block.map p').first().text().trim();

  const mapHref = $('.googlemap-link a').first().attr('href') ?? '';
  const qMatch = mapHref.match(/[?&]q=([\-0-9.]+),([\-0-9.]+)/);
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
  const listEntries = await collectListEntries();
  console.log(`Found ${listEntries.length} unique manhole IDs`);

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
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
