# Recomp

A body recomposition tracker: a four-day bodyweight programme, daily weight and nutrition
logging, weekly check-ins, progress charts, and a coach with access to your actual
programme and history.

**Status** Shipped, deployed for one user
**Built** August 2026

## Why this exists

Every fitness app I tried wanted to be a social network, a marketplace, or a subscription.
I wanted to log a weight, tick off a workout, and see whether the trend was going the right
way. The AI coach exists because the useful version of coaching advice requires knowing
what you actually did last week, and a general chatbot does not.

## What it does

Follow a four-day bodyweight programme with the day's workout on the dashboard. Log weight
and nutrition daily, and complete a weekly check-in covering energy, sleep and sessions completed.
See weight trend, consistency, strength and nutrition as charts. Ask the coach a question
and get an answer grounded in your own logs.

## Stack and rationale

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16, App Router, Turbopack | Server Actions let form submissions skip an API layer entirely, which is most of what this app does |
| UI | Tailwind CSS v4, shadcn/ui (base-nova) | Components live in the repo and can be edited rather than configured around |
| Charts | Recharts | Composable React components rather than an imperative canvas API, so a chart is a component like anything else |
| Database and auth | Supabase, Postgres with Supabase Auth via `@supabase/ssr` | Row level security enforces isolation in the database, so a forgotten `where` clause is not a data breach |
| AI | Google Gemini via `@google/generative-ai` | Generous free tier and a large enough context window to send a meaningful slice of training history |
| Hosting | Vercel | Matches the framework |

## Design decisions

1. **Built for one user, architected for many.** Every table has row level security scoped
   to `auth.uid()`, every read and write goes through the authenticated user's own session,
   and signup works for any number of accounts with fully isolated data. Nothing in the
   schema assumes a single user.

2. **The service-role key is used for exactly two things, both server-only.** It lives in
   `lib/supabase/admin.ts`, which is protected by the `server-only` package so importing it
   into a client component is a build error rather than a leak.

3. **Middleware excludes `/api`.** Route protection redirects unauthenticated users to
   login, which is right for pages and wrong for API routes, where a redirect turns a 401
   into a confusing 200 with HTML. API routes check auth themselves and return real status
   codes.

4. **Server Actions are colocated with the page that uses them.** `actions.ts` sits next to
   the page rather than in a central directory. Finding the code that handles a form means
   looking in the folder where the form lives.

5. **Domain logic sits in `lib/<area>/`, not in components.** Date and week helpers, types
   and formatting for each app area live next to each other and away from the rendering.

6. **Email confirmation is deliberately off.** New signups do not verify an address. This
   is the one setting configured for solo use rather than public launch, and it is a
   one-toggle change if that ever stops being true.

## Data model

Twelve tables in Postgres, all with row level security enabled.

`profiles` keys directly to `auth.users.id`, with checked enums for sex, activity level,
goal and units. `nutrition_targets` holds the calorie and macro goals. `programs`,
`program_days` and `program_exercises` describe the training plan. `workout_logs` and
`exercise_logs` record what was done, `weight_logs` and `nutrition_logs` the daily numbers,
and `weekly_checkins` the subjective ratings with range checks (energy and sleep 1 to 5,
sessions completed 0 to 4). Three columns on that table, including `adherence_pct`, are
left over from an earlier guess at its shape and are deliberately unused. `coach_conversations` and `coach_messages` store the chat, with a role
check constraining messages to `user` or `assistant`.

The policy worth noting is on `exercise_logs`, which has no `user_id` of its own. Its RLS
policy joins up through `workout_logs.user_id` to establish ownership, so the row is
protected by its parent rather than by a duplicated column that could drift.

## What this is and is not

It is a real multi-tenant application with genuine database-level isolation. It is deployed
and used by one person, which is a deployment fact rather than an architectural one.

It is not a coaching product and the AI is not qualified. The coach reads your logs and
responds; it has no medical knowledge, no safety rails around extreme inputs, and no
awareness of injury or condition. It is a well-informed chat interface over your own data.

The programme is fixed. Four days of bodyweight training, not a generated or adaptive plan.

## Known limitations

**No email verification.** Supabase's "Confirm email" setting is off, which is correct for
solo use and not for a public launch. Turn it on before deploying this for anyone else.

**The coach has no history selection strategy.** The endpoint reads Supabase and builds
context server-side. How much of a growing log it can carry is a question there is not yet
enough data to force, and it will need answering before it becomes visible.

**No offline support.** Logging a workout requires connectivity, which is the one moment
you might be in a basement gym without any.

## Running it locally

```bash
npm install
npm run dev
```

This assumes `.env.local` is populated and the schema has been applied. For a first-time
setup from scratch, covering the Supabase project, the schema, auth configuration, the
Gemini key and deployment, see [SETUP.md](./SETUP.md).

Run `supabase/schema.sql` once against a fresh project. If the database already has data,
run the files in `supabase/migrations/` instead. There is a comment at the top of
`schema.sql` explaining which applies.

## Project structure

```
app/
  (auth)/           login, signup. Public, no nav shell
  (app)/            Authenticated shell with shared nav
    page.tsx        Dashboard: today's workout, quick stats
    logs/           Weight, nutrition, weekly check-in
    progress/       Charts
    coach/          Chat
    *actions.ts     Server Actions, colocated with their page
  api/
    coach/          Gemini endpoint. Reads Supabase for context, server-only
lib/
  supabase/         client (browser), server (RSC and actions),
                    middleware (session refresh), admin (service-role, server-only)
supabase/
  schema.sql        Full current schema, for a fresh project
  migrations/       Incremental changes, for a database with data
middleware.ts       Route protection and session refresh. Excludes /api
```

## AI usage disclosure

AI coding tools were used during the development of this project. All generated code was
reviewed before use.

The shipped product calls Google Gemini at runtime through the `/api/coach` route, which
reads the user's own Supabase data server-side to build context.

## Licence

MIT.
