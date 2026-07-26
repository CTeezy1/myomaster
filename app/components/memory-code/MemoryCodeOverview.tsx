import Link from "next/link";
import { Card } from "@/app/components/ui/Card";
import {
  memoryCodeChapters,
  type MemoryCodeSection,
} from "@/app/components/memory-code/memory-code-content";

function MemoryCodeList({ items }: { items: { text: string }[] }) {
  return (
    <ul className="mt-3 space-y-2 text-sm leading-relaxed text-text-primary sm:text-base">
      {items.map((item) => (
        <li key={item.text} className="flex gap-2">
          <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
          <span>{item.text}</span>
        </li>
      ))}
    </ul>
  );
}

function MemoryCodeSectionBlock({ section }: { section: MemoryCodeSection }) {
  if (section.type === "nerve-colors") {
    return (
      <section aria-labelledby={`${section.id}-heading`}>
        <h3
          id={`${section.id}-heading`}
          className="text-lg font-semibold tracking-tight text-text-primary"
        >
          {section.heading}
        </h3>
        <ul className="mt-3 space-y-2.5">
          {section.colors.map((entry) => (
            <li
              key={entry.nerve}
              className="flex items-center gap-3 text-sm leading-relaxed text-text-primary sm:text-base"
            >
              <span
                aria-hidden="true"
                className={`h-4 w-4 shrink-0 rounded-full border border-border ${entry.swatchClass}`}
              />
              <span>
                <span className="font-medium">{entry.color}</span>
                {" — "}
                {entry.nerve}
              </span>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (section.type === "figure-movement") {
    return (
      <section aria-labelledby={`${section.id}-heading`}>
        <h3
          id={`${section.id}-heading`}
          className="text-lg font-semibold tracking-tight text-text-primary"
        >
          {section.heading}
        </h3>
        <div className="mt-3 space-y-4">
          {section.groups.map((group) => (
            <div key={group.title}>
              <p className="text-sm font-medium text-brand-700 sm:text-base">
                {group.title}
              </p>
              <MemoryCodeList items={group.items} />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby={`${section.id}-heading`}>
      <h3
        id={`${section.id}-heading`}
        className="text-lg font-semibold tracking-tight text-text-primary"
      >
        {section.heading}
      </h3>
      <div className="mt-3 space-y-5">
        {section.regions.map((region) => (
          <div key={region.name}>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-brand-700">
              {region.name}
            </h4>
            <MemoryCodeList items={region.items} />
          </div>
        ))}
      </div>
    </section>
  );
}

export function MemoryCodeOverview() {
  return (
    <div className="w-full space-y-8">
      <header className="space-y-2 text-center sm:text-left">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">
          Reference
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
          Memory Code
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-text-secondary sm:text-base">
          Understanding the visual language used throughout MyoMaster&apos;s memory
          images.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start">
        <div className="space-y-6">
          {memoryCodeChapters.map((chapter) => (
            <Card key={chapter.id} className="space-y-6 p-5 sm:p-6">
              <h2 className="border-b border-border pb-3 text-xl font-semibold tracking-tight text-text-primary">
                {chapter.title}
              </h2>
              <div className="space-y-7">
                {chapter.sections.map((section) => (
                  <MemoryCodeSectionBlock key={section.id} section={section} />
                ))}
              </div>
            </Card>
          ))}
        </div>

        <aside aria-label="Additional memory codes">
          <Card className="p-5 sm:p-6">
            <h2 className="text-lg font-semibold tracking-tight text-text-primary">
              More Memory Codes
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-text-muted sm:text-base">
              (Coming Soon)
            </p>
          </Card>
        </aside>
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
