# Release verification

Local verification on September 22, 2026:

- `npm install`: completed; no dependency audit vulnerabilities reported.
- `npm run verify`: ESLint, TypeScript, 52 Vitest files / 730 tests, semantic asset validation and the Next.js production build passed.
- Browser QA: 41 routes at 1440px and 390px (82 page checks), including public pages, event details, admin editors, settings, media, email gallery, staff and manager operations. No horizontal overflow or broken images. A scanner integration request was replaced with an explicit simulated door experience; targeted desktop/mobile rechecks passed.
- Interactive browser checks: reservation and ordering previews; admin publishing reflected on the public menu; a second independent browser retained the original menu; staff availability persisted; manager access; simulated admission and duplicate-ticket handling; blocked external callbacks, webhooks and scheduled delivery.
- Source and filename review: no prior restaurant identifiers, original addresses, account identifiers, copied photographs, production keys or private configuration included. Only the safe `.env.example` is tracked.

The repeatable local and production checks are `scripts/qa-demo.mjs` and `scripts/qa-interactions.mjs`; set `QA_URL` to the deployment origin. Screenshots and raw QA output stay outside the repository.

Serverless storage regressions are covered by tests for cross-instance persistence, independent browser state, concurrent mutations, inserts/removals, invalid cookies and bounded state size. Fonts are bundled locally to eliminate build-time font API dependencies.
