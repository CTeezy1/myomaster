"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";
import { PageShell } from "@/app/components/ui/PageShell";
import { signOutLearner } from "@/src/lib/auth/logout-client";
import { useCurrentLearner } from "@/src/hooks/useCurrentLearner";
import {
  LearnerProgressProvider,
  useLearnerProgress,
} from "@/src/lib/progress/LearnerProgressProvider";
import {
  LOGOUT_UNSAVED_WARNING,
  PROGRESS_CONFLICT_MESSAGE,
  PROGRESS_LOAD_ERROR_MESSAGE,
} from "@/src/lib/progress/learner-progress.types";
import type { CourseSection } from "@/src/lib/profile.types";
import { createBrowserSupabaseClient } from "@/src/lib/supabase/browser";

type AuthenticatedPageShellProps = {
  children: ReactNode;
  showInstructorLink?: boolean;
};

export function AuthenticatedPageShell({
  children,
  showInstructorLink = false,
}: AuthenticatedPageShellProps) {
  const learnerState = useCurrentLearner();

  if (learnerState.status === "loading") {
    return (
      <PageShell>
        <Card variant="featured" className="py-10 text-center">
          <p
            aria-live="polite"
            className="text-sm text-text-secondary"
          >
            Loading your account...
          </p>
        </Card>
      </PageShell>
    );
  }

  if (learnerState.status === "missing_profile") {
    return <MissingProfileShell message={learnerState.message} />;
  }

  if (learnerState.status === "error") {
    return (
      <PageShell>
        <Card variant="featured" className="space-y-4 py-8 text-center">
          <p
            aria-live="polite"
            className="text-sm text-text-secondary"
          >
            {learnerState.message}
          </p>
          <Button
            variant="secondary"
            onClick={learnerState.reload}
          >
            Try Again
          </Button>
        </Card>
      </PageShell>
    );
  }

  return (
    <LearnerProgressProvider profile={learnerState.profile}>
      <AuthenticatedProgressGate
        profile={learnerState.profile}
        showInstructorLink={showInstructorLink}
      >
        {children}
      </AuthenticatedProgressGate>
    </LearnerProgressProvider>
  );
}

