"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  fireAutomationTrigger,
  setAutomationRuleActive,
  simulateAutomationRule,
} from "@/app/actions/automations";
import { Button } from "@/components/ui";

export function AutomationDetailActions({
  agencySlug,
  storeSlug,
  ruleId,
  isActive,
  triggerType,
}: {
  agencySlug: string;
  storeSlug: string;
  ruleId: string;
  isActive: boolean;
  triggerType: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await setAutomationRuleActive(agencySlug, storeSlug, ruleId, !isActive);
            if (r.error) alert(r.error);
            else router.refresh();
          })
        }
      >
        {isActive ? "Desactivar" : "Activar"}
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await simulateAutomationRule(agencySlug, storeSlug, ruleId, {
              orderId: "00000000-0000-4000-8000-000000000099",
              orderStatus: "created",
            });
            if (r.error) alert(r.error);
            else alert(`Simulación: ${JSON.stringify(r.simulation).slice(0, 400)}`);
          })
        }
      >
        Simular (dry-run)
      </Button>
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await fireAutomationTrigger(agencySlug, storeSlug, triggerType, {
              orderId: crypto.randomUUID(),
              orderStatus: "created",
              entityType: "order",
            });
            if (r.error) alert(r.error);
            else {
              alert("Trigger ejecutado. Revisa runs.");
              router.refresh();
            }
          })
        }
      >
        Disparar trigger mock
      </Button>
    </div>
  );
}
