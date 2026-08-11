import { NextResponse } from "next/server";
import { userExistsByEmail } from "@/lib/supabase/admin";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Checks whether an email is already registered, using the service-role
 * admin client (see lib/supabase/admin.ts — that key never leaves the
 * server). The signup form calls this before supabase.auth.signUp(), since
 * signUp() alone doesn't reliably reject duplicate emails when "Confirm
 * email" is disabled in Supabase Auth.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const email = (body as { email?: unknown })?.email;

  if (typeof email !== "string" || !EMAIL_REGEX.test(email)) {
    return NextResponse.json(
      { error: "A valid email is required." },
      { status: 400 }
    );
  }

  try {
    const exists = await userExistsByEmail(email);
    return NextResponse.json({ exists });
  } catch {
    return NextResponse.json(
      { error: "Unable to verify email right now." },
      { status: 502 }
    );
  }
}
