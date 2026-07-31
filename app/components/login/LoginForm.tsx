"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";
import { cn } from "@/lib/cn";
import {
  LOGIN_INVALID_CREDENTIALS_MESSAGE,
  signInLearner,
} from "@/src/lib/auth/login-client";
import { useRedirectAuthenticatedLearner } from "@/src/hooks/useRedirectAuthenticatedLearner";
import { createBrowserSupabaseClient } from "@/src/lib/supabase/browser";

export function LoginForm() {
  const router = useRouter();
  const { isCheckingSession } = useRedirectAuthenticatedLearner();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  function handleUsernameChange(value: string) {
    setUsername(value);
    setErrorMessage(null);
  }

  function handlePasswordChange(value: string) {
    setPassword(value);
    setErrorMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      isSubmittingRef.current ||
      isSubmitting ||
      !username.trim() ||
      !password
    ) {
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);

    const result = await signInLearner(
      username,
      password,
      createBrowserSupabaseClient(),
    );

    isSubmittingRef.current = false;
    setIsSubmitting(false);

    if (!result.ok) {
      setErrorMessage(result.message);
      return;
    }

    router.replace("/");
  }

  if (isCheckingSession) {
    return (
      <div className="w-full space-y-5">
        <section className="space-y-1.5 text-center">
          <p className="text-sm font-medium uppercase tracking-wider text-brand-700">
            MyoMaster
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
            Login
          </h1>
        </section>

        <Card variant="featured" className="py-10 text-center">
          <p
            aria-live="polite"
            className="text-sm text-text-secondary"
          >
            Checking your session...
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full space-y-5">
      <section className="space-y-1.5 text-center">
        <p className="text-sm font-medium uppercase tracking-wider text-brand-700">
          MyoMaster
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
          Login
        </h1>
      </section>

      <Card variant="featured" className="space-y-5">
        <div
          aria-live="polite"
          aria-atomic="true"
          className="min-h-5 text-sm text-error-text"
        >
          {errorMessage}
        </div>

        <form
          className="space-y-5"
          onSubmit={handleSubmit}
        >
          <div className="space-y-2">
            <label
              htmlFor="login-username"
              className="block text-sm font-medium text-text-primary"
            >
              Username
            </label>
            <input
              id="login-username"
              name="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => handleUsernameChange(event.target.value)}
              disabled={isSubmitting}
              className={cn(
                "w-full rounded-[var(--radius)] border border-border-strong bg-surface px-4 py-3 text-base text-text-primary",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
                "disabled:cursor-not-allowed disabled:opacity-60",
              )}
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="login-password"
              className="block text-sm font-medium text-text-primary"
            >
              Password
            </label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => handlePasswordChange(event.target.value)}
              disabled={isSubmitting}
              className={cn(
                "w-full rounded-[var(--radius)] border border-border-strong bg-surface px-4 py-3 text-base text-text-primary",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
                "disabled:cursor-not-allowed disabled:opacity-60",
              )}
            />
          </div>

          <Button
            type="submit"
            fullWidth
            disabled={
              isSubmitting || username.trim().length === 0 || password.length === 0
            }
          >
            {isSubmitting ? "Signing In..." : "Login"}
          </Button>
        </form>

        <p className="text-center text-sm text-text-secondary">
          <Link
            href="/join"
            className="font-medium text-brand-700 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            Join with new account
          </Link>
        </p>
      </Card>
    </div>
  );
}
