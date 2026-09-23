# Restaurant foundation

Cosa Nostra is two things in one repository: a fictional restaurant with its own visual world, and a restaurant platform underneath it. This note describes the platform layer: what a future restaurant project can reuse, and what it must not copy.

**Reuse the functionality. Never reuse the visual identity.**

## What is reusable

| Capability | Where it lives | Notes |
| --- | --- | --- |
| Data access | `src/lib/db` (`Db` interface; `SupabaseDb`, `LocalDb`, `DemoDb`) | Everything reads and writes through one small interface. Swap the adapter, keep the features. |
| Content fallback rule | `src/content/resolve.ts` | Reads come from the database first and fall back to typed static content, so the public site never goes blank. |
| Draft → publish | `src/server/content/editorial.ts`, `src/server/actions/versions.ts` | Draft columns, publish, version history and rollback, shared by the menu, page copy and catering. |
| Menu | `src/server/content/menu.ts`, `src/server/actions/menu.ts`, `src/app/admin/menu` | Categories, prices and price modes, modifiers, dietary tags, availability ("not tonight"), featured items, and an optional photo per dish. |
| Hours & closures | `src/lib/hours.ts`, `special_hours` table | Open/closed state for any time zone, grouped hours, and holiday exceptions. |
| Events & ticketing | `src/lib/events.ts`, `src/lib/event-calendar.ts`, `src/server/ticketing/*`, `src/app/admin/events` | Recurring series and one-off nights, capacity, ticket tiers, inventory-safe reservation functions, door scanning, refunds. Demo mode blocks every real charge. |
| Media library | `src/content/assets.ts` (registry), `media_assets` table, `src/components/media/Asset.tsx` | Components ask for a semantic id such as `heroImage`, never a file path. Replacing an image is one edit in the admin. `npm run assets:check` guards the registry. |
| Inquiry pipeline | `src/lib/inquiry-pipeline.ts`, `src/server/content/inquiries.ts`, `src/app/admin/inquiries` | Private events and catering move through New → Contacted → Planning → Booked → Closed, with a next step and a follow-up date. |
| Hiring & talent | `src/server/content/hiring.ts`, `src/server/actions/hiring.ts`, `talent.ts` | Job openings, applications, and artist or DJ submissions, each with statuses. |
| Staff operations | `src/server/staff/*`, `src/server/actions/staff/*`, `src/app/staff` | Scheduling with drafts and publishing, open shifts, coverage, availability, time off, checklists (required items, photo proof, notes), announcements with acknowledgement, training with quick checks, and incidents. |
| Permissions | `src/server/permissions.ts`, `src/server/staff/permissions.ts` | Capability checks by role (owner, manager, editor, staff, contractor), enforced in actions and mirrored in RLS. |
| Link pages & QR | `src/features/link-hubs`, `src/app/go/[slug]`, `src/app/admin/link-hubs` | Mobile landing pages with scheduled modes, blocks, analytics and QR display. |
| Signage | `src/app/display` | Full-screen TV mode with rotating slides: tonight's event, what's coming up, a QR code, and hours. |
| Email | `src/emails/*`, `src/server/email/*` | React Email templates for tickets, schedule changes and people; the transport is blocked in demo mode. |
| Demo mode | `src/lib/demo.ts`, `src/lib/db/demo*.ts`, `src/middleware.ts` | Each visitor gets an isolated, cookie-backed copy of the sample data that resets after an hour, with no shared database. |
| Schema | `supabase/migrations/*`, `npm run db:verify` | Row level security is on every table. The verifier applies every migration to a clean Postgres 17 and runs the SQL security walkthroughs. |

## What is Cosa Nostra's alone

These files make up the brand. A new restaurant replaces them and does not restyle them:

- `src/components/cosa/**`: the cinematic homepage, the evening sequence, the Behind the Hospitality sequence, the page heroes, the editorial menu, the table finder and pickup.
- `src/styles/cosa*.css`: the after-dark and paper surfaces, the candlelight, grain and type scale.
- `src/app/fonts/bodoni-moda*`: the display face.
- `public/media/**`, `public/events/**` and `scripts/grade-night-media.ts`: the photography and its grade.
- The copy and sample data in `src/content/*.ts`, `src/server/demo-records.ts`, `src/server/staff/demo.ts` and `src/server/demo-link-hubs.ts`.

The admin and staff apps share a neutral structure. Their colours come from the Look settings (`src/lib/appearance`), so they adopt a new brand's palette without code changes.

## Adapting it for another restaurant

1. **Start from the platform, not the page.** Keep `src/lib`, `src/server`, `src/features`, `src/emails`, `src/app/admin`, `src/app/staff`, `src/app/go`, `src/app/display` and `supabase/`.
2. **Write the new public site from scratch.** Build it on the same resolvers, such as `getAllMenus`, `getPublicEvents`, `getSiteSettings` and `getPageCopy`, and the `Asset` component. Everything under `src/components/cosa` is a reference for how to consume the data, not a template.
3. **Replace the content modules.** Change `src/content/site.ts` (name, hours, contact), `menu.ts`, `events.ts`, `pages.ts`, `catering.ts` and the asset registry. The static modules also seed the database.
4. **Provision a new Supabase project.** Run `npm run db:verify`, then apply `supabase/migrations` in order, then create the owner account (`src/server/owner-onboarding.ts`).
5. **Decide on demo mode.** A client build turns `DEMO_MODE` off in a separate repository and sets up Stripe and Resend keys. The public Cosa Nostra portfolio must always stay in demo mode.
6. **Keep the guards.** Run `npm run verify` before every deploy: lint, types, tests, assets, migrations and build.

## Boundaries worth keeping

- Public reads go through resolvers with static fallbacks, and admin writes go through `getWriteDb()` with the signed-in session, so row level security applies.
- Components never embed media paths or vendor URLs.
- Money is always stored as integer cents. Ticket availability is calculated from orders, never stored as a counter.
- An enquiry, application or order is a business record: it can be closed, but never deleted.
