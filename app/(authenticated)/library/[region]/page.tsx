import { LibraryNotFound } from "@/app/components/library/LibraryNotFound";
import { RegionMuscleList } from "@/app/components/library/RegionMuscleList";
import { getLibraryRegion } from "@/src/data/library-regions";

type RegionLibraryPageProps = {
  params: Promise<{ region: string }>;
};

export default async function RegionLibraryPage({
  params,
}: RegionLibraryPageProps) {
  const { region: regionId } = await params;
  const region = getLibraryRegion(regionId);

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

  return <RegionMuscleList region={region} />;
}
