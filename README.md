# Cosa Nostra Restaurant Demo

A fictional Italian-American supper club demonstrating a complete modern restaurant web + operations platform. Cosa Nostra is a portfolio concept, not a real restaurant. The venue, people, business records, menu, prices, hours and contact information are fictional.

## Explore

[Live restaurant](https://restaurant-demo-two-zeta.vercel.app) · [Admin demo](https://restaurant-demo-two-zeta.vercel.app/demo/admin) · [Staff demo](https://restaurant-demo-two-zeta.vercel.app/demo/staff)


- Public restaurant: `/`
- Admin workspace: `/demo/admin`
- Employee app: `/demo/staff`
- Manager scheduling: `/demo/manager`
- Sample reservations: `/reservations`
- Sample ordering: `/order`

No sign-in or infrastructure credentials are required. The admin and staff routes use clearly labeled demo identities.

## Platform

Next.js App Router, React, TypeScript and Tailwind power the responsive public website, menu and price management, content management, events and occurrences, ticketing interfaces, semantic media registry, private dining, catering, hiring, talent submissions, staff operations, scheduling, availability, training, announcements, checklists, email previews and communications settings.

The existing repository and database abstractions remain in place. Typed static content supplies the fallback and seeds an isolated temporary workspace. Supabase-compatible schemas, authorization policies, ticket inventory logic, Stripe integration code and React Email infrastructure demonstrate how the system is structured.

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

This runs ESLint, TypeScript, the Vitest suite, semantic asset validation and the production build. Browser checks are available with:

```sh
QA_URL=http://localhost:3100 node scripts/qa-demo.mjs
```

See [media credits](docs/MEDIA.md), [architecture](docs/ARCHITECTURE.md) and [verification report](docs/VERIFICATION.md).
