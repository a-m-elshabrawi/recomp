import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes viewable without a session. "/" is the public marketing landing
// page; "/login" and "/signup" are the auth screens. Everything else
// (/dashboard, /logs, /progress, /coach, /settings) requires auth.
const PUBLIC_PATHS = new Set(["/", "/login", "/signup"]);

/**
 * Refreshes the Supabase auth session on every request and enforces route
 * protection. Called from the root `middleware.ts`.
 *
 * IMPORTANT: do not add logic between `createServerClient` and
 * `supabase.auth.getUser()` below — that call is what actually refreshes
 * the session token, and anything in between risks skipping it or racing
 * it, which shows up as users getting randomly signed out.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Cookies must be set on both the incoming request (so this same
          // middleware invocation sees them) and the outgoing response (so
          // the browser actually receives them).
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not use `supabase.auth.getSession()` here — it reads the (possibly
  // stale) session from the cookie without verifying it. `getUser()`
  // revalidates the token against Supabase Auth on every call, which is
  // what actually refreshes an expiring session.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isPublicPath = PUBLIC_PATHS.has(pathname);

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // An authenticated user has no reason to see a public-only page: the
  // landing page is a pitch for logged-out visitors, and the auth screens
  // are irrelevant once signed in. Send them straight to their dashboard.
  // (This also means "/" redirects to "/dashboard" for signed-in users,
  // which is the intended behavior for the landing page.)
  if (user && isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // IMPORTANT: return supabaseResponse as-is (not a new NextResponse.next()),
  // so the refreshed auth cookies set above actually reach the browser.
  return supabaseResponse;
}
