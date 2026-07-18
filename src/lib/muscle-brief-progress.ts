const STORAGE_KEY = "myomaster-muscle-brief-viewed";

function readViewedIds(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];

    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

function writeViewedIds(ids: string[]) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export function getViewedMuscleBriefIds(): string[] {
  return readViewedIds();
}

export function hasViewedMuscleBrief(profileId: string): boolean {
  return readViewedIds().includes(profileId);
}

export function markMuscleBriefViewed(profileId: string) {
  const viewedIds = readViewedIds();

  if (viewedIds.includes(profileId)) return;

  writeViewedIds([...viewedIds, profileId]);
}

export function clearMuscleBriefProgress() {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(STORAGE_KEY);
}
