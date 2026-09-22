# Release verification

Local verification on September 22, 2026:

- `npm install`: completed; no dependency audit vulnerabilities reported.
- `npm run verify`: ESLint, TypeScript, 52 Vitest files / 730 tests, semantic asset validation and the Next.js production build passed.
- Browser QA: 41 routes at 1440px and 390px (82 page checks), including public pages, event details, admin editors, settings, media, email gallery, staff and manager operations. No horizontal overflow or broken images. A scanner integration request was replaced with an explicit simulated door experience; targeted desktop/mobile rechecks passed.
- Interactive browser checks: reservation and ordering previews; admin publishing reflected on the public menu; a second independent browser retained the original menu; staff availability persisted; manager access; simulated admission and duplicate-ticket handling; blocked external callbacks, webhooks and scheduled delivery.
- Source and filename review: no prior restaurant identifiers, original addresses, account identifiers, copied photographs, production keys or private configuration included. Only the safe `.env.example` is tracked.

The repeatable local and production checks are `scripts/qa-demo.mjs` and `scripts/qa-interactions.mjs`; set `QA_URL` to the deployment origin. Screenshots and raw QA output stay outside the repository.

Serverless storage regressions are covered by tests for cross-instance persistence, independent browser state, concurrent mutations, inserts/removals, invalid cookies and bounded state size. Fonts are bundled locally to eliminate build-time font API dependencies.

## Production browser verification

Production: `https://restaurant-demo-two-zeta.vercel.app` on the independent `restaurant-demo` Vercel project.

- All 41 routes were inspected at 1440px and 390px: 82 desktop/mobile checks. Public pages, event detail pages, admin, media, emails, sales, staff and manager screens returned HTTP 200, with no broken images or horizontal overflow.
- The sales page required a readiness check based on visible content rather than network idleness; both viewport rechecks passed with six fictional orders, correct sample totals and no browser errors. The QA script now supports pages with ongoing network activity.
- Production interaction checks passed: reservation and order previews; menu publishing persisted across routes; an independent browser retained the original menu; staff availability saved; manager access; simulated door admission and duplicate handling; external service endpoints blocked.
- A production timestamp hydration mismatch was corrected with an explicit venue time zone. The complete interaction script subsequently passed without runtime errors. The same scenario also passed against a local production server running in UTC.
- Original source systems were not linked or accessed by the deployed demo. The new Vercel project has no configured environment variables or external database connections.
