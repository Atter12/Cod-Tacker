"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { seedMockAdsAttribution } from "@/app/actions/attribution";
import { Button } from "@/components/ui";

export function AttributionSeedButton({
  agencySlug,
  storeSlug,
}: {
  agencySlug: string;
  storeSlug: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await seedMockAdsAttribution(agencySlug, storeSlug);
          if (r.error) alert(r.error);
          else {
            alert(
              `Seed encolado (${r.jobId?.slice(0, 8) ?? "job"}). Ejecuta npm run jobs:process.`,
            );
            router.refresh();
          }
        })
      }
    >
      Recalcular mock (seed)
    </Button>
  );
}
