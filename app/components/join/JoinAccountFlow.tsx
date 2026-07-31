"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";
import { cn } from "@/lib/cn";
import { useRedirectAuthenticatedLearner } from "@/src/hooks/useRedirectAuthenticatedLearner";
import { submitJoinAccountRequest } from "@/src/lib/auth/join-client";
import type { JoinAccountSuccessResponse } from "@/src/lib/auth/join.types";
import { COURSE_SECTIONS, type CourseSection } from "@/src/lib/profile.types";

type JoinStep = "section" | "password" | "credentials";

export function JoinAccountFlow() {
  const router = useRouter();
  const { isCheckingSession } = useRedirectAuthenticatedLearner();
  const [step, setStep] = useState<JoinStep>("section");
  const [selectedSection, setSelectedSection] = useState<CourseSection | null>(
    null,
  );
  const [sectionPassword, setSectionPassword] = useState("");
  const [credentials, setCredentials] =
    useState<JoinAccountSuccessResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [hasConfirmedCredentialsWritten, setHasConfirmedCredentialsWritten] =
    useState(false);
  const hasCreatedAccountRef = useRef(false);

  function handleContinueToPassword() {
    if (!selectedSection) {
      return;
    }

    setFeedbackMessage(null);
    setStep("password");
  }

  function handleBackToSectionSelection() {
    setStep("section");
    setSectionPassword("");
    setFeedbackMessage(null);
  }

  async function handleCreateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !selectedSection ||
      isSubmitting ||
      hasCreatedAccountRef.current ||
      step === "credentials"
    ) {
      return;
    }

    setIsSubmitting(true);
    setFeedbackMessage(null);

    const result = await submitJoinAccountRequest(
      selectedSection,
      sectionPassword,
    );

    setIsSubmitting(false);

    if (!result.ok) {
      setFeedbackMessage(result.message);
      return;
    }

    hasCreatedAccountRef.current = true;
    setCredentials(result.credentials);
    setSectionPassword("");
    setStep("credentials");
  }

  async function handleCopyValue(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setFeedbackMessage(`${label} copied to clipboard.`);
    } catch {
      setFeedbackMessage(`Unable to copy ${label.toLowerCase()}.`);
    }
  }

  if (isCheckingSession) {
    return (
      <div className="w-full space-y-5">
        <section className="space-y-1.5 text-center">
          <p className="text-sm font-medium uppercase tracking-wider text-brand-700">
            Join MyoMaster
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
            Join
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

  if (step === "credentials" && credentials) {
    return (
      <div className="w-full space-y-5">
        <section className="space-y-1.5 text-center">
          <p className="text-sm font-medium uppercase tracking-wider text-brand-700">
            Join MyoMaster
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
            Your Account Is Ready
          </h1>
        </section>

        <Card variant="featured" className="space-y-5">
          <div
            aria-live="polite"
            className="space-y-4"
          >
            <CredentialField
              label="Username"
              value={credentials.username}
              onCopy={() => handleCopyValue(credentials.username, "Username")}
            />
            <CredentialField
              label="Password"
              value={credentials.password}
              onCopy={() => handleCopyValue(credentials.password, "Password")}
            />
            <div className="rounded-[var(--radius)] border border-border bg-surface-muted px-4 py-3.5">
              <p className="text-sm text-text-muted">Section</p>
              <p className="mt-1 text-base font-medium text-text-primary">
                {credentials.section}
              </p>
            </div>
          </div>

          <p className="rounded-[var(--radius)] border border-warning-border bg-warning-bg px-4 py-3 text-sm font-medium leading-relaxed text-warning-text">
            Write down your username and password now. You will need both to
            sign in again. MyoMaster cannot recover your password automatically.
          </p>

          {feedbackMessage ? (
            <p
              aria-live="polite"
              className="text-sm text-text-secondary"
            >
              {feedbackMessage}
            </p>
          ) : null}

          <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius)] border border-border bg-surface-muted px-4 py-3.5">
            <input
              type="checkbox"
              checked={hasConfirmedCredentialsWritten}
              onChange={(event) =>
                setHasConfirmedCredentialsWritten(event.target.checked)
              }
              className="mt-0.5 h-4 w-4 accent-[var(--brand-700)]"
            />
            <span className="text-sm text-text-primary">
              I have written down my username and password.
            </span>
          </label>

          <Button
            fullWidth
            variant="secondary"
            disabled={!hasConfirmedCredentialsWritten}
            onClick={() => router.push("/login")}
          >
            Back to Login
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full space-y-5">
      <section className="space-y-1.5 text-center">
        <p className="text-sm font-medium uppercase tracking-wider text-brand-700">
          Join MyoMaster
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
          {step === "section" ? "Choose Section" : "Confirm Section"}
        </h1>
      </section>

      <Card variant="featured" className="space-y-5">
        <div
          aria-live="polite"
          aria-atomic="true"
          className="min-h-5 text-sm text-error-text"
        >
          {feedbackMessage}
        </div>

        {step === "section" ? (
          <fieldset className="space-y-4">
            <legend className="sr-only">Choose Section</legend>
            <div className="space-y-3">
              {COURSE_SECTIONS.map((section) => {
                const isSelected = selectedSection === section;

                return (
                  <label
                    key={section}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-[var(--radius)] border px-4 py-3.5 transition-colors",
                      "focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-600",
                      isSelected
                        ? "border-brand-600 bg-brand-50"
                        : "border-border bg-surface-muted hover:bg-surface",
                    )}
                  >
                    <input
                      type="radio"
                      name="course-section"
                      value={section}
                      checked={isSelected}
                      onChange={() => setSelectedSection(section)}
                      className="h-4 w-4 accent-[var(--brand-700)]"
                    />
                    <span className="text-base font-medium text-text-primary">
                      {section}
                    </span>
                  </label>
                );
              })}
            </div>

            {selectedSection ? (
              <p className="text-sm text-text-secondary">
                Selected section:{" "}
                <span className="font-medium text-text-primary">
                  {selectedSection}
                </span>
              </p>
            ) : (
              <p className="text-sm text-text-muted">
                Select one section to continue.
              </p>
            )}

            <Button
              fullWidth
              disabled={!selectedSection}
              onClick={handleContinueToPassword}
            >
              Continue
            </Button>
          </fieldset>
        ) : (
          <form
            className="space-y-5"
            onSubmit={handleCreateAccount}
          >
            <p className="text-sm text-text-secondary">
              Section:{" "}
              <span className="font-medium text-text-primary">
                {selectedSection}
              </span>
            </p>

            <div className="space-y-2">
              <label
                htmlFor="section-confirmation-password"
                className="block text-sm font-medium text-text-primary"
              >
                Section Confirmation Password
              </label>
              <input
                id="section-confirmation-password"
                name="sectionConfirmationPassword"
                type="password"
                autoComplete="off"
                value={sectionPassword}
                onChange={(event) => setSectionPassword(event.target.value)}
                disabled={isSubmitting}
                className={cn(
                  "w-full rounded-[var(--radius)] border border-border-strong bg-surface px-4 py-3 text-base text-text-primary",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                )}
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                variant="secondary"
                fullWidth
                disabled={isSubmitting}
                onClick={handleBackToSectionSelection}
              >
                Back
              </Button>
              <Button
                type="submit"
                fullWidth
                disabled={isSubmitting || sectionPassword.length === 0}
              >
                {isSubmitting ? "Creating Account..." : "Create Account"}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}

function CredentialField({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-border bg-surface-muted px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-text-muted">{label}</p>
          <p className="mt-1 text-base font-medium text-text-primary">{value}</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="shrink-0 px-3 py-2 text-xs"
          onClick={onCopy}
        >
          Copy
        </Button>
      </div>
    </div>
  );
}
