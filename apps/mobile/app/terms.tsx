import { Link } from 'expo-router';
import Head from 'expo-router/head';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { CONTACT_EMAIL } from '../src/lib/contact';
import { colors, spacing, typography } from '../src/theme';

const LAST_UPDATED = '2026-08-13';

export default function TermsScreen() {
  return (
    <ScreenContainer>
      <Head>
        <title>利用規約 - ポケふたコレクト</title>
      </Head>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>利用規約</Text>
        <Text style={styles.updated}>最終更新日: {LAST_UPDATED}</Text>

        <Section title="1. サービスについて">
          本サービス（ポケふたコレクト）は、個人が「ポケふた」（ご当地ポケモンマンホール）の訪問記録を残すために提供する個人開発サービスです。本サービスは無料で利用でき、運営費用の一部を広告収益（「7.
          広告について」）で賄っています。
        </Section>

        <Section title="2. コンテンツの著作権について">
          本サービスに表示されるポケふたの画像・名称・ポケモンに関する情報の著作権は、株式会社ポケモンおよび関係権利者に帰属します。本サービスは株式会社ポケモンとは無関係な個人が開発・運営するファンによる非公式の記録ツールであり、同社その他の権利者による公認・提携・許諾を受けたものではありません。広告を掲載していることは、権利者から商用利用の許諾を受けたことを意味するものではありません。
        </Section>

        <Section title="3. 禁止事項">
          本サービスを通じて取得した画像・データを、権利者に無断で再配布・商用利用することを禁止します。
        </Section>

        <Section title="4. 免責事項">
          本サービスが提供する情報（ポケふたの所在地・座標等）の正確性について保証しません。実際の訪問にあたっては、現地の状況・交通ルールを優先してください。本サービスの利用により生じた損害について、運営者は責任を負いません。
        </Section>

        <Section title="5. サービスの変更・停止">
          運営者は、予告なく本サービスの内容を変更、または提供を停止することがあります。特に、権利者から画像・データの削除を求められた場合、本サービスの一覧・地図・図鑑としての機能が維持できなくなり、サービスの提供を停止する可能性があります。本サービスは、サービスが将来にわたって継続することを保証しません。
          {'\n\n'}
          記録した収集記録・写真は、アプリ内の「設定」画面からいつでもZIP形式でダウンロードできます（ゲストとして記録した内容は、ログインしている端末からのみダウンロードできます）。サービスが停止する場合に備え、定期的にダウンロードしてお手元に保管しておくことをおすすめします。
        </Section>

        <Section title="6. 規約の変更">
          本規約は、必要に応じて変更することがあります。重要な変更がある場合は、本サービス内でお知らせします。
        </Section>

        <Section title="7. 広告について">
          本サービスは、運営費用の一部を賄うため、Googleが提供する広告配信サービス（Google
          AdSense）による広告を表示する場合があります。広告に関するCookie・広告識別子の取り扱いについては、プライバシーポリシーをご確認ください。
        </Section>
        <Link href="/privacy" style={styles.link}>
          プライバシーポリシー
        </Link>

        <Section title="8. お問い合わせ">
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
  title: { ...typography.largeTitle },
  updated: { ...typography.footnote },
  section: { gap: spacing.xs },
  sectionTitle: { ...typography.bodyMedium },
  sectionBody: { ...typography.body, lineHeight: 22 },
  link: { ...typography.body, color: colors.accent, textDecorationLine: 'underline', marginTop: -spacing.sm },
});
