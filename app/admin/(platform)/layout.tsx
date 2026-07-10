import { type ReactNode } from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { UserMenu } from "@/components/layout/UserMenu";
import { getProfile } from "@/lib/auth/get-profile";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";

export default async function PlatformAdminLayout({ children }: { children: ReactNode }) {
  const user = await requirePlatformAdmin();
  const profile = await getProfile();

  return (
    <div className="flex min-h-screen bg-surface">
      <AppSidebar agencySlug="" scope="admin" />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-end border-b border-border bg-surface-elevated px-4 sm:px-6">
          <UserMenu
            name={profile?.full_name ?? "Admin"}
            email={user.email ?? profile?.email ?? undefined}
          />
        </header>
        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
