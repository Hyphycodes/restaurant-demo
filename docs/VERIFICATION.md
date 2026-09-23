# Release verification

## Flagship release — September 23, 2026

Local verification against a production build (`npm run build && npm start`):

- **`npm run verify` suite:**
  - ESLint, TypeScript, Vitest (54 files, 749 tests) and the asset registry check all pass.
  - The production build passes.
  - First-load JS for public pages is about 160 kB, including GSAP, ScrollTrigger, SplitText and Lenis.
- **`npm run db:verify`:**
  - All 24 Supabase migrations apply in order to a clean Postgres 17 (PGlite with a Supabase platform shim), and 0027 re-applies cleanly.
  - The resulting schema has 80 tables, all with row level security, plus 176 policies, 191 indexes and 153 foreign keys. It includes the storage buckets `media`, `employee-files` and `applications`.
  - `supabase/tests/employee-operations-rls.sql` (13 RLS assertions) and `ticketing-walkthrough.sql` pass.
  - The run exposed that `event_occurrences.id` had never been converted to text, so no clean database could apply 0006 onwards. 0006 now performs that conversion first.
- **`scripts/qa-demo.mjs`** covers 52 routes at 1440px and 390px:
  - With reduced motion: 100 page checks. Every route returned 200 except one bad route in the QA list itself (fixed).
  - With motion on (`QA_MOTION=on`): 104 page checks.
  - Both runs found no horizontal overflow and no broken images.
  - The only console errors were the sandbox blocking production-domain images inside email previews.
- **`scripts/qa-interactions.mjs`** passes:
  - the simulated reservation flow
  - the simulated pickup order
  - public private-dining enquiry → admin pipeline → stage moved to Contacted
  - admin publish → public menu, with a second browser unchanged
  - staff availability persisted
  - manager scheduling entry
  - simulated door admission and duplicate handling
  - blocked external callbacks and webhooks
  - no runtime errors
- **Visual review** used `scripts/qa-film.mjs`, which records scroll positions with motion on:
  - the homepage hero at 1280×720, 1440×900 and 390×844
  - the evening sequence, the kitchen, events, rooms and the Behind the Hospitality sequence
  - menu, events, private dining, catering, visit, contact, careers, talent, reservations, pickup, `/demo` and `/behind`
  - admin Tonight, the enquiry pipeline, media, the staff home and `/display` at 1920×1080

**Supabase:** no Supabase project is connected to Cosa Nostra. The site permanently runs in demo mode on an isolated, per-visitor store (see `docs/ARCHITECTURE.md`), so no hosted database is read or written. The migrations remain the production-compatible schema, and they are now proven applyable by `npm run db:verify`.

## Earlier releases

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