function AuthenticatedProgressGate({
  profile,
  children,
  showInstructorLink,
}: {
  profile: { username: string; section: CourseSection };
  children: ReactNode;
  showInstructorLink: boolean;
}) {
  const {
    progressState,
    saveStatusLabel,
    reloadProgress,
    requestStartFresh,
    cancelStartFresh,
    confirmStartFreshOpen,
    startFreshProgress,
    flushProgressBeforeLogout,
  } = useLearnerProgress();
  const router = useRouter();
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutWarningOpen, setLogoutWarningOpen] = useState(false);
  const [startFreshError, setStartFreshError] = useState<string | null>(null);
  const [isStartingFresh, setIsStartingFresh] = useState(false);
  const isLoggingOutRef = useRef(false);

  async function completeLogout() {
    const result = await signOutLearner(createBrowserSupabaseClient());

    isLoggingOutRef.current = false;
    setIsLoggingOut(false);

    if (!result.ok) {
      setLogoutError(result.message);
      return;
    }

    router.replace("/login");
  }

  async function handleLogoutClick() {
    if (isLoggingOutRef.current || isLoggingOut) {
      return;
    }

    isLoggingOutRef.current = true;
    setIsLoggingOut(true);
    setLogoutError(null);

    const flushed = await flushProgressBeforeLogout();

    if (!flushed) {
      isLoggingOutRef.current = false;
      setIsLoggingOut(false);
      setLogoutWarningOpen(true);
      return;
    }

    await completeLogout();
  }

  async function handleLogoutAnyway() {
    setLogoutWarningOpen(false);
    isLoggingOutRef.current = true;
    setIsLoggingOut(true);
    await completeLogout();
  }

  async function handleRetryLogoutFlush() {
    setLogoutWarningOpen(false);
    await handleLogoutClick();
  }

  async function handleConfirmStartFresh() {
    setIsStartingFresh(true);
    setStartFreshError(null);
    const success = await startFreshProgress();
    setIsStartingFresh(false);

    if (!success) {
      setStartFreshError("Unable to reset your saved progress right now.");
    }
  }

  const identity = {
    username: profile.username,
    section: profile.section,
  };

  if (progressState.status === "loading") {
    return (
      <PageShell identity={identity} showInstructorLink={showInstructorLink}>
        <Card variant="featured" className="py-10 text-center">
          <p
            aria-live="polite"
            className="text-sm text-text-secondary"
          >
            Loading your progress...
          </p>
        </Card>
      </PageShell>
    );
  }

  if (progressState.status === "invalid") {
    return (
      <PageShell
        identity={identity}
        onLogout={handleLogoutClick}
        isLoggingOut={isLoggingOut}
        logoutError={logoutError}
        showInstructorLink={showInstructorLink}
      >
        <Card variant="featured" className="space-y-4 py-8 text-center">
          <p
            aria-live="polite"
            className="text-sm text-text-secondary"
          >
            {PROGRESS_LOAD_ERROR_MESSAGE}
          </p>
          {startFreshError ? (
            <p className="text-sm text-error-text">{startFreshError}</p>
          ) : null}
          <div className="flex flex-col gap-3">
            <Button variant="secondary" onClick={reloadProgress}>
              Try Again
            </Button>
            {!confirmStartFreshOpen ? (
              <Button variant="secondary" onClick={requestStartFresh}>
                Start Fresh
              </Button>
            ) : (
              <div className="space-y-3 rounded-[var(--radius)] border border-warning-border bg-warning-bg px-4 py-3">
                <p className="text-sm text-warning-text">
                  Starting fresh will replace your saved learner progress.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    variant="secondary"
                    fullWidth
                    disabled={isStartingFresh}
                    onClick={cancelStartFresh}
                  >
                    Cancel
                  </Button>
                  <Button
                    fullWidth
                    disabled={isStartingFresh}
                    onClick={handleConfirmStartFresh}
                  >
                    {isStartingFresh ? "Starting Fresh..." : "Confirm Start Fresh"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      </PageShell>
    );
  }

  if (progressState.status === "conflict") {
    return (
      <PageShell
        identity={identity}
        onLogout={handleLogoutClick}
        isLoggingOut={isLoggingOut}
        logoutError={logoutError}
        showInstructorLink={showInstructorLink}
      >
        <Card variant="featured" className="space-y-4 py-8 text-center">
          <p
            aria-live="polite"
            className="text-sm text-text-secondary"
          >
            {PROGRESS_CONFLICT_MESSAGE}
          </p>
          <Button variant="secondary" onClick={reloadProgress}>
            Reload
          </Button>
        </Card>
      </PageShell>
    );
  }

  return (
    <>
      <PageShell
        identity={identity}
        onLogout={handleLogoutClick}
        isLoggingOut={isLoggingOut}
        logoutError={logoutError}
        saveStatusLabel={saveStatusLabel}
        showInstructorLink={showInstructorLink}
      >
        {children}
      </PageShell>

      {logoutWarningOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <Card variant="featured" className="w-full max-w-md space-y-4">
            <p
              aria-live="polite"
              className="text-sm text-text-secondary"
            >
              {LOGOUT_UNSAVED_WARNING}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                variant="secondary"
                fullWidth
                onClick={handleRetryLogoutFlush}
              >
                Try Again
              </Button>
              <Button
                fullWidth
                onClick={handleLogoutAnyway}
              >
                Logout Anyway
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </>
  );
}

function MissingProfileShell({ message }: { message: string }) {
  const router = useRouter();
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const isLoggingOutRef = useRef(false);

  async function handleLogout() {
    if (isLoggingOutRef.current || isLoggingOut) {
      return;
    }

    isLoggingOutRef.current = true;
    setIsLoggingOut(true);
    setLogoutError(null);

    const result = await signOutLearner(createBrowserSupabaseClient());

    isLoggingOutRef.current = false;
    setIsLoggingOut(false);

    if (!result.ok) {
      setLogoutError(result.message);
      return;
    }

    router.replace("/login");
  }

  return (
    <PageShell>
      <Card variant="featured" className="space-y-4 py-8 text-center">
        <p
          aria-live="polite"
          className="text-sm text-text-secondary"
        >
          {message}
        </p>
        <div
          aria-live="polite"
          className="min-h-5 text-sm text-error-text"
        >
          {logoutError}
        </div>
        <Button
          variant="secondary"
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? "Logging Out..." : "Logout"}
        </Button>
      </Card>
    </PageShell>
  );
}
