import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

const SITE_URL = 'https://pokelids-collect.jp';
const DESCRIPTION =
  'ポケふた(ご当地ポケモンマンホール)を実際に訪問して写真を撮り、収集記録として残すアプリ。';

// Baked in at build time (see the Dockerfile's mobile-build stage) —
// unset in a deployment that hasn't set up AdSense, and clearing it +
// rebuilding is the kill switch (see .env.example's own comment on this
// var). This is script-tag-only, for AdSense site review (MONETIZATION.md):
// no ad slots exist yet (that's Phase 1), and Auto ads stays off in the
// AdSense dashboard so ad placement decisions never bypass this app's own
// "never during the critical flow" rule (MONETIZATION.md §1).
const ADSENSE_CLIENT_ID = process.env.EXPO_PUBLIC_ADSENSE_CLIENT_ID;

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
        {/*
          viewport-fit=cover is required for two things: it's what makes
          `env(safe-area-inset-*)` resolve to a nonzero value on notched
          iPhones (otherwise it's always 0, safe area or not), and it's what
          lets the page draw under the status bar / home indicator instead of
          leaving a hard-edged gap. react-native-safe-area-context's web
          provider reads those env() values via a hidden probe element, so
          the tab bar's built-in `insets.bottom` padding (see
          BottomTabBar's use of useSafeAreaInsets) only starts reporting a
          real number once this is set.
        */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="theme-color" content="#000000" />

        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="ポケふたコレクト" />
        <meta property="og:title" content="ポケふたコレクト" />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:url" content={SITE_URL} />
        <meta property="og:image" content={`${SITE_URL}/og-image.png`} />
        <meta name="twitter:card" content="summary_large_image" />

        <link rel="icon" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="manifest" href="/manifest.json" />

        <ScrollViewStyleReset />

        {/*
          ScrollViewStyleReset sets html,body,#root to height:100%, which on
          mobile browsers is 100% of the *layout* viewport — not the
          *visual* one currently on screen once the address bar is showing.
          The flex column (header + content + tab bar) sizes itself to that
          taller-than-visible height, and body's overflow:hidden then clips
          whatever falls off the bottom — in practice, the tab bar. 100dvh
          tracks the address-bar-aware visual viewport instead, so this rule
          must come after ScrollViewStyleReset in the DOM to win the
          cascade (same selector, same specificity, later wins). The plain
          100% stays as a fallback for browsers without dvh support — this
          is an inline <style>, which is unaffected by helmet's CSP
          (style-src keeps the default 'unsafe-inline'; only script-src is
          locked down here, see the <script> comment below).
        */}
        <style
          dangerouslySetInnerHTML={{
            __html: `html,body,#root{height:100%;height:100dvh}`,
          }}
        />

        {/*
          An inline script here would be blocked by helmet's default CSP
          (script-src 'self', no 'unsafe-inline'), so the service worker
          registration lives in its own file instead.
        */}
        <script src="/sw-register.js" defer />

        {/*
          AdSense review requires the script to be present sitewide, so
          this lives in the document shell (every page) rather than a
          specific screen. `async` (not `defer`) is Google's own documented
          loading attribute for this tag. Omitted entirely — not rendered
          with an empty client param — when ADSENSE_CLIENT_ID is unset; see
          this file's top-of-file comment on that constant.
        */}
        {ADSENSE_CLIENT_ID && (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
            crossOrigin="anonymous"
          />
        )}
      </head>
      <body>{children}</body>
    </html>
  );
}
