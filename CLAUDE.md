# Repository scope — permanent rules

These rules apply to every Claude session in this repository, whatever the task says.

1. **This repository only.** A Restaurant Demo session may modify only this repository
   (`github.com/Hyphycodes/restaurant-demo`) unless the user explicitly names and authorizes
   another repository in that same request. An authorization covers only the request that gives
   it; it never carries over to later sessions.
2. **Verify before changing anything.** Run `git rev-parse --show-toplevel` and `git remote -v`
   and confirm the root is this repository and `origin` points at `Hyphycodes/restaurant-demo`.
   Check again before every commit and push. If either is not true, stop.
3. **No sibling repositories.** Never edit, commit in, push or use as scratch space any other local
   folder or repository, even one next to this one, without that explicit authorization.
4. **No outside deployments.** Never deploy, reconfigure or change environment variables, domains
   or databases of any other Vercel project, Supabase project or external service.

# Concept rules

- **Casa Aurelia** is a fictional Italian supper club in Chicago's West Loop, built as a portfolio
  demonstration by Hyphy Studio. The venue, people, records, prices and contact details are
  made up. Keep that clear wherever a guest could mistake it for a real business: reservations,
  orders, tickets, checkout, contact and email.
- Demo mode is permanent (`src/lib/demo.ts`). No real payments, emails, bookings or orders.
- Brand direction: a modern, intimate, slightly editorial supper club. No mafia or mob
  references, crime imagery, red-checkered-tablecloth clichés or cartoon Italy.
- Never add real testimonials, customers, revenue or ticket sales. Sample records stay fictional.
