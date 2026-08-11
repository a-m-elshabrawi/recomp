import type { AuthError } from "@supabase/supabase-js";

/**
 * Supabase's AuthError carries a stable `code` on newer supabase-js
 * versions, but falls back to only a human-readable `message` on some error
 * paths. We check `code` first and fall back to matching on `message` so
 * this stays correct either way.
 */
export function getAuthErrorMessage(error: AuthError): string {
  const code = "code" in error ? error.code : undefined;

  switch (code) {
    case "user_already_exists":
      return "An account with this email already exists. Try logging in instead.";
    case "invalid_credentials":
      return "Incorrect email or password.";
    case "weak_password":
      return "That password is too weak. Use at least 6 characters.";
    case "email_address_invalid":
      return "Please enter a valid email address.";
    case "over_email_send_rate_limit":
      return "Too many attempts. Please wait a moment and try again.";
    default:
      break;
  }

  const message = error.message.toLowerCase();

  if (
    message.includes("already registered") ||
    message.includes("already exists")
  ) {
    return "An account with this email already exists. Try logging in instead.";
  }
  if (message.includes("invalid login credentials")) {
    return "Incorrect email or password.";
  }
  if (message.includes("password") && message.includes("least")) {
    return error.message;
  }
  if (
    message.includes("unable to validate email") ||
    message.includes("invalid email") ||
    message.includes("email address")
  ) {
    return "Please enter a valid email address.";
  }

  return error.message;
}
