import Link from "next/link";
import { Card, CardContent } from "@/components/ui";

export function CompactAuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050B16] p-4">
      <div className="login-auth-compact relative w-full max-w-md">
        <div
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[24px]"
          aria-hidden
        >
          <div className="absolute -right-16 -top-16 size-48 rounded-full bg-[#164E63]/25 blur-3xl" />
          <div className="absolute -bottom-20 -left-10 size-52 rounded-full bg-[#19C7B5]/15 blur-3xl" />
        </div>
        <Card className="w-full border-[rgba(76,139,170,0.22)] bg-[#0D1B30] shadow-[0_24px_50px_rgba(0,0,0,0.35)]">
          <CardContent className="p-7">
            <Link
              href="/"
              className="mb-8 block text-xl font-bold tracking-tight text-[#22D3EE] outline-none focus-visible:ring-2 focus-visible:ring-[rgba(34,211,238,0.55)]"
            >
              CODTracked
            </Link>
            {children}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
