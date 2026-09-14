# Production launch readiness

A short checklist for taking JustUs live and handing every account to the client.
Work top to bottom: **transfer accounts first, deploy second, smoke test third.**
Rotating a secret after the smoke test invalidates the thing you just tested.

Legend: **C** = client must act (they own the billing identity), **D** = dev team.

---

## Phase 0 — Decisions to confirm before anything is bought

- [ ] Production domain and the email sending domain (same root or different?)
- [ ] Who owns billing for each service — one client account, or client org with us as member
- [ ] Support/system email addresses (`no-reply@`, `support@`) and who reads the inbox
- [ ] Live Stripe money routing is still the sandbox decision (destination charges, recipient per case)
- [ ] Lawyer has read Terms §4 and Privacy §4 (trust-account carve-out, gifts not tax-deductible)
- [ ] Launch date, launch window, and who is on call for the first 48 hours

---

## Phase 1 — Account transfer / provisioning

For each service the pattern is the same: **client creates the account on their
own billing → we get invited as a member → we move the resource or rebuild it →
we drop to the lowest access the client wants us to keep.**

### Domain + DNS — C
- [ ] Registrar account is the client's; we are delegated, not the owner
- [ ] Apex + `www` records point at Vercel; `www` → apex redirect chosen
- [ ] Email DNS (SPF, DKIM, DMARC, optional custom return-path) added — see Resend below
- [ ] TTLs lowered to 300s ~24h before cutover, restored after
- [ ] Auto-renew on, registrar lock on, expiry date recorded

### GitHub — C/D
- [ ] Repo transferred to the client's org (or client org forked and made canonical)
- [ ] Vercel Git integration re-authorised against the new repo owner
- [ ] Branch protection on `main`, dev team retained as collaborators

### Vercel — C
- [ ] Client creates the Vercel team on their own plan (Pro — production needs it for the domain + team seats)
- [ ] Project transferred into the client team, dev team invited as members
- [ ] Production domain added and verified in the client's project
- [ ] **Blob store** re-created or transferred in the client team; `BLOB_READ_WRITE_TOKEN` re-issued
      (case images, profile photos, attorney headshots, case-update media, evidence all live here)
- [ ] Existing blob assets copied over if the store is re-created, and URLs still resolve
- [ ] **AI Gateway** key created on the client account (`AI_GATEWAY_API_KEY`), spend limit set
- [ ] Deploy protection / password protection off for production, on for preview
- [ ] Log drain or observability retention configured to whatever the client needs

### Database — Neon — C
- [ ] Client owns the Neon project; dev team invited
- [ ] Dedicated **production** branch (not `dev`, `qa`, `demo`, or the shared preview branch)
- [ ] Production `DATABASE_URL` uses the pooled host and a role scoped to this app
- [ ] Point-in-time restore window set (7 days minimum) and a restore rehearsed once
- [ ] Autoscaling / compute size and spend cap set
- [ ] Confirm production is **not** reachable from any preview env var

### Email — Resend — C
- [ ] Client owns the Resend account; dev team invited
- [ ] Sending domain added and **verified** (SPF + DKIM records live)
- [ ] DMARC policy published (start `p=none`, tighten later)
- [ ] `EMAIL_SOURCE` changed off the default `onboarding@resend.dev` to the client's domain
- [ ] `RESEND_API_KEY` issued from the client account, sending-only permission
- [ ] Reply-to address routes to a real inbox
- [ ] Test send lands in Gmail + Outlook **inbox, not spam**, from the production domain

### Payments — Stripe — C
- [ ] Client's **live** Stripe account, business verification complete
- [ ] **Connect** platform onboarding completed on the live account (legal-adjacent vertical → Stripe reviews it; start early)
- [ ] Connect branding, platform display name, and **statement descriptor** set — none of this carries over from sandbox
- [ ] Platform key is a **restricted** key, not the full secret (`STRIPE_SECRET_KEY`)
- [ ] Two webhook endpoints created against the production URL, **separate secrets**:
      - `/api/stripe/webhook` → `checkout.session.completed`, `charge.refunded`, `charge.dispute.created` (`STRIPE_WEBHOOK_SECRET`)
      - `/api/stripe/connect-webhook` → `account.updated` (`STRIPE_CONNECT_WEBHOOK_SECRET`)
- [ ] Fee config reviewed for live: `STRIPE_PLATFORM_FEE_BPS` (500 = the 5% the copy promises),
      `STRIPE_MIN_DONATION_CENTS`, `STRIPE_DONATION_PRESETS`
- [ ] Payout schedule set; client understands **negative-balance liability sits with the platform**
- [ ] Receipt/email copy does not imply tax deductibility
- [ ] Radar rules and dispute notifications routed to a monitored address

### Auth + misc — D
- [ ] Fresh `BETTER_AUTH_SECRET` generated for production only (≥32 chars, never reused from dev)
- [ ] `BETTER_AUTH_URL` = the real production origin
- [ ] `NEXT_PUBLIC_USERBACK_TOKEN` left **unset** in production (feedback widget is for demo/QA)
- [ ] `OPENAI_API_KEY` on the client account if we're not routing everything through AI Gateway
- [ ] All dev/personal keys removed from the production env after handover
- [ ] Credentials handed over in a password manager vault the client owns

