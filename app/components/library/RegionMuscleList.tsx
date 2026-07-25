import Link from "next/link";
import { Card } from "@/app/components/ui/Card";
import { getMuscleProfilesByRegion } from "@/src/data/muscle-profiles";
import type { LibraryRegion } from "@/src/data/library-regions";

type RegionMuscleListProps = {
  region: LibraryRegion;
};

export function RegionMuscleList({ region }: RegionMuscleListProps) {
  const muscles = getMuscleProfilesByRegion(region.id);

  return (
    <div className="w-full space-y-8">
      <header className="space-y-2 text-center sm:text-left">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">
          {region.name} Region
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
          {region.name} Muscles
        </h1>
        <p className="text-sm leading-relaxed text-text-secondary sm:text-base">
          Select a muscle to review its brief, core facts, and memory tools.
        </p>
      </header>

      <div className="grid gap-3">
        {muscles.map((muscle) => (
          <Link key={muscle.id} href={`/library/${region.id}/${muscle.id}`}>
            <Card className="transition-colors hover:border-brand-200 hover:bg-surface-muted/40">
              <div className="flex items-start justify-between gap-4 text-left">
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">
                    {muscle.name}
                  </h2>
                  <p className="mt-1 text-sm italic text-text-secondary">
                    {muscle.description}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-medium text-brand-700">
                  Open brief →
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <Link
        href="/library"
        className="inline-flex w-full items-center justify-center rounded-[var(--radius)] border border-border-strong bg-surface px-5 py-3 text-sm font-medium text-text-secondary shadow-[var(--shadow-sm)] transition-[color,background-color,box-shadow,transform] duration-[var(--duration-normal)] ease-[var(--ease-standard)] hover:bg-surface-muted hover:shadow-[var(--shadow-md)]"
      >
        Back to Muscle Library
      </Link>
    </div>
  );
}
