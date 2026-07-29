import Head from 'expo-router/head';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { spacing, typography } from '../src/theme';

const CONTACT_EMAIL = 'setoyama.yoichi@gmail.com';
const LAST_UPDATED = '2026-07-29';

export default function TermsScreen() {
  return (
    <ScreenContainer>
      <Head>
        <title>利用規約 - ポケふた収集</title>
      </Head>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.draftNotice}>
          ※ このページは草案です。公開前に内容をご確認・編集してください。
        </Text>
        <Text style={styles.title}>利用規約</Text>
        <Text style={styles.updated}>最終更新日: {LAST_UPDATED}</Text>

        <Section title="1. サービスについて">
          本サービス（ポケふた収集）は、個人が「ポケふた」（ご当地ポケモンマンホール）の訪問記録を残すために提供する非商用の個人開発サービスです。
        </Section>

        <Section title="2. コンテンツの著作権について">
          本サービスに表示されるポケふたの画像・名称・ポケモンに関する情報の著作権は、株式会社ポケモンおよび関係権利者に帰属します。本サービスはファンによる非公式の記録ツールであり、権利者による公認・提携を受けたものではありません。
        </Section>

        <Section title="3. 禁止事項">
          本サービスを通じて取得した画像・データを、権利者に無断で再配布・商用利用することを禁止します。
        </Section>

        <Section title="4. 免責事項">
          本サービスが提供する情報（ポケふたの所在地・座標等）の正確性について保証しません。実際の訪問にあたっては、現地の状況・交通ルールを優先してください。本サービスの利用により生じた損害について、運営者は責任を負いません。
        </Section>

        <Section title="5. サービスの変更・停止">
          運営者は、予告なく本サービスの内容を変更、または提供を停止することがあります。
        </Section>

        <Section title="6. 規約の変更">
          本規約は、必要に応じて変更することがあります。重要な変更がある場合は、本サービス内でお知らせします。
        </Section>

        <Section title="7. お問い合わせ">
          本規約に関するお問い合わせは、{CONTACT_EMAIL} までご連絡ください。
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
