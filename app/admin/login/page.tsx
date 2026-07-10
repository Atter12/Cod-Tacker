import Link from "next/link";
import { routes } from "@/config/routes";
import { loginToAdmin } from "./actions";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center bg-surface p-6">
      <form action={loginToAdmin} className="w-full max-w-sm space-y-5 rounded-lg border border-border bg-surface-elevated p-6 shadow-sm">
        <div>
          <p className="text-sm font-medium text-brand-primary">CODTracked</p>
          <h1 className="mt-1 text-2xl font-semibold">Administración de plataforma</h1>
          <p className="mt-2 text-sm text-text-secondary">Ingresa con una cuenta de administrador de plataforma.</p>
        </div>
        {error && <p role="alert" className="rounded-md bg-danger/10 p-3 text-sm text-danger">No se pudo iniciar sesión con esas credenciales.</p>}
        <label className="block text-sm font-medium">Correo<input name="email" type="email" autoComplete="email" required className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2" /></label>
        <label className="block text-sm font-medium">Contraseña<input name="password" type="password" autoComplete="current-password" required className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2" /></label>
        <button type="submit" className="w-full rounded-md bg-brand-primary px-4 py-2 font-medium text-white">Ingresar</button>
        <Link href={routes.auth.login} className="block text-center text-sm text-text-secondary underline">Acceso de usuarios</Link>
      </form>
    </main>
  );
}
