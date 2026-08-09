import Head from 'expo-router/head';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { spacing, typography } from '../src/theme';

const CONTACT_EMAIL = 'setoyama.yoichi@gmail.com';
const LAST_UPDATED = '2026-08-06';

export default function PrivacyPolicyScreen() {
  return (
    <ScreenContainer>
      <Head>
        <title>プライバシーポリシー - ポケふたコレクト</title>
      </Head>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.draftNotice}>
          ※ このページは草案です。公開前に内容をご確認・編集してください。
        </Text>
        <Text style={styles.title}>プライバシーポリシー</Text>
        <Text style={styles.updated}>最終更新日: {LAST_UPDATED}</Text>

        <Section title="1. 収集する情報">
          本サービス（ポケふたコレクト）は、以下の情報を収集します。
          {'\n\n'}・アカウント情報：メールアドレス、パスワード（ハッシュ化して保存）、表示名
          {'\n'}・収集記録：訪問したポケふた、訪問日時、メモ
          {'\n'}
          ・アップロードされた写真、および写真に含まれるEXIF情報（撮影日時）。写真にGPS位置情報が含まれる場合は、訪問先のポケふたの登録座標との距離（金・銀メダル判定に使用）のみを算出して保存し、緯度・経度の座標自体は保存しません。
        </Section>

        <Section title="2. 位置情報の取り扱いについて">
          アップロードされた写真にGPS位置情報が含まれる場合、訪問先のポケふたの登録座標との距離を算出するためにのみ使用します。サーバーに保存するのはその距離（メートル単位の数値）のみで、写真が撮影された緯度・経度の座標そのものは保存しません。自宅など訪問先以外の場所で撮影された写真をアップロードした場合も、記録されるのは「訪問先からどれだけ離れていたか」という距離のみです。
        </Section>

        <Section title="3. 利用目的">
          収集した情報は、収集記録の保存・表示、金・銀メダル判定、都道府県別の進捗表示など、本サービスの提供のためにのみ利用します。
        </Section>

        <Section title="4. 第三者提供">
          法令に基づく場合を除き、収集した情報を本人の同意なく第三者に提供することはありません。
        </Section>

        <Section title="5. 保存期間・削除">
          収集した情報は、アカウントが存在する間保存されます。アプリ内の「アカウントを削除する」から、いつでもアカウントと関連する収集記録・写真をすべて削除できます。
        </Section>

        <Section title="6. お問い合わせ">
          本ポリシーに関するお問い合わせは、{CONTACT_EMAIL} までご連絡ください。
        </Section>
      </ScrollView>
    </ScreenContainer>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.lg },
  draftNotice: { ...typography.footnote, color: '#b45309', textAlign: 'center' },
  title: { ...typography.largeTitle },
  updated: { ...typography.footnote },
  section: { gap: spacing.xs },
  sectionTitle: { ...typography.bodyMedium },
  sectionBody: { ...typography.body, lineHeight: 22 },
});
