import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // packages/shared's package.json `main` points at dist/index.js,
      // which is gitignored and only ever gets built as a side effect of
      // `npm run typecheck`'s own script chain (`npm run build
      // --workspace=@pokelids/shared && tsc ...`). On a clean `npm ci`
      // checkout with no build step run yet, vitest — via Vite's own
      // resolver, which honors `main`/`exports` — fails to resolve
      // "@pokelids/shared" at all (see guestPhotoCapture.test.ts, the
      // first test to actually import it at runtime rather than only via
      // relative paths). This was masked everywhere so far, including in
      // CI: `npm run typecheck` runs *before* `npm run test` in both this
      // repo's checklist and .github/workflows/ci.yml, so dist/ already
      // existed by accident of step order every time `npm run test` had
      // been run, locally or in CI, until now.
      //
      // Pointing vitest straight at the TS source sidesteps that dist/
      // dependency entirely for tests, which is the only broken path:
      // - Docker (production) already builds packages/shared explicitly,
      //   before either downstream stage that needs it (see the `deps`
      //   stage in apps/api/Dockerfile, `RUN npm run build
      //   --workspace=@pokelids/shared` — the mobile web export and the
      //   API build both branch off from that same stage), so Metro and
      //   the API's own tsc/Node runtime resolution were never actually at
      //   risk.
      // - `tsc --noEmit` (typecheck) already resolves via TS project
      //   references straight to source, bypassing package.json
      //   entirely — that's *why* it was never affected either, and why
      //   type-checking passing was never evidence that runtime resolution
      //   also worked.
      //
      // Adding `exports` to packages/shared/package.json to point at
      // source (an alternative considered) would fix this the same way but
      // for every consumer at once, including Metro — a much larger,
      // harder-to-verify blast radius for a problem that's actually
      // contained to this one test runner. Adding an explicit shared-build
      // step to CI (also considered) wouldn't actually fix the underlying
      // fragility: `npm run test` run alone, the way this bug was first
      // found, would still fail on a clean checkout — it would just move
      // the accidental-ordering dependency from "after typecheck" to
      // "after an explicit CI step," which any local ad-hoc `npm run test`
      // still wouldn't have.
      '@pokelids/shared': `${rootDir}packages/shared/src/index.ts`,
    },
  },
  test: {
    include: [
      'apps/api/src/**/*.test.ts',
      'apps/mobile/src/**/*.test.ts',
      'packages/shared/src/**/*.test.ts',
    ],
    env: {
      JWT_ACCESS_SECRET: 'test-access-secret',
      JWT_REFRESH_SECRET: 'test-refresh-secret',
      PHOTO_TOKEN_SECRET: 'test-photo-secret',
    },
  },
});
