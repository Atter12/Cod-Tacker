import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function BackToStoreButton({
  href,
  storeName,
  className,
}: {
  href: string;
  storeName: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-9 max-w-full items-center gap-2 rounded-md border border-border bg-surface px-2.5 text-sm font-medium text-text-primary",
        "transition-colors hover:border-brand-primary/40 hover:bg-muted",
        className,
      )}
    >
      <ArrowLeft className="size-4 shrink-0 text-brand-primary" aria-hidden />
      <span className="min-w-0 truncate">
        <span className="hidden sm:inline">Volver a </span>
        <span className="font-semibold">{storeName}</span>
      </span>
    </Link>
  );
}
