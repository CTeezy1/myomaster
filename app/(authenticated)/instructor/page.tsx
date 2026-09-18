import { notFound } from "next/navigation";
import { InstructorDashboard } from "@/app/components/instructor/InstructorDashboard";
import { isInstructorUserId } from "@/src/lib/auth/instructor-allowlist";
import {
  CURRENT_INSTRUCTOR_WEEK,
  DEFAULT_INSTRUCTOR_SECTION,
} from "@/src/lib/instructor/instructor-student";
import { loadInstructorRoster } from "@/src/lib/instructor/load-instructor-roster";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";

type InstructorSearchParams = {
  section?: string | string[];
  week?: string | string[];
};

type InstructorPageProps = {
  searchParams?: Promise<InstructorSearchParams> | InstructorSearchParams;
};

async function readSearchParams(
  searchParams: InstructorPageProps["searchParams"],
): Promise<InstructorSearchParams> {
  if (!searchParams) {
    return {};
  }

  return await searchParams;
}

export default async function InstructorPage({ searchParams }: InstructorPageProps) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isInstructorUserId(user?.id)) {
    notFound();
  }

  const params = await readSearchParams(searchParams);
  const result = await loadInstructorRoster({
    userId: user?.id ?? null,
    section: params.section,
    week: params.week,
  });

  if (!result.ok) {
    if (result.kind === "unauthorized") {
      notFound();
    }

    const error =
      result.kind === "invalid_section"
        ? "Invalid section."
        : result.kind === "invalid_week"
          ? "Invalid participation week."
          : "Unable to load this section right now.";

    return (
      <InstructorDashboard
        section={DEFAULT_INSTRUCTOR_SECTION}
        selectedWeek={CURRENT_INSTRUCTOR_WEEK}
        availableWeeks={[]}
        students={[]}
        error={error}
      />
    );
  }

  return (
    <InstructorDashboard
      section={result.roster.section}
      selectedWeek={result.roster.selectedWeek}
      availableWeeks={result.roster.availableWeeks}
      students={result.roster.students}
    />
  );
}
