/**
 * The public read-only demo account.
 *
 * These credentials are deliberately public (they're printed in README.md
 * and linked from the portfolio case study) so a visitor can look around
 * the app without signing up. Nothing secret lives here — the account owns
 * only generated data, and Row Level Security scopes it to its own rows
 * exactly like any other account.
 *
 * The email is hardcoded rather than read from an env var on purpose: it
 * isn't a secret, and hardcoding means the demo behaves identically in
 * local dev, preview deployments, and production with no env wiring to
 * forget. `scripts/seed-demo.mjs` imports the same constants (via its own
 * copy, since it's a plain .mjs script) — keep them in sync.
 */
export const DEMO_EMAIL = "demo@recomp.app";

/**
 * True when the given account is the shared demo account. Callers pass
 * `user.email`, which is `string | undefined` on Supabase's User type.
 *
 * Supabase normalizes stored emails to lowercase, but this compares
 * case-insensitively anyway so a caller passing a raw user-typed address
 * can't slip past.
 */
export function isDemoUser(email: string | null | undefined): boolean {
  return typeof email === "string" && email.toLowerCase() === DEMO_EMAIL;
}
