import Link from "next/link";
import { Card } from "@/app/components/ui/Card";

type LibraryNotFoundProps = {
  title: string;
  message: string;
  backHref: string;
  backLabel: string;
};

export function LibraryNotFound({
  title,
  message,
  backHref,
  backLabel,
}: LibraryNotFoundProps) {
  return (
    <div className="w-full">
      <Card className="space-y-4 text-center sm:text-left">
        <h1 className="text-xl font-semibold text-text-primary">{title}</h1>
        <p className="text-sm text-text-secondary">{message}</p>
        <Link
          href={backHref}
          className="inline-flex w-full items-center justify-center rounded-[var(--radius)] border border-border-strong bg-surface px-5 py-3 text-sm font-medium text-text-secondary shadow-[var(--shadow-sm)] transition-[color,background-color,box-shadow,transform] duration-[var(--duration-normal)] ease-[var(--ease-standard)] hover:bg-surface-muted hover:shadow-[var(--shadow-md)]"
        >
          {backLabel}
        </Link>
      </Card>
    </div>
  );
}
