import Link from "next/link";
import { Card } from "@/app/components/ui/Card";
import {
  getLibraryRegionMuscleCount,
  getLibraryRegions,
} from "@/src/data/library-regions";

export function MuscleLibraryOverview() {
  const regions = getLibraryRegions();

  return (
    <div className="w-full space-y-8">
      <header className="space-y-2 text-center sm:text-left">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">
          Browse
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
          Muscle Library
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-text-secondary sm:text-base">
          Explore anatomy facts and memory tools for each muscle at your own
          pace, outside of a guided study session.
        </p>
      </header>

      <div className="grid gap-4">
        {regions.map((region) => {
          const muscleCount = getLibraryRegionMuscleCount(region.id);

          return (
            <Link key={region.id} href={`/library/${region.id}`}>
              <Card className="transition-colors hover:border-brand-200 hover:bg-surface-muted/40">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-left">
                    <h2 className="text-xl font-semibold text-text-primary">
                      {region.name}
                    </h2>
                    <p className="mt-1 text-sm text-text-secondary">
                      {muscleCount} {muscleCount === 1 ? "muscle" : "muscles"}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-brand-700">
                    View muscles →
                  </span>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      <Link
        href="/"
        className="inline-flex w-full items-center justify-center rounded-[var(--radius)] border border-border-strong bg-surface px-5 py-3 text-sm font-medium text-text-secondary shadow-[var(--shadow-sm)] transition-[color,background-color,box-shadow,transform] duration-[var(--duration-normal)] ease-[var(--ease-standard)] hover:bg-surface-muted hover:shadow-[var(--shadow-md)]"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
