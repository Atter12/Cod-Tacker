import Link from "next/link";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { Card, CardContent } from "@/components/ui";
import { routes } from "@/config/routes";
import { getProfile } from "@/lib/auth/get-profile";
import { requireUser } from "@/lib/auth/require-user";

export default async function ProfilePage() {
  await requireUser();
  const profile = await getProfile();

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-4 py-10">
      <Card>
        <CardContent className="space-y-5 p-7">
          <div>
            <h1 className="text-2xl font-semibold">Tu perfil</h1>
            <p className="mt-1 text-sm text-text-secondary">Actualiza el nombre que se muestra en la plataforma.</p>
          </div>
          <ProfileForm fullName={profile?.full_name ?? ""} email={profile?.email ?? ""} />
          <p className="text-center text-sm text-text-secondary">
            <Link href={routes.app.dashboard} className="text-brand-primary">
              Volver al dashboard
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
