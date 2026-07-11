"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createAutomationRule,
  updateAutomationRule,
} from "@/app/actions/automations";
import { Button, Checkbox, Input, Select, Textarea } from "@/components/ui";
import {
  AUTOMATION_ACTION_TYPES,
  AUTOMATION_TRIGGERS,
  type AutomationRuleInput,
} from "@/lib/automations/schema";
import { routes } from "@/config/routes";
import { labelTrigger } from "@/lib/alerts/labels";

const DEFAULT_INPUT: AutomationRuleInput = {
  name: "",
  description: "",
  triggerType: "order.created",
  conditions: {
    logic: "and",
    conditions: [{ field: "orderStatus", op: "exists" }],
  },
  actions: [
    {
      type: "create_alert",
      title: "Alerta automática",
      severity: "warning",
      alertType: "automation",
    },
  ],
  cooldownMinutes: 0,
  priority: 100,
  requiresManualApproval: false,
  isActive: false,
};

export function AutomationRuleForm({
  agencySlug,
  storeSlug,
  ruleId,
  initial,
}: {
  agencySlug: string;
  storeSlug: string;
  ruleId?: string;
  initial?: Partial<AutomationRuleInput>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<AutomationRuleInput>({
    ...DEFAULT_INPUT,
    ...initial,
    conditions: initial?.conditions ?? DEFAULT_INPUT.conditions,
    actions: initial?.actions ?? DEFAULT_INPUT.actions,
  });
  const [conditionsJson, setConditionsJson] = useState(
    JSON.stringify(form.conditions, null, 2),
  );
  const [actionsJson, setActionsJson] = useState(JSON.stringify(form.actions, null, 2));

  return (
    <form
      className="space-y-4 max-w-2xl"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          let conditions;
          let actions;
          try {
            conditions = JSON.parse(conditionsJson);
            actions = JSON.parse(actionsJson);
          } catch {
            setError("JSON de condiciones/acciones inválido.");
            return;
          }
          const payload: AutomationRuleInput = {
            ...form,
            conditions,
            actions,
          };
          const r = ruleId
            ? await updateAutomationRule(agencySlug, storeSlug, ruleId, payload)
            : await createAutomationRule(agencySlug, storeSlug, payload);
          if (r.error) {
            setError(r.error);
            return;
          }
          router.push(
            routes.store.automationDetail(agencySlug, storeSlug, r.ruleId ?? ruleId!),
          );
          router.refresh();
        });
      }}
    >
      {error && <p className="text-sm text-danger">{error}</p>}
      <label className="block text-sm space-y-1">
        <span>Nombre</span>
        <Input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          required
        />
      </label>
      <label className="block text-sm space-y-1">
        <span>Descripción</span>
        <Input
          value={form.description ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
      </label>
      <label className="block text-sm space-y-1">
        <span>Trigger</span>
        <Select
          value={form.triggerType}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              triggerType: e.target.value as AutomationRuleInput["triggerType"],
            }))
          }
        >
          {AUTOMATION_TRIGGERS.map((t) => (
            <option key={t} value={t}>
              {labelTrigger(t)}
            </option>
          ))}
        </Select>
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm space-y-1">
          <span>Cooldown (min)</span>
          <Input
            type="number"
            min={0}
            value={form.cooldownMinutes}
            onChange={(e) =>
              setForm((f) => ({ ...f, cooldownMinutes: Number(e.target.value) || 0 }))
            }
          />
        </label>
        <label className="text-sm space-y-1">
          <span>Prioridad</span>
          <Input
            type="number"
            min={1}
            value={form.priority}
            onChange={(e) =>
              setForm((f) => ({ ...f, priority: Number(e.target.value) || 100 }))
            }
          />
        </label>
        <label className="flex items-center gap-2 text-sm mt-6">
          <Checkbox
            checked={form.requiresManualApproval}
            onChange={(e) =>
              setForm((f) => ({ ...f, requiresManualApproval: e.target.checked }))
            }
          />
          Aprobación manual
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={form.isActive}
          onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
        />
        Activar regla
      </label>
      <label className="block text-sm space-y-1">
        <span>Condiciones (JSON tipado AND/OR)</span>
        <Textarea
          rows={8}
          value={conditionsJson}
          onChange={(e) => setConditionsJson(e.target.value)}
          className="font-mono text-xs"
        />
      </label>
      <label className="block text-sm space-y-1">
        <span>
          Acciones (JSON). Tipos: {AUTOMATION_ACTION_TYPES.join(", ")}
        </span>
        <Textarea
          rows={10}
          value={actionsJson}
          onChange={(e) => setActionsJson(e.target.value)}
          className="font-mono text-xs"
        />
      </label>
      <p className="text-xs text-text-secondary">
        El servidor valida con Zod. Acciones peligrosas requieren aprobación si está marcada.
        Ninguna acción llama APIs externas reales.
      </p>
      <Button type="submit" disabled={pending}>
        {ruleId ? "Guardar cambios" : "Crear regla"}
      </Button>
    </form>
  );
}
