import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'noreply@pokelids-collect.jp';

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  if (!resend) {
    // No API key configured — most likely local dev, or Resend's domain
    // verification hasn't been completed yet. Log instead of throwing so the
    // rest of the reset flow stays testable without a Resend account.
    console.log(`[email] RESEND_API_KEY not set; password reset link for ${to}: ${resetUrl}`);
    return;
  }

  await resend.emails.send({
    from: `ポケふたコレクト <${RESEND_FROM_EMAIL}>`,
    to,
    subject: 'パスワードの再設定 - ポケふたコレクト',
    html: `
      <p>パスワード再設定のリクエストを受け付けました。</p>
      <p>以下のリンクから1時間以内に新しいパスワードを設定してください。</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>このリクエストに心当たりがない場合は、このメールを無視してください。パスワードは変更されません。</p>
    `,
  });
}

export async function sendEmailVerificationEmail(to: string, verifyUrl: string): Promise<void> {
  if (!resend) {
    console.log(`[email] RESEND_API_KEY not set; email verification link for ${to}: ${verifyUrl}`);
    return;
  }

  await resend.emails.send({
    from: `ポケふたコレクト <${RESEND_FROM_EMAIL}>`,
    to,
    subject: 'メールアドレスの確認 - ポケふたコレクト',
    html: `
      <p>ご登録ありがとうございます。</p>
      <p>以下のリンクから24時間以内にメールアドレスを確認してください。</p>
      <p><a href="${verifyUrl}">${verifyUrl}</a></p>
      <p>確認しなくてもアプリは引き続きお使いいただけます。このメールに心当たりがない場合は無視してください。</p>
    `,
  });
}
