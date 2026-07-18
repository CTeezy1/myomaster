import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "correct" | "partial" | "incorrect";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  fullWidth?: boolean;
};

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-700 text-white shadow-[var(--shadow-sm)] hover:bg-brand-800 hover:shadow-[var(--shadow-md)] active:scale-[0.98] active:shadow-[var(--shadow-sm)]",
  secondary:
    "border border-border-strong bg-surface text-text-secondary shadow-[var(--shadow-sm)] hover:bg-surface-muted hover:shadow-[var(--shadow-md)] active:scale-[0.98]",
  correct:
    "border border-success-border bg-success-bg text-success-text shadow-[var(--shadow-sm)] hover:-translate-y-px hover:shadow-[var(--shadow-md)] active:scale-[0.98] active:translate-y-0",
  partial:
    "border border-warning-border bg-warning-bg text-warning-text shadow-[var(--shadow-sm)] hover:-translate-y-px hover:shadow-[var(--shadow-md)] active:scale-[0.98] active:translate-y-0",
  incorrect:
    "border border-error-border bg-error-bg text-error-text shadow-[var(--shadow-sm)] hover:-translate-y-px hover:shadow-[var(--shadow-md)] active:scale-[0.98] active:translate-y-0",
};

export function Button({
  variant = "primary",
  fullWidth = false,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-[var(--radius)] px-5 py-3 text-sm font-medium",
        "transition-[color,background-color,box-shadow,transform] duration-[var(--duration-normal)] ease-[var(--ease-standard)]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
        "disabled:pointer-events-none disabled:opacity-50",
        variantStyles[variant],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    />
  );
}
