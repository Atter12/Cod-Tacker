import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/get-profile";
import { requireUser } from "@/lib/auth/require-user";

export default async function ApplicationLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  const profile = await getProfile();
  if (!profile?.full_name) redirect("/account-setup");
  return children;
}
