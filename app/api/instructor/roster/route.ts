import { NextResponse } from "next/server";
import { loadInstructorRoster } from "@/src/lib/instructor/load-instructor-roster";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const section = new URL(request.url).searchParams.get("section");
  const result = await loadInstructorRoster({
    userId: user?.id ?? null,
    section,
  });

  if (!result.ok) {
    if (result.kind === "unauthorized") {
      return NextResponse.json({ error: "Not found." }, { status: 403 });
    }

    if (result.kind === "invalid_section") {
      return NextResponse.json({ error: "Invalid section." }, { status: 400 });
    }

    return NextResponse.json({ error: "Unable to load roster." }, { status: 500 });
  }

  return NextResponse.json(result.roster);
}
