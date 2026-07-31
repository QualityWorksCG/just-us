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

First, install the dependencies:

```bash
bun install
```

## Database Setup

This project uses PostgreSQL with Prisma, and the schema is versioned as
migrations under `packages/db/prisma/migrations`.

1. Make sure you have a PostgreSQL database set up.
2. Update your `apps/web/.env` file with your PostgreSQL connection details.

3. Apply the migrations to your database:

```bash
bun run db:migrate:deploy
```

### Changing the schema

Edit the `.prisma` files in `packages/db/prisma/schema`, then create a migration
for the change:

```bash
bun run db:migrate          # writes a migration, applies it, regenerates the client
```

`migrate dev` needs a **shadow database** — a scratch database Prisma creates and
drops to check the migration before writing it. It normally makes one itself, but
that needs `CREATE DATABASE`, which managed Postgres (Neon included) usually
withholds. Point `SHADOW_DATABASE_URL` at an empty database you don't mind Prisma
wiping — a Neon branch or a local Postgres both do — and it will use that instead.
Nothing else reads the variable, so CI and production don't need it.

Without a shadow database available, author the migration by hand:

```bash
bun run db:migrate:sql      # prints the SQL for your schema changes
# save it as prisma/migrations/<timestamp>_<name>/migration.sql, then:
bun run db:migrate:deploy
```

### Which command to use

| Command                 | Use                                                        |
| ----------------------- | ---------------------------------------------------------- |
| `db:migrate`            | Day-to-day schema changes in development                   |
| `db:migrate:create`     | Write the migration but don't apply it yet                 |
| `db:migrate:sql`        | Print pending SQL, for hand-authoring a migration          |
| `db:migrate:deploy`     | Apply pending migrations — what CI and production run       |
| `db:migrate:status`     | Check whether the database is up to date                   |
| `db:push`               | Throwaway local databases only — see below                 |

`db:push` writes the schema straight to the database without recording a
migration. That leaves the database ahead of `prisma/migrations`, and the next
`migrate dev` will report drift and offer to reset — which drops data. Use it only
against a database you're happy to lose, never against a shared or deployed one.

The first migration, `0_init`, is a baseline: it captures the schema as it stood
when migrations were adopted, and is already marked applied on the existing
databases. Running it on a fresh database creates every table from scratch.

Then, run the development server:

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
