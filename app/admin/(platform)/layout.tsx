import { type ReactNode } from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";

export default async function PlatformAdminLayout({ children }: { children: ReactNode }) {
  await requirePlatformAdmin();

  return (
    <div className="flex min-h-screen bg-surface">
      <AppSidebar agencySlug="" scope="admin" />
      <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
    </div>
  );
}
