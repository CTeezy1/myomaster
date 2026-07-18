import { cn } from "@/lib/cn";
import type { HTMLAttributes } from "react";

type CardVariant = "default" | "featured";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
};

const variantStyles: Record<CardVariant, string> = {
  default: "border-border shadow-[var(--shadow-md)]",
  featured:
    "border-brand-200 shadow-[var(--shadow-lg)] ring-1 ring-brand-100/80",
};

export function Card({
  variant = "default",
  className,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius)] border bg-surface p-[var(--card-padding)]",
        variantStyles[variant],
        className,
      )}
      {...props}
    />
  );
}
