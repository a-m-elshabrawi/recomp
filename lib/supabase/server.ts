import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for use in Server Components, Server Actions, and Route
 * Handlers. Must be created fresh per request (it reads the request's
 * cookies), so always call and await this — never cache the result.
 *
 * Server Components can only read cookies, not write them, so `setAll` is
 * wrapped in a try/catch: it throws when called from a Server Component,
 * which is safe to ignore as long as session refresh is handled elsewhere
 * (e.g. in middleware) in a later stage of this project.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — ignore, see doc comment above.
          }
        },
      },
    }
  );
}
