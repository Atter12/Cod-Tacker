import { type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/** Consistent page padding and width constraint inside AppShell main. */
export function PageContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-6 sm:py-[22px]", className)}>
      {children}
    </div>
  );
}
