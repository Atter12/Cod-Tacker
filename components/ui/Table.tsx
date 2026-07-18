import { type HTMLAttributes, type TableHTMLAttributes, type TdHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";
export function Table({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="min-w-0 w-full max-w-full overflow-x-auto overscroll-x-contain">
      <table className={cn("w-full min-w-[520px] caption-bottom text-sm", className)} {...props} />
    </div>
  );
}
export function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) { return <thead className={cn("border-b border-border text-left text-xs font-medium uppercase tracking-wide text-text-secondary", className)} {...props} />; }
export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) { return <tbody className={cn("divide-y divide-border", className)} {...props} />; }
export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) { return <tr className={cn("hover:bg-muted/60", className)} {...props} />; }
export function TableHead({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) { return <th className={cn("h-10 px-4 font-medium", className)} {...props} />; }
export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) { return <td className={cn("p-4 align-middle", className)} {...props} />; }
