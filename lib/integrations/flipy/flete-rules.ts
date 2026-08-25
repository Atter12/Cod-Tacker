import type { FlipyEscenarioPago } from "@/lib/integrations/flipy/resolve-payment";

/**
 * UI + validation rules for Flipy flete (oferta) by escenario.
 *
 * Documented optional case: none in v1 for 1A/1C/1E/1D — motorizados always
 * need a positive oferta to bid against. GRATIS is not exposed in the create wizard.
 */
export type FlipyFleteUiRule = {
  required: boolean;
  /** Must be > 0 when required. */
  minExclusive: number;
  label: string;
  hint: string;
  optional: boolean;
};

const REQUIRED_OFERTA: FlipyFleteUiRule = {
  required: true,
  minExclusive: 0,
  label: "Oferta de flete (S/)",
  hint: "Los motorizados pujan desde esta oferta. Debe ser mayor a 0.",
  optional: false,
};

const RULES: Record<Exclude<FlipyEscenarioPago, "GRATIS">, FlipyFleteUiRule> = {
  "1A": {
    ...REQUIRED_OFERTA,
    label: "Oferta de flete (S/)",
    hint: "Prepago total: la oferta de flete es requerida. Los motorizados pujan desde este monto.",
  },
  "1C": {
    ...REQUIRED_OFERTA,
    hint: "COD producto: oferta de flete requerida para abrir pujas.",
  },
  "1E": {
    ...REQUIRED_OFERTA,
    hint: "COD producto + envío: oferta de flete requerida para abrir pujas.",
  },
  "1D": {
    ...REQUIRED_OFERTA,
    hint: "COD solo envío: oferta de flete requerida para abrir pujas.",
  },
};

export function getFlipyFleteUiRule(escenario: FlipyEscenarioPago): FlipyFleteUiRule {
  if (escenario === "GRATIS") {
    return {
      required: false,
      minExclusive: -1,
      label: "Flete",
      hint: "Envío gratis — sin oferta de flete.",
      optional: true,
    };
  }
  return RULES[escenario];
}

export type FlipyFleteValidation = {
  ok: boolean;
  value: number | null;
  error: string | null;
};

export function validateFlipyFletePrice(
  escenario: FlipyEscenarioPago,
  raw: string | number | null | undefined,
): FlipyFleteValidation {
  const rule = getFlipyFleteUiRule(escenario);
  const parsed =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && raw.trim()
        ? Number.parseFloat(raw.trim())
        : null;

  if (rule.required) {
    if (parsed == null || !Number.isFinite(parsed) || parsed <= rule.minExclusive) {
      return {
        ok: false,
        value: null,
        error: `${rule.label} debe ser mayor a ${rule.minExclusive}.`,
      };
    }
    return { ok: true, value: parsed, error: null };
  }

  if (parsed == null || !Number.isFinite(parsed)) {
    return { ok: true, value: null, error: null };
  }
  if (parsed < 0) {
    return { ok: false, value: null, error: "El flete no puede ser negativo." };
  }
  return { ok: true, value: parsed, error: null };
}

/** Prefill input string: prefer suggested > 0; for 1A never leave empty when suggestion is 0/null — still leave blank so user must enter. */
export function initialFleteInputValue(
  escenario: FlipyEscenarioPago,
  suggestedFlete: number | null | undefined,
): string {
  const rule = getFlipyFleteUiRule(escenario);
  if (suggestedFlete != null && Number.isFinite(suggestedFlete) && suggestedFlete > rule.minExclusive) {
    return String(suggestedFlete);
  }
  return "";
}
