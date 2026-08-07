# just-us

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines Next.js, Self, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **Next.js** - Full-stack React framework
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **Shared UI package** - shadcn/ui primitives live in `packages/ui`
- **Prisma** - TypeScript-first ORM
- **PostgreSQL** - Database engine
- **Authentication** - Better-Auth
- **Turborepo** - Optimized monorepo build system
- **Biome** - Linting and formatting

## Getting Started

Set up your database and `apps/web/.env` **first**. `bun install` generates the
Prisma client and applies migrations, and it fails outright without a
`DATABASE_URL` — see [Database Setup](#database-setup).

```bash
cp apps/web/.env.example apps/web/.env   # fill in DATABASE_URL + SHADOW_DATABASE_URL
bun install
```

## Database Setup

PostgreSQL with Prisma. The schema is versioned as migrations under
`packages/db/prisma/migrations`, and `bun install` applies them — see
`packages/db/scripts/postinstall.mjs`.

### Use your own databases

Every developer needs **two** databases of their own. Neon branches are the
easiest way: they're instant and copy-on-write, so branching from `dev` gives you
realistic data without any ability to damage the real thing.

| Variable | Points at |
| --- | --- |
| `DATABASE_URL` | Your own branch of `dev`, **with** data |
| `SHADOW_DATABASE_URL` | Your own **empty** branch |

Neither is shared, and the shadow one least of all: `migrate dev` drops and
recreates objects inside it, so two people pointing at the same shadow database
clobber each other mid-validation and the failure surfaces as a bogus drift
error rather than a collision.

**Never point `DATABASE_URL` at the `dev`, `qa`, `demo`, or preview databases
while running a `db:*` command.** `migrate dev` applies migrations to whatever
`DATABASE_URL` names, and offers to **reset** it when it detects drift — on a
shared database, accepting that drops everyone's data.

`migrate dev` needs the shadow database because it creates and drops a scratch
copy to check a migration before writing it. Prisma normally makes one itself,
but that needs `CREATE DATABASE`, which managed Postgres (Neon included)
withholds. Only `migrate dev` reads the variable, so CI and production don't need
it.

### Changing the schema

Edit the `.prisma` files in `packages/db/prisma/schema`, then:

```bash
bun run db:migrate          # writes a migration, applies it, regenerates the client
```

Commit the generated `prisma/migrations/<timestamp>_<name>/` directory alongside
the schema change. Don't hand-author migration SQL — `db:migrate` validates
against the shadow database first, and that check is the only thing between a
broken migration and every environment.

### Write migrations that survive a database with rows in it

A migration is validated against an *empty* shadow database but runs against
databases that have data. That gap has broken this project's deployments twice:

```sql
-- Fails with 23502 against any table that already has rows
ALTER TABLE "donation" ADD COLUMN "stripeCheckoutSessionId" TEXT NOT NULL;
```

Add the column, backfill it, then constrain it:

```sql
ALTER TABLE "donation" ADD COLUMN "stripeCheckoutSessionId" TEXT;
UPDATE "donation" SET "stripeCheckoutSessionId" = 'legacy_' || "id"
  WHERE "stripeCheckoutSessionId" IS NULL;
ALTER TABLE "donation" ALTER COLUMN "stripeCheckoutSessionId" SET NOT NULL;
```

The same care applies to every narrowing change: a new unique constraint on a
column with duplicates, a required column added to a populated table, a value
removed from an enum still in use.

### How migrations reach each environment

`bun install` runs `prisma generate` and then `prisma migrate deploy`, so schema
and code arrive together in one deploy. On Vercel this is the **only** thing that
applies migrations — the build command is a plain `next build`.

A build migrates only when the database is its own:

- `dev`, `qa`, and `demo` each have their own `DATABASE_URL` and always migrate.
- Every other branch — each feature branch, each PR — falls back to the
  environment-wide preview `DATABASE_URL` and **skips** the migrate step, unless
  `DB_DEDICATED` is set to assert that database is reserved for previews.
- `SKIP_DB_MIGRATE` skips it anywhere.

The reason for skipping is blast radius. A branch that migrates a database it
shares applies its own *unmerged* migrations there, and a failure is not confined
to the branch that caused it — see below.

Every migrating build names its target, host and database only:

```
[db] migrate deploy → ep-something-pooler.aws.neon.tech/neondb
```

Check that line first when a preview misbehaves. A preview build naming the `dev`
host means `DB_DEDICATED` is set while the preview `DATABASE_URL` still points at
`dev` — the configuration that lets one PR poison every other deployment.

### When a migration fails

A failed migration is **sticky**. Prisma records the attempt in
`_prisma_migrations`, and from then on `migrate deploy` refuses to run against
that database at all (P3009). One bad migration blocks every deployment pointed
at that database, not just the branch that caused it.

Prisma does not wrap a migration in a transaction, so statements *before* the
failing one stay applied. Recovery is two steps, in this order:

```bash
bun run db:migrate:status     # names the failed migration and the error

# 1. Undo what the partial run left behind — types, tables, columns, constraints.
# 2. Only then clear the failed record:
bunx prisma migrate resolve --rolled-back <migration_name>
```

Both steps, against the affected database, leftovers first. Clearing the record
on its own just lets the migration retry and fail again on its own debris — which
is exactly how a two-day outage became a four-day one.

### Which command to use

| Command | Use |
| --- | --- |
| `db:migrate` | Day-to-day schema changes — the one you want |
| `db:migrate:create` | Write the migration but don't apply it yet |
| `db:migrate:deploy` | Apply pending migrations — what builds run |
| `db:migrate:status` | Check a database is up to date, and name a failed migration |
| `db:migrate:sql` | Print pending SQL. Last resort — see below |
| `db:push` | Throwaway databases only — see below |

`db:migrate:sql` prints SQL for you to save as a migration by hand. It skips the
shadow-database check, which is how the `NOT NULL` failure above reached a real
database. Prefer `db:migrate` unless you genuinely have no shadow database.

`db:push` writes the schema straight to the database without recording a
migration. That leaves the database ahead of `prisma/migrations`, and the next
`migrate dev` reports drift and offers to reset — which drops data. Use it only
against a database you're happy to lose, never a shared or deployed one.

The first migration, `0_init`, is a baseline: it captures the schema as it stood
when migrations were adopted, and is already marked applied on the existing
databases. Running it on a fresh database creates every table from scratch.

## Running the app

With `apps/web/.env` filled in and `bun install` done, start the dev server:

```bash
bun run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser to see the fullstack application.

## UI Customization

React web apps in this stack share shadcn/ui primitives through `packages/ui`.

- Change design tokens and global styles in `packages/ui/src/styles/globals.css`
- Update shared primitives in `packages/ui/src/components/*`
- Adjust shadcn aliases or style config in `packages/ui/components.json` and `apps/web/components.json`

### Add more shared components

Run this from the project root to add more primitives to the shared UI package:

```bash
npx shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

Import shared components like this:

```tsx
import { Button } from "@just-us/ui/components/button";
```

### Add app-specific blocks

If you want to add app-specific blocks instead of shared primitives, run the shadcn CLI from `apps/web`.

## Deployment

### Vercel Services

- Target: web + server
- Config: `vercel.json`
- Link the project first: bun run deploy:setup
- Local Vercel dev: bun run dev:vercel
- Sync preview env: bun run env:preview
- Sync production env: bun run env:production
- Dry-run check (no upload): bun run deploy:check
- Preview deploy: bun run deploy
- Production deploy: bun run deploy:prod
  Vercel Services share project environment variables, but deploys do not upload local `.env` files automatically. Link the project with `vercel link`, then run the env sync command before your first deploy (otherwise the deployment starts with no env vars), or pass one-off envs with `vercel deploy -e KEY=value`.
  Pass Vercel CLI flags to the env sync command directly, for example: `bun run env:production --scope your-team`.

For more details, see the guide on [Deploying to Vercel](https://www.better-t-stack.dev/docs/guides/vercel).

## Git Hooks and Formatting

- Run checks: `bun run check`

## Project Structure

```
just-us/
├── apps/
│   └── web/         # Fullstack application (Next.js)
├── packages/
│   ├── ui/          # Shared shadcn/ui components and styles
│   ├── auth/        # Authentication configuration & logic
│   └── db/          # Database schema & queries
```

## Available Scripts

- `bun run dev`: Start all applications in development mode
- `bun run build`: Build all applications
- `bun run dev:web`: Start only the web application
- `bun run check-types`: Check TypeScript types across all apps
- `bun run db:generate`: Generate database client/types
- `bun run db:migrate`: Create and apply a migration for your schema changes
- `bun run db:migrate:create`: Write a migration without applying it
- `bun run db:migrate:sql`: Print the SQL for pending schema changes
- `bun run db:migrate:deploy`: Apply pending migrations (CI / production)
- `bun run db:migrate:status`: Report whether the database is up to date
- `bun run db:push`: Write the schema directly, recording no migration — throwaway databases only
- `bun run db:studio`: Open database studio UI
- `bun run check`: Run Biome formatting and linting
- `bun run deploy:setup`: Link this repo to a Vercel project (first-time setup)
- `bun run dev:vercel`: Run the Vercel Services dev environment locally
- `bun run env:preview`: Sync local env files to the Vercel preview environment
- `bun run env:production`: Sync local env files to the Vercel production environment
- `bun run deploy`: Create a Vercel preview deployment
- `bun run deploy:prod`: Deploy to Vercel production
- `bun run deploy:check`: Dry-run a deploy to preview framework detection and included files without uploading
