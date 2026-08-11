# Recomp

A personal fitness tracking and body recomposition app: a 4-day bodyweight
program, daily weight/nutrition logging, weekly check-ins, progress charts,
and an AI coach with full context on your own program and history.

## Tech stack

- **Framework**: Next.js 16 (App Router), TypeScript, Turbopack
- **UI**: Tailwind CSS v4, shadcn/ui (base-nova style)
- **Charts**: Recharts
- **Database / Auth**: Supabase (Postgres + Supabase Auth via `@supabase/ssr`)
- **AI**: Google Gemini via `@google/generative-ai`
- **Hosting**: Vercel

## Local development

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

This assumes `.env.local` is already filled in and the database schema is
already applied. For first-time setup from scratch — creating the Supabase
project, running the schema, configuring auth, getting a Gemini key, and
deploying to Vercel — see **[SETUP.md](./SETUP.md)**, which walks through
all of that step by step.

## Project structure

```
app/
  (auth)/            Login/signup pages — public, no nav shell
    login/
    signup/
  (app)/              Authenticated app shell (shared nav via layout.tsx)
    page.tsx          Dashboard — today's workout, quick stats
    logs/              Weight / nutrition / weekly check-in logging
    progress/          Charts: weight trend, consistency, strength, nutrition
    coach/              AI coach chat
    settings/           Edit profile + nutrition targets
    *actions.ts        Server Actions colocated with the page that uses them
  api/
    auth/check-email/  Pre-signup duplicate-email check (service-role, server-only)
    coach/              Gemini chat endpoint (reads Supabase for context, server-only)

components/
  ui/                 shadcn/ui primitives (Button, Input, Card, Tabs, ...)
  dashboard/, logs/, progress/, coach/, settings/, auth/
                       Feature-specific components, one folder per app area
  training-ledger/     Shared design-system components (e.g. BarbellPlates)

lib/
  supabase/            client.ts (browser), server.ts (RSC/Server Actions),
                       middleware.ts (session refresh), admin.ts (service-role,
                       server-only via the `server-only` package)
  dashboard/, logs/, progress/, coach/
                       Domain logic per app area (date/week helpers, types,
                       formatting) — kept close to where it's used
  stats.ts, units.ts   Small cross-cutting helpers (averages, unit formatting)

supabase/
  schema.sql          Full current schema — run once on a fresh project
  migrations/          Incremental, additive changes for an existing database
                       (run these instead of schema.sql once you already
                       have data — see the comment at the top of schema.sql)

middleware.ts          Route protection + session refresh (excludes /api —
                       API routes check auth themselves and return real
                       status codes instead of redirecting)
```

Route protection, Supabase session handling, and the overall page structure
are covered in more depth by the comments in `middleware.ts` and
`lib/supabase/*`.

## Solo-use, multi-tenant-ready

This app is built and deployed for one person, but nothing in the
architecture assumes that. Every table has Row Level Security scoped to
`auth.uid()`, every read/write goes through the authenticated user's own
session (the service-role key is only ever used server-side, for the two
specific things that genuinely need to bypass RLS — see
`lib/supabase/admin.ts`), and sign-up/login work for any number of
independent accounts with fully isolated data.

The one thing that's deliberately configured for solo use rather than a
public launch: Supabase's "Confirm email" setting is off, so new sign-ups
don't need to verify an email address before logging in (see `SETUP.md`).
That's a one-toggle change if this ever needs to support real strangers
signing up rather than just you.
