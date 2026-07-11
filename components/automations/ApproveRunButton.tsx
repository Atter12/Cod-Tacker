"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { approveAutomationRun } from "@/app/actions/automations";
import { Button } from "@/components/ui";

export function ApproveRunButton({
  agencySlug,
  storeSlug,
  runId,
}: {
  agencySlug: string;
  storeSlug: string;
  runId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await approveAutomationRun(agencySlug, storeSlug, runId);
          if (r.error) alert(r.error);
          else router.refresh();
        })
      }
    >
      Aprobar y ejecutar
    </Button>
  );
}
