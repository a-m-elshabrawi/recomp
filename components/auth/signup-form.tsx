"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;
// A genuinely new signUp()'s user.created_at should be effectively "now".
// If it's older than this, the account almost certainly already existed
// before this request — see the defense-in-depth check below.
const MAX_NEW_ACCOUNT_AGE_MS = 60_000;
const ALREADY_REGISTERED_MESSAGE =
  "This email is already registered — try logging in instead.";

export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!EMAIL_REGEX.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
      );
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    // signUp() alone doesn't reliably reject an already-registered email
    // when "Confirm email" is disabled — it can silently log the caller
    // into the existing account instead of erroring. Check first, via a
    // server-only route that uses the service-role admin API.
    let emailCheckResponse: Response;
    try {
      emailCheckResponse = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
      setError("Unable to verify email right now. Please try again.");
      setIsSubmitting(false);
      return;
    }

    if (!emailCheckResponse.ok) {
      setError("Unable to verify email right now. Please try again.");
      setIsSubmitting(false);
      return;
    }

    const emailCheck = (await emailCheckResponse.json()) as {
      exists?: boolean;
    };

    if (emailCheck.exists) {
      setError(ALREADY_REGISTERED_MESSAGE);
      setIsSubmitting(false);
      return;
    }

    const supabase = createClient();

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      setError(getAuthErrorMessage(signUpError));
      setIsSubmitting(false);
      return;
    }

    const user = data.user;
    if (!user) {
      setError("Something went wrong creating your account. Please try again.");
      setIsSubmitting(false);
      return;
    }

    // Defense in depth: even with the pre-check above, a race (or any
    // other edge case) could still result in signUp() handing back a
    // session for an account that already existed. A brand-new identity
    // has exactly one entry in `identities` and a `created_at` of "now";
    // anything else is treated as ambiguous and rejected rather than
    // silently left logged in.
    const identities = user.identities ?? [];
    const accountAgeMs = Date.now() - new Date(user.created_at).getTime();
    const looksLikeExistingAccount =
      identities.length === 0 || accountAgeMs > MAX_NEW_ACCOUNT_AGE_MS;

    if (looksLikeExistingAccount) {
      if (data.session) {
        await supabase.auth.signOut();
      }
      setError(ALREADY_REGISTERED_MESSAGE);
      setIsSubmitting(false);
      return;
    }

    // Email confirmation is disabled (see SETUP.md), so signUp should
    // already return an active session. Sign in explicitly as a fallback
    // rather than leaving the user on a dead end if it didn't.
    if (!data.session) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(getAuthErrorMessage(signInError));
        setIsSubmitting(false);
        return;
      }
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          disabled={isSubmitting}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={MIN_PASSWORD_LENGTH}
          disabled={isSubmitting}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
          minLength={MIN_PASSWORD_LENGTH}
          disabled={isSubmitting}
        />
      </div>

      <Button type="submit" disabled={isSubmitting} className="mt-2">
        {isSubmitting ? "Creating account..." : "Create account"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-foreground underline underline-offset-4"
        >
          Log in
        </Link>
      </p>
    </form>
  );
}
