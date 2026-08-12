import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'noreply@pokelids-collect.jp';

// Gates the plaintext-link-to-console fallback below to development only.
// Both functions below hand out a fully-working, unauthenticated action
// link — sendPasswordResetEmail's grants full account takeover, and while
// sendEmailVerificationEmail's is lower-stakes (it only affects one
// account's own emailVerifiedAt, which in turn only gates the 5-4 Google
// SSO auto-link — see decideGoogleAccountLink), it's still not something
// that should ever land in a log anyone with log access can read: ops
// tooling, a misconfigured log aggregator, a compromised log-shipping
// pipeline. In production, an unset/invalid RESEND_API_KEY should be a loud
// operational failure instead of a silent "success" that leaks the link —
// so this throws instead of logging, letting each call site's existing
// `.catch((err) => console.error('Failed to send ... email', err))` (see
// routes/auth.ts) record the fact that sending failed without ever writing
// the recipient's address or the link itself into the log (that catch
// already only logs the error object, never the arguments it was called
// with). Locally there's no such log-reader threat model and no real inbox
// to check either, so logging the link outright is what keeps password
// reset / email verification testable without a real Resend account.
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  if (!resend) {
    if (IS_PRODUCTION) {
      throw new Error('RESEND_API_KEY is not configured');
    }
    // No API key configured — local dev, or Resend's domain verification
    // hasn't been completed yet. Log instead of throwing so the rest of the
    // reset flow stays testable without a Resend account.
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
    if (IS_PRODUCTION) {
      throw new Error('RESEND_API_KEY is not configured');
    }
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
