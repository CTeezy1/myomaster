import { LibraryMuscleBriefView } from "@/app/components/library/LibraryMuscleBriefView";
import { LibraryNotFound } from "@/app/components/library/LibraryNotFound";
import { getMuscleProfileById } from "@/src/data/muscle-profiles";
import { getLibraryRegion } from "@/src/data/library-regions";

type LibraryMuscleBriefPageProps = {
  params: Promise<{ region: string; muscleId: string }>;
};

export default async function LibraryMuscleBriefPage({
  params,
}: LibraryMuscleBriefPageProps) {
  const { region: regionId, muscleId } = await params;
  const region = getLibraryRegion(regionId);
  const profile = getMuscleProfileById(muscleId);

  if (!region) {
    return (
      <LibraryNotFound
        title="Region not found"
        message="That library region is not available yet."
        backHref="/library"
        backLabel="Back to Muscle Library"
      />
    );
  }

  if (!profile || profile.region.toLowerCase() !== region.id) {
    return (
      <LibraryNotFound
        title="Muscle not found"
        message="That muscle brief is not available in this region."
        backHref={`/library/${region.id}`}
        backLabel={`Back to ${region.name} Library`}
      />
    );
  }

  return (
    <LibraryMuscleBriefView
      profile={profile}
      regionId={region.id}
      regionName={region.name}
    />
  );
}
