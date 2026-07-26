"use client";

import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";
import { cn } from "@/lib/cn";
import type { MuscleProfile } from "@/src/data/muscle-profile.types";
import {
  getMuscleBriefPrimaryLabel,
  type MuscleBriefMode,
} from "@/src/lib/muscle-brief-mode";
import {
  Activity,
  ChevronDown,
  Flag,
  ImageIcon,
  MapPin,
  Zap,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useId, useState } from "react";

export type MuscleBriefProps = {
  profile: MuscleProfile;
  mode: MuscleBriefMode;
  libraryRegionName?: string;
  onPrimaryAction: () => void;
};

type FactLabel = "Origin" | "Insertion" | "Action" | "Innervation";
type ImagePanelVariant = "anatomy" | "memory";

const FACT_ICON_SIZE = 18;
const factIconClass = "shrink-0 text-brand-700";

const imageClass =
  "object-contain object-center p-1 transition-opacity duration-[var(--duration-normal)] ease-[var(--ease-standard)] sm:p-2";

const atlasSpreadClass =
  "mx-auto box-border w-[min(85vw,90rem)] max-w-[90rem] px-4 sm:px-6 lg:px-8";

function getImageFrameClass(variant: ImagePanelVariant) {
  return cn(
    "relative w-full shrink-0 overflow-hidden rounded-[var(--radius)] border border-border bg-surface-muted shadow-[var(--shadow-sm)]",
    "min-h-[240px] aspect-[4/3] sm:min-h-[280px]",
    variant === "memory"
      ? "md:min-h-[360px] lg:aspect-auto lg:min-h-[min(52vh,720px)]"
      : "md:min-h-[320px] lg:aspect-auto lg:min-h-[min(42vh,560px)]",
  );
}

function FactValue({ value }: { value: string | string[] }) {
  if (Array.isArray(value)) {
    return (
      <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-text-primary sm:text-base">
        {value.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }

  return (
    <p className="mt-2 text-sm leading-relaxed text-text-primary sm:text-base">
      {value}
    </p>
  );
}

function FactIcon({ label }: { label: FactLabel }) {
  switch (label) {
    case "Origin":
      return (
        <MapPin
          aria-hidden="true"
          size={FACT_ICON_SIZE}
          className={factIconClass}
          strokeWidth={2}
        />
      );
    case "Insertion":
      return (
        <Flag
          aria-hidden="true"
          size={FACT_ICON_SIZE}
          className={factIconClass}
          strokeWidth={2}
        />
      );
    case "Action":
      return (
        <Activity
          aria-hidden="true"
          size={FACT_ICON_SIZE}
          className={factIconClass}
          strokeWidth={2}
        />
      );
    case "Innervation":
      return (
        <Zap
          aria-hidden="true"
          size={FACT_ICON_SIZE}
          className={factIconClass}
          strokeWidth={2}
        />
      );
  }
}

function IllustrationPlaceholder() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-surface to-surface-muted px-4 py-8 text-center sm:px-6 sm:py-10"
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[var(--radius)] bg-brand-100 text-brand-700 shadow-[var(--shadow-sm)]">
        <ImageIcon size={28} strokeWidth={1.75} aria-hidden="true" />
      </div>
      <p className="text-sm font-medium text-text-secondary">
        Illustration coming soon
      </p>
    </div>
  );
}

function BriefImagePanel({
  title,
  src,
  alt,
  variant,
}: {
  title: string;
  src: string;
  alt: string;
  variant: ImagePanelVariant;
}) {
  const [imageState, setImageState] = useState<"loading" | "loaded" | "error">(
    "loading",
  );

  useEffect(() => {
    setImageState("loading");
  }, [src]);

  const showPlaceholder = imageState === "loading" || imageState === "error";

  return (
    <Card className="flex h-full flex-col p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
        {title}
      </p>
      <div
        className={cn(getImageFrameClass(variant), "mt-3 sm:mt-4")}
        aria-busy={imageState === "loading"}
        aria-label={imageState === "error" ? `${title} unavailable` : undefined}
      >
        {showPlaceholder && <IllustrationPlaceholder />}

        {imageState !== "error" && (
          <Image
            src={src}
            alt={alt}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 45vw, 720px"
            className={cn(
              imageClass,
              imageState === "loaded" ? "opacity-100" : "opacity-0",
            )}
            onLoad={() => setImageState("loaded")}
            onError={() => setImageState("error")}
          />
        )}
      </div>
    </Card>
  );
}