---

## Phase 2 — Production deployment

- [ ] `bun run check` and `bun run check-types` clean on the release commit
- [ ] Migrations reviewed for **data-safe** shape (no `NOT NULL` add without backfill; see README)
- [ ] `bun run db:migrate:status` against production → no failed/pending surprises
- [ ] `bun run env:production` synced, then env vars **read back in the Vercel UI** and diffed against
      `packages/env/src/server.ts` — nothing missing, no sandbox `sk_test_` / `whsec_` left behind
- [ ] `SKIP_ENV_VALIDATION` and `SKIP_DB_MIGRATE` **not** set in production
- [ ] `bun run deploy:check` (dry run) passes
- [ ] Deploy: `bun run deploy:prod` (or promote the verified preview)
- [ ] Build log shows the migrate line naming the **production** host:
      `[db] migrate deploy → ep-…-pooler.aws.neon.tech/…`
- [ ] Custom domain resolves over HTTPS, cert issued, `www` redirect works
- [ ] Seed the first admin user; verify the admin-only pages gate correctly
- [ ] Feature flags set to their launch values on `/configuration`
- [ ] `robots.txt` / sitemap allow indexing (or intentionally don't, if soft launch)
- [ ] Tag the release and note the previous good deployment URL for rollback

**Rollback:** instant rollback to the prior Vercel deployment. Note that a
migration already applied is *not* rolled back — if the release includes a
narrowing migration, confirm the previous build still runs against the new schema
before you ship, or the rollback isn't real.

---

## Phase 3 — Production smoke test

Run on the **real domain with live keys**, one real card, one real payout target.
Every step is a pass/fail; a failure is a launch blocker unless explicitly waived.

### Auth + onboarding
- [ ] Sign up → verification email arrives from the production domain → link verifies
- [ ] Password reset email arrives and the new password works
- [ ] Magic link email works
- [ ] `/onboarding` completes for plaintiff and for attorney
- [ ] Sign out, sign back in, session persists across a refresh

### Plaintiff journey
- [ ] `/cases/new` wizard completes end to end
- [ ] Image + evidence upload succeeds (Blob) and the file renders back on the case page
- [ ] AI helpers (story polish, title suggestions) respond, and degrade cleanly if the key is absent
- [ ] Case appears on `/discover` and `/cases`, and on `/my-cases` with correct status tabs (incl. Closed)
- [ ] Post a case update → subscribers get the update email
- [ ] `/messages` sends and receives; the new-message email fires
- [ ] `/notifications` shows the right items

### Attorney journey
- [ ] Attorney profile publishes; headshot upload works
- [ ] `/find-attorney` and `/attorneys/[id]` render; admitted-state filtering behaves
- [ ] Expression of interest → email to the plaintiff
- [ ] Case invite → `/case-invite` and `/accept-invite` both land correctly for a signed-out and a signed-in user
- [ ] **Stripe Connect onboarding** completes on the live account and `account.updated`
      flips the payout status in-app (check the Connect webhook delivered 200)

### Donations — the one to be most careful with
- [ ] Donate button only appears on a `live` case with an onboarded recipient
- [ ] Preset amounts and the minimum both enforce correctly
- [ ] Real card checkout succeeds; funds route to the **correct** recipient
- [ ] Statement descriptor on the real card statement is recognisable
- [ ] `checkout.session.completed` webhook delivered 200 → donation row written once (no dupes on retry)
- [ ] Thank-you email arrives; `/certificates/[token]` renders
- [ ] Totals update on the case page, `/donations`, and `/revenue`
- [ ] `/donations/export` CSV downloads and reconciles against the Stripe dashboard
- [ ] Refund a test donation → `charge.refunded` reflected in-app
- [ ] Platform fee on the real charge equals the advertised 5% to the cent

### Admin + trust & safety
- [ ] `/moderation` actions work and the moderation notice email sends
- [ ] `/audit` logs the actions just taken
- [ ] `/users` and `/campaigns` load for admins and 404/redirect for everyone else

### Cross-cutting
- [ ] Mobile layout on a real phone for landing, discover, case, and checkout
- [ ] Lighthouse pass on the landing page (no console errors, no mixed content)
- [ ] `/terms`, `/privacy`, and the fee-breakdown copy match the live fee config
- [ ] 404 and error pages render properly
- [ ] Server logs clean of unexpected errors for the whole smoke run

---

## Phase 4 — Day-one operations

- [ ] Uptime check on the landing page + one authenticated route
- [ ] Error alerting routed to a channel someone actually watches
- [ ] Stripe dispute/failed-payout alerts to the client
- [ ] Resend bounce/complaint rate checked after the first real email batch
- [ ] Neon backup/PITR verified once more against the live database
- [ ] Spend caps set on Vercel, Neon, AI Gateway/OpenAI, and Blob
- [ ] Handover doc: who to call for each service, where the credentials live
- [ ] Support inbox monitored, and a known-issues list agreed with the client

---

## Sign-off

| Area | Owner | Verified on | Signed off |
| --- | --- | --- | --- |
| Accounts transferred | | | |
| Production deploy | | | |
| Smoke test | | | |
| Payments (live money) | | | |
| Legal copy review | | | |
| Go / no-go | | | |
