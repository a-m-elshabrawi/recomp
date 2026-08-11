import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Run on every page route except static assets and Next's internal
    // files, so the session cookie stays fresh across the whole app.
    // API routes are excluded on purpose: this middleware's job is
    // page-level redirects (HTML), which make no sense for a fetch()
    // caller. Route handlers that need auth check it themselves via
    // lib/supabase/server.ts and return a proper status code instead.
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
