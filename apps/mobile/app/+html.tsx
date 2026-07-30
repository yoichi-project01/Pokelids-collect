import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

const SITE_URL = 'https://pokelids-collect.jp';
const DESCRIPTION =
  'ポケふた(ご当地ポケモンマンホール)を実際に訪問して写真を撮り、収集記録として残すアプリ。';

// This file only ever runs in Node during static rendering (no DOM access),
// and controls the document shell shared by every route. Per-page <title>
// AND <meta name="description"> are set separately via `expo-router/head` —
// the description used to be hardcoded here too, but a plain JSX tag in this
// file isn't managed by react-helmet-async (the library backing
// `expo-router/head`'s <Head>), so it couldn't be overridden by a page's own
// description and every route's static HTML got this generic text instead.
// The default now lives in the root layout's <Head> instead, where a page
// that renders its own <meta name="description"> further down the tree
// correctly wins.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="theme-color" content="#000000" />

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

        {/*
          An inline script here would be blocked by helmet's default CSP
          (script-src 'self', no 'unsafe-inline'), so the service worker
          registration lives in its own file instead.
        */}
        <script src="/sw-register.js" defer />
      </head>
      <body>{children}</body>
    </html>
  );
}
