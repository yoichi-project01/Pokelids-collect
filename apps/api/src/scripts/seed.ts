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

  // 2-4: 「管理者」ではなく単なる最初のユーザーアカウントを作るための値
  // （管理者専用の機能・チェックは存在しない。かつてUser.isAdminを設定
  // していたが、未使用だったため2-4で削除した）。
  const seedUserEmail = process.env.SEED_USER_EMAIL;
  const seedUserPassword = process.env.SEED_USER_PASSWORD;
  if (seedUserEmail && seedUserPassword) {
    const passwordHash = await bcrypt.hash(seedUserPassword, 12);
    await prisma.user.upsert({
      where: { email: seedUserEmail },
      update: { passwordHash },
      create: { email: seedUserEmail, passwordHash, displayName: 'Owner' },
    });
    console.log(`Seeded user ${seedUserEmail}`);
  } else {
    console.log('SEED_USER_EMAIL / SEED_USER_PASSWORD not set, skipping user seed');
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
