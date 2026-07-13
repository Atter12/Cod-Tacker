import { cn } from "@/lib/utils/cn";

type Tone = "success" | "neutral" | "danger" | "brand";

const tones: Record<Tone, string> = {
  success: "bg-success/15 text-success",
  neutral: "bg-muted text-text-secondary",
  danger: "bg-danger/10 text-danger",
  brand: "bg-brand-soft text-brand-primary",
};

export function AgencyStatusPill({
  label,
  tone = "neutral",
  dot = false,
  className,
}: {
  label: string;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        tones[tone],
        className,
      )}
    >
      {dot ? (
        <span
          className={cn(
            "size-1.5 rounded-full",
            tone === "success" && "bg-success",
            tone === "danger" && "bg-danger",
            tone === "brand" && "bg-brand-primary",
            tone === "neutral" && "bg-text-secondary",
          )}
          aria-hidden
        />
      ) : null}
      {label}
    </span>
  );
}
