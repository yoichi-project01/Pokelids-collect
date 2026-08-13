import { Link } from 'expo-router';
import Head from 'expo-router/head';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { CONTACT_EMAIL } from '../src/lib/contact';
import { colors, spacing, typography } from '../src/theme';

const LAST_UPDATED = '2026-08-13';

export default function PrivacyPolicyScreen() {
  return (
    <ScreenContainer>
      <Head>
        <title>プライバシーポリシー - ポケふたコレクト</title>
      </Head>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>プライバシーポリシー</Text>
        <Text style={styles.updated}>最終更新日: {LAST_UPDATED}</Text>

        <Section title="1. 収集する情報">
          本サービス（ポケふたコレクト）は、本サービスの提供にあたり以下の情報を取得します。
          {'\n\n'}
          ・アカウント情報：メールアドレス、パスワード（ハッシュ化して保存。Googleアカウントでログインした場合は取得しません）、表示名、メールアドレスの確認状況
          {'\n'}・収集記録：訪問したポケふた、訪問日時、メモ（任意入力）
          {'\n'}
          ・アップロードされた写真、および写真のEXIF情報のうち撮影日時。写真にGPS位置情報が含まれる場合の取り扱いは「4.
          位置情報の取り扱いについて」のとおりです
          {'\n'}
          ・ログイン時に送信されるブラウザ・端末のUser-Agent情報（不正なログインの検知のために保存します）
        </Section>

        <Section title="2. Googleアカウントでログインする場合">
          Googleアカウントでのログインを選択した場合、Googleから本サービスに、Googleアカウントのメールアドレス・表示名・アカウント識別子（Google側で発行される一意のID）が提供されます。取得した情報は、本サービスのアカウントの作成・ログインのためにのみ使用します。
        </Section>

        <Section title="3. ログイン前（ゲスト）の記録について">
          ログインする前に記録した訪問先・メモ・写真は、本サービスのサーバーには送信されず、お使いの端末内にのみ保存されます。ログインまたは新規登録を行うと、それらの記録をサーバーに保存するかどうかの確認画面が表示され、同意した場合にのみサーバーへ送信・保存します。
        </Section>

        <Section title="4. 位置情報の取り扱いについて">
          アップロードされた写真にGPS位置情報が含まれる場合、訪問先のポケふたの登録座標との距離を算出するためにのみ使用します。サーバーに保存するのはその距離（メートル単位の数値）のみで、写真が撮影された緯度・経度の座標そのものは保存しません。自宅など訪問先以外の場所で撮影された写真をアップロードした場合も、記録されるのは「訪問先からどれだけ離れていたか」という距離のみです。
        </Section>

        <Section title="5. 利用目的">
          取得した情報は、以下の目的でのみ利用します。
          {'\n\n'}
          ・収集記録の保存・表示、金・銀メダル判定、都道府県・市区町村別の進捗表示など、本サービス本来の機能の提供
          {'\n'}・メールアドレスの確認、パスワード再設定用のメール送信
          {'\n'}・不正なログイン・登録試行の検知と防止
          {'\n'}・広告の配信（詳細は「6. Cookie・広告識別子について」）
        </Section>

        <Section title="6. Cookie・広告識別子について">
          本サービスは、運営費用の一部を賄うため、Googleが提供する広告配信サービス（Google
          AdSense）を利用して広告を表示する場合があります。広告表示にあたり、Googleが Cookie
          や広告識別子を使用することがあります。本サービスでは、ユーザーの興味・関心に基づく個人向け広告ではなく、ページの内容に基づく広告（非パーソナライズ広告）の配信を予定しています。本サービス自身は、広告配信以外の目的でCookieやアクセス解析等のトラッキング技術を使用していません。
        </Section>
        <ExternalLink href="https://adssettings.google.com/" label="広告のパーソナライズ設定（Google）" />
        <ExternalLink
          href="https://policies.google.com/technologies/partner-sites"
          label="Googleサービスを使用するサイトやアプリからの情報の利用"
        />

        <Section title="7. 第三者提供">
          取得した情報を、以下の場合を除き本人の同意なく第三者に提供することはありません。
          {'\n\n'}・法令に基づく場合
          {'\n'}
          ・メールの送信（アカウント確認・パスワード再設定）のため、メール配信サービス（Resend）にメールアドレス等の必要な情報を送信する場合
          {'\n'}・Googleアカウントでのログイン処理のため、認証情報をGoogleとやり取りする場合
          {'\n'}・広告配信のため、Cookieや広告識別子等の情報がGoogleに送信される場合（「6.
          Cookie・広告識別子について」を参照）
        </Section>

        <Section title="8. ユーザーの権利">
          以下は、アプリ内の「設定」画面からいつでも行えます。
          {'\n\n'}
          ・データのダウンロード：ご自身の収集記録一覧（JSON・CSV形式）とアップロードした写真の原本をZIP形式でダウンロードできます
          {'\n'}
          ・アカウントの削除：アカウントと、紐づく収集記録・写真をすべて削除できます。削除は取り消せないため、削除前にデータのダウンロードをおすすめしています
        </Section>

        <Section title="9. 保存期間">
          取得した情報は、アカウントが存在する間保存されます。アカウントを削除すると、収集記録・写真を含め速やかに削除されます。
        </Section>

        <Section title="10. お問い合わせ">
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

// Kept outside Section (not nested inside its single Text block) — Link
// needs to render as a real tappable/clickable element, and settings.tsx's
// own legal-links row already established the pattern of Link living
// alongside body text rather than inline within it.
function ExternalLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} style={styles.link}>
      {label}
    </Link>
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
