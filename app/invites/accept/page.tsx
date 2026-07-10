import Link from "next/link";
import { redirect } from "next/navigation";
import { AcceptInviteForm } from "@/components/invites/AcceptInviteForm";
import { Card, CardContent } from "@/components/ui";
import { inviteAcceptLoginPath } from "@/lib/invitations/token";
import { getUser } from "@/lib/auth/get-session";
import { routes } from "@/config/routes";

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const user = await getUser();

  if (!token) {
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="space-y-3 p-6">
            <h1 className="text-xl font-semibold">Invitación inválida</h1>
            <p className="text-sm text-text-secondary">Falta el token de invitación.</p>
            <Link href={routes.app.dashboard} className="text-brand-primary">
              Ir al dashboard
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!user) {
    redirect(inviteAcceptLoginPath(token));
  }

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-4 p-6">
          <h1 className="text-xl font-semibold">Aceptar invitación</h1>
          <p className="text-sm text-text-secondary">
            Estás autenticado como {user.email}. Al aceptar, te unirás a la agencia con el rol invitado.
          </p>
          <AcceptInviteForm token={token} />
        </CardContent>
      </Card>
    </main>
  );
}