function CoreFactsPanel({ profile }: { profile: MuscleProfile }) {
  const facts: { label: FactLabel; value: string | string[] }[] = [
    { label: "Origin", value: profile.coreFacts.origin },
    { label: "Insertion", value: profile.coreFacts.insertion },
    { label: "Action", value: profile.coreFacts.action },
    { label: "Innervation", value: profile.coreFacts.innervation },
  ];

  return (
    <Card className="h-full p-4 sm:p-5 lg:p-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
        Core Facts
      </p>
      <dl className="mt-5 space-y-6 lg:space-y-7">
        {facts.map(({ label, value }) => (
          <div key={label}>
            <dt className="flex items-center gap-2.5 text-sm font-medium text-brand-700 sm:text-base">
              <FactIcon label={label} />
              <span>{label}</span>
            </dt>
            <dd className="pl-[calc(18px+0.625rem)]">
              <FactValue value={value} />
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function WhyMemoryWorksSection({
  content,
}: {
  content: string | string[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="mt-6 border-t border-border pt-5">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full items-center justify-between gap-3 text-left text-sm font-medium text-text-secondary transition-colors hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 sm:text-base"
      >
        <span>Why this memory works</span>
        <ChevronDown
          aria-hidden="true"
          size={16}
          className={cn(
            "shrink-0 text-text-muted transition-transform duration-[var(--duration-normal)] ease-[var(--ease-standard)]",
            isOpen && "rotate-180",
          )}
        />
      </button>

      <div
        id={panelId}
        className={cn(
          "grid transition-[grid-template-rows] duration-[var(--duration-normal)] ease-[var(--ease-standard)]",
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="pt-4">
            <FactValue value={content} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function MuscleBrief({
  profile,
  mode,
  libraryRegionName,
  onPrimaryAction,
}: MuscleBriefProps) {
  const primaryActionLabel = getMuscleBriefPrimaryLabel(
    mode,
    libraryRegionName,
  );

  return (
    <div className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 overflow-x-hidden">
      <div
        className={cn(atlasSpreadClass, "space-y-8 sm:space-y-10 lg:space-y-12")}
      >
        <header className="space-y-2 text-center sm:text-left">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">
            Muscle Brief
          </p>
          <p className="text-sm font-medium text-text-muted sm:text-base">
            Muscle {profile.order}
          </p>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-text-primary sm:text-4xl lg:text-5xl">
            {profile.name}
          </h1>
          <p className="text-base italic leading-relaxed text-text-secondary sm:text-lg">
            {profile.description}
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 lg:gap-10">
          <BriefImagePanel
            title="Anatomy"
            src={profile.images.anatomy}
            alt={`${profile.name} anatomy illustration`}
            variant="anatomy"
          />
          <CoreFactsPanel profile={profile} />
          <BriefImagePanel
            title="Memory Illustration"
            src={profile.images.memory}
            alt={`${profile.name} memory illustration`}
            variant="memory"
          />
          <Card className="flex h-full flex-col p-4 sm:p-5 lg:p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Memory Story
            </p>
            <p className="mt-4 flex-1 text-sm leading-relaxed text-text-primary sm:text-base lg:text-lg">
              {profile.memoryStory}
            </p>
            <WhyMemoryWorksSection content={profile.whyMemoryWorks} />
          </Card>
        </div>

        <div className="pt-2">
          <Button fullWidth type="button" onClick={onPrimaryAction}>
            {primaryActionLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
