import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Admin Supabase client using the service_role key, which bypasses Row
 * Level Security entirely. The `import "server-only"` above makes any
 * accidental import of this file from client-bundled code a build error,
 * rather than a runtime leak of the key into the browser.
 *
 * This is a plain @supabase/supabase-js client (not @supabase/ssr) on
 * purpose: admin operations aren't tied to a user's cookie session.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const LIST_USERS_PER_PAGE = 200;
// Safety cap on how many pages we'll paginate through. This app isn't
// expected to have anywhere near this many users; the cap just bounds the
// cost of a single request rather than scanning an unbounded user table.
const LIST_USERS_MAX_PAGES = 25;

/**
 * Checks whether a user with the given email already exists.
 *
 * The Admin API's listUsers() has no email filter, so we paginate through
 * users and match manually (case-insensitive, since Supabase normalizes
 * emails to lowercase but the caller might not have).
 */
export async function userExistsByEmail(email: string): Promise<boolean> {
  const normalizedEmail = email.trim().toLowerCase();
  const supabaseAdmin = createAdminClient();

  let page = 1;
  while (page <= LIST_USERS_MAX_PAGES) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: LIST_USERS_PER_PAGE,
    });

    if (error) {
      throw error;
    }

    const match = data.users.some(
      (user) => user.email?.toLowerCase() === normalizedEmail
    );
    if (match) {
      return true;
    }

    if (data.nextPage === null) {
      break;
    }
    page = data.nextPage;
  }

  return false;
}
