import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/app/components/ui/Button";
import type { CourseSection } from "@/src/lib/profile.types";

type PageShellIdentity = {
  username: string;
  section: CourseSection;
};

type PageShellProps = {
  children: ReactNode;
  identity?: PageShellIdentity;
  onLogout?: () => void;
  isLoggingOut?: boolean;
  logoutError?: string | null;
  saveStatusLabel?: string | null;
  showInstructorLink?: boolean;
};

export function PageShell({
  children,
  identity,
  onLogout,
  isLoggingOut = false,
  logoutError = null,
  saveStatusLabel = null,
  showInstructorLink = false,
}: PageShellProps) {
  return (
    <div className="min-h-full bg-background">
      <header className="border-b border-border bg-surface/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-brand-100 text-brand-700"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.5 12.75l6 6 9-13.5"
                />
              </svg>
            </div>
            <div className="min-w-0 text-left">
              <p className="text-lg font-semibold tracking-tight text-text-primary">
                MyoMaster
              </p>
              <p className="text-sm text-text-muted">
                Kinesiology study platform
              </p>
            </div>
          </div>

          {identity ? (
            <div className="flex shrink-0 flex-col items-end gap-2 text-right">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text-primary">
                  {identity.username}
                </p>
                <p className="truncate text-xs text-text-muted">
                  {identity.section}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                {showInstructorLink ? (
                  <Link
                    href="/instructor"
                    className="text-xs font-medium text-brand-700 underline-offset-2 hover:underline"
                  >
                    Instructor Dashboard
                  </Link>
                ) : null}
                {saveStatusLabel ? (
                  <p
                    aria-live="polite"
                    className="text-xs text-text-muted"
                  >
                    {saveStatusLabel}
                  </p>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  className="px-3 py-1.5 text-xs"
                  onClick={onLogout}
                  disabled={isLoggingOut}
                >
                  {isLoggingOut ? "Logging Out..." : "Logout"}
                </Button>
                {logoutError ? (
                  <p
                    aria-live="polite"
                    className="max-w-40 text-xs text-error-text"
                  >
                    {logoutError}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 pb-10 pt-6 sm:pb-12 sm:pt-8">
        {children}
      </main>
    </div>
  );
}
