# Casa Aurelia Restaurant Demo

A fictional Italian-American supper club demonstrating a complete modern restaurant web + operations platform. Casa Aurelia is a portfolio concept, not a real restaurant. The venue, people, business records, menu, prices, hours and contact information are fictional.

## Explore

[Live restaurant](https://restaurant-demo-two-zeta.vercel.app) · [Explore the platform](https://restaurant-demo-two-zeta.vercel.app/demo) · [Behind the hospitality](https://restaurant-demo-two-zeta.vercel.app/behind)

- **The restaurant**
  - `/` is a cinematic evening. Opening titles lead into the evening's hours, the kitchen and the events, and end with the site splitting open onto the system behind it.
  - `/menu` is an editorial menu read from the database. It shows dietary marks, featured dishes, "not tonight" items and optional dish photos.
  - `/events` and `/events/[slug]` cover the calendar, event pages, ticketing (demo-safe) and a waitlist.
  - `/private-events` and `/catering` explain the rooms and the service, and their enquiries feed the admin pipeline.
  - `/reservations` and `/order` are simulated booking and pickup flows.
  - `/visit`, `/contact`, `/careers` and `/talent` are the remaining public pages.
- **The operating room (admin):** `/demo/admin` opens on Tonight: attendance, who's on the floor, what needs you, and ticket activity. From there you can reach the content studio, menu, media library, events and tickets, the enquiry pipeline, hiring, talent, link and QR pages, email and the Look settings.
- **The staff workspace:** `/demo/staff` is a phone-first shift home with checklists, announcements, training and open shifts. `/demo/manager` is the scheduling calendar with draft and publish.
- **Signage:** `/display` is a full-screen TV mode for the bar and projector.
- **Link and QR pages:** `/go/links`, `/go/tonight`, `/go/menu`, `/go/review`, `/go/vinyl` and `/go/join`.
- **Portfolio:** `/demo` is the explore hub with a guided tour. `/behind` is the case study.

No sign-in or infrastructure credentials are required. The admin and staff routes use clearly labeled demo identities.

## Platform

Next.js App Router, React, TypeScript and Tailwind, with GSAP, ScrollTrigger and Lenis for the directed motion. One set of records drives three surfaces: the guest site, the admin and the staff app. Any change in one appears in the others.

The public world (`src/components/aurelia`, `src/styles/aurelia*.css`) belongs to Casa Aurelia alone. The restaurant platform underneath is reusable; see [RESTAURANT-FOUNDATION.md](RESTAURANT-FOUNDATION.md). The custom cinematic media still to be produced is briefed in [HIGGSFIELD-ASSETS.md](HIGGSFIELD-ASSETS.md).

Motion is progressive. Content renders first; GSAP choreographs it only when JavaScript runs and the visitor has not asked for reduced motion. Pinned sequences become simple vertical reveals on phones.

## Demo safety

`src/lib/demo.ts` permanently enables demo mode. Environment variables cannot switch this project into live operation.

- Supabase clients, Stripe clients and Resend transport return no live connection, even if credentials are present.
- Webhooks, authentication callbacks and scheduled delivery endpoints are blocked.
- No real email, payments, invitations, customer contact, bookings or orders are sent.
- File uploads and external event imports are disabled. Existing local sample media remains editable in the CMS.
- Each browser carries its own compressed fictional changes in HttpOnly session cookies, lasting one hour. Edits survive serverless instance changes and never enter a shared customer database. The workspace has a small size limit; use “Reset demo” for a fresh copy. This is demonstration storage, not a production database.
- Use fictional details in forms. Sample email addresses use `example.invalid`; the phone uses the reserved fictional 555-01xx range. There is no real street address.
- Sales and guest lists are fictional read-only examples. Payment, refund, check-in integrations and email delivery require separate production infrastructure in a real implementation.

## Run locally

Use Node.js 22.

```sh
npm install
npm run dev
```

No `.env` file is needed. Do not add customer credentials to this demo. Deployment uses an independent GitHub repository and independent Vercel project named `restaurant-demo`.

## Verify

```sh
npm run verify
```

This runs ESLint, TypeScript, the Vitest suite, semantic asset validation, the migration verifier (`npm run db:verify`: every Supabase migration applied in order to a clean Postgres 17, row level security on every table, and the RLS and ticketing SQL walkthroughs) and the production build. Browser checks are available with:

```sh
QA_URL=http://localhost:3100 node scripts/qa-demo.mjs
```

See [media credits](docs/MEDIA.md), [architecture](docs/ARCHITECTURE.md) and [verification report](docs/VERIFICATION.md).
