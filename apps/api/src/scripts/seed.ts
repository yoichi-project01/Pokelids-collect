import 'dotenv/config';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma';
import { PREFECTURES as PREFECTURE_DATA } from '../data/prefectures';

const PREFECTURES = PREFECTURE_DATA.map((p) => ({
  id: p.id,
  nameJa: p.nameJa,
  nameEn: p.nameEn,
  region: p.region,
  displayOrder: p.id,
}));

async function main() {
  for (const pref of PREFECTURES) {
    await prisma.prefecture.upsert({
      where: { id: pref.id },
      update: pref,
      create: pref,
    });
  }
  console.log(`Seeded ${PREFECTURES.length} prefectures`);
  console.log('Poke lid master data is populated separately via `npm run etl:scrape` (see etl/scrape.ts)');

  const adminEmail = process.env.ADMIN_SEED_EMAIL;
  const adminPassword = process.env.ADMIN_SEED_PASSWORD;
  if (adminEmail && adminPassword) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: { passwordHash, isAdmin: true },
      create: { email: adminEmail, passwordHash, displayName: 'Admin', isAdmin: true },
    });
    console.log(`Seeded admin user ${adminEmail}`);
  } else {
    console.log('ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD not set, skipping admin user seed');
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
