import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

const SITE_URL = 'https://pokelids-collect.jp';
const DESCRIPTION =
  'ポケふた(ご当地ポケモンマンホール)を実際に訪問して写真を撮り、収集記録として残すアプリ。';

// This file only ever runs in Node during static rendering (no DOM access),
// and controls the document shell shared by every route. Per-page <title>
// is set separately via `expo-router/head` in each screen.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="theme-color" content="#000000" />
        <meta name="description" content={DESCRIPTION} />

        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="ポケふた収集" />
        <meta property="og:title" content="ポケふた収集" />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:url" content={SITE_URL} />
        <meta property="og:image" content={`${SITE_URL}/og-image.png`} />
        <meta name="twitter:card" content="summary_large_image" />

        <link rel="icon" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="manifest" href="/manifest.json" />

        <ScrollViewStyleReset />

        <script
          // Registers the offline-cache service worker (see public/sw.js).
          // Runs client-side only; this file itself never executes in a browser.
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function () {
                  navigator.serviceWorker.register('/sw.js').catch(function () {});
                });
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
