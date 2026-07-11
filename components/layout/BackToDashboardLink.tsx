import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { routes } from "@/config/routes";
import { cn } from "@/lib/utils/cn";

export function BackToDashboardLink({
  agencySlug,
  storeSlug,
  className,
}: {
  agencySlug: string;
  storeSlug: string;
  className?: string;
}) {
  return (
    <div className={cn("pt-2", className)}>
      <Link
        href={routes.store.dashboard(agencySlug, storeSlug)}
        className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[10px] border border-brand-primary bg-transparent px-5 text-[12.5px] font-medium text-brand-primary transition-colors hover:bg-brand-softer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto sm:min-w-[148px]"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Volver al resumen
      </Link>
    </div>
  );
}
