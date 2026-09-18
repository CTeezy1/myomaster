import { AuthenticatedPageShell } from "@/app/components/auth/AuthenticatedPageShell";
import { isInstructorUserId } from "@/src/lib/auth/instructor-allowlist";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <AuthenticatedPageShell showInstructorLink={isInstructorUserId(user?.id)}>
      {children}
    </AuthenticatedPageShell>
  );
}
