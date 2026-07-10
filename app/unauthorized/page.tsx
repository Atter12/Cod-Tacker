import Link from "next/link";
import { routes } from "@/config/routes";

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md rounded-lg border border-dashed border-border px-6 py-14 text-center">
        <h1 className="text-xl font-semibold text-text-primary">Acceso no autorizado</h1>
        <p className="mt-2 text-sm text-text-secondary">
          No tienes permisos para ver esta sección. Si crees que es un error, contacta al administrador de la plataforma.
        </p>
        <Link
          href={routes.app.dashboard}
          className="mt-6 inline-flex h-9 items-center justify-center rounded-md bg-brand-primary px-4 text-sm font-medium text-white hover:bg-brand-primary/90"
        >
          Volver al dashboard
        </Link>
      </div>
    </main>
  );
}
