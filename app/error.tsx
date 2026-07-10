"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui";
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <main className="flex min-h-screen items-center justify-center p-6"><div className="max-w-md text-center"><h1 className="text-2xl font-semibold">Algo salió mal</h1><p className="mt-2 text-text-secondary">No pudimos cargar esta página. Intenta nuevamente.</p><Button className="mt-5" onClick={reset}>Reintentar</Button></div></main>;
}
