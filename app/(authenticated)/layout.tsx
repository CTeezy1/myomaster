import { AuthenticatedPageShell } from "@/app/components/auth/AuthenticatedPageShell";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthenticatedPageShell>{children}</AuthenticatedPageShell>;
}
