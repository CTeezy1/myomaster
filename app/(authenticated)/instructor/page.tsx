import { notFound } from "next/navigation";
import { InstructorDashboard } from "@/app/components/instructor/InstructorDashboard";
import { isInstructorUserId } from "@/src/lib/auth/instructor-allowlist";
import { DEFAULT_INSTRUCTOR_SECTION } from "@/src/lib/instructor/instructor-student";
import { loadInstructorRoster } from "@/src/lib/instructor/load-instructor-roster";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";

type InstructorPageProps = {
  searchParams?: Promise<{ section?: string | string[] }> | { section?: string | string[] };
};

async function readSearchParams(
  searchParams: InstructorPageProps["searchParams"],
): Promise<{ section?: string | string[] }> {
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
  });

  if (!result.ok) {
    if (result.kind === "unauthorized") {
      notFound();
    }

    if (result.kind === "invalid_section") {
      return (
        <InstructorDashboard
          section={DEFAULT_INSTRUCTOR_SECTION}
          students={[]}
          error="Invalid section."
        />
      );
    }

    return (
        <InstructorDashboard
          section={DEFAULT_INSTRUCTOR_SECTION}
          students={[]}
          error="Unable to load this section right now."
        />
    );
  }

  return (
    <InstructorDashboard
      section={result.roster.section}
      students={result.roster.students}
    />
  );
}
