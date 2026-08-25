import type { FlipyFleteQuote } from "@/lib/integrations/flipy/partner-contract";
import type { FlipyEscenarioPago } from "@/lib/integrations/flipy/resolve-payment";

/**
 * UI + validation rules for Flipy flete (oferta) by escenario.
 *
 * v0.2 (D4): when smartEligible, flete is locked to cotización Flipy (readonly).
 * Bid mode: editable oferta within market range when quote present.
 */
export type FlipyFleteUiRule = {
  required: boolean;
  /** Must be > 0 when required. */
  minExclusive: number;
  label: string;
  hint: string;
  optional: boolean;
  /** Smart (1A / flete prepagado): merchant cannot edit flete. */
  locked: boolean;
};

const SMART_FLETE_RULE: FlipyFleteUiRule = {
  required: true,
  minExclusive: 0,
  label: "Flete (cotización Flipy)",
  hint: "Asignación automática — flete fijo según cotización Flipy.",
  optional: false,
  locked: true,
};

const BID_FLETE_RULE: FlipyFleteUiRule = {
  required: true,
  minExclusive: 0,
  label: "Oferta de flete (S/)",
  hint: "Motorizados pujan desde esta oferta. Debe ser mayor a 0.",
  optional: false,
  locked: false,
};

const RULES: Record<Exclude<FlipyEscenarioPago, "GRATIS">, FlipyFleteUiRule> = {
  "1A": SMART_FLETE_RULE,
  "1C": BID_FLETE_RULE,
  "1E": BID_FLETE_RULE,
  "1D": BID_FLETE_RULE,
};

export type FlipyFleteRuleContext = {
  smartEligible?: boolean;
};

export function isFlipyFleteLocked(context?: FlipyFleteRuleContext): boolean {
  return context?.smartEligible === true;
}

export function getFlipyFleteUiRule(
  escenario: FlipyEscenarioPago,
  context?: FlipyFleteRuleContext,
): FlipyFleteUiRule {
  if (isFlipyFleteLocked(context)) {
    return SMART_FLETE_RULE;
  }
  if (escenario === "GRATIS") {
    return {
      required: false,
      minExclusive: -1,
      label: "Flete",
      hint: "Envío gratis — sin oferta de flete.",
      optional: true,
      locked: false,
    };
  }
  return RULES[escenario];
}

export type FlipyFleteValidation = {
  ok: boolean;
  value: number | null;
  error: string | null;
};

export type FlipyFleteValidationContext = FlipyFleteRuleContext & {
  fleteQuote?: FlipyFleteQuote | null;
};

export function validateFlipyFletePrice(
  escenario: FlipyEscenarioPago,
  raw: string | number | null | undefined,
  context?: FlipyFleteValidationContext,
): FlipyFleteValidation {
  const rule = getFlipyFleteUiRule(escenario, context);
  const locked = isFlipyFleteLocked(context);
  const quotedFare = context?.fleteQuote?.recommendedFare;

  if (locked) {
    if (quotedFare == null || !Number.isFinite(quotedFare) || quotedFare <= 0) {
      return {
        ok: false,
        value: null,
        error: "Cotiza el flete en el mapa antes de continuar (flete bloqueado en asignación automática).",
      };
    }
    const parsed =
      typeof raw === "number"
        ? raw
        : typeof raw === "string" && raw.trim()
          ? Number.parseFloat(raw.trim())
          : quotedFare;
    if (!Number.isFinite(parsed) || Math.abs(parsed - quotedFare) > 0.01) {
      return {
        ok: false,
        value: null,
        error: `En asignación automática el flete debe ser S/ ${quotedFare.toFixed(2)} (cotización Flipy).`,
      };
    }
    return { ok: true, value: quotedFare, error: null };
  }

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
    const minOffer = context?.fleteQuote?.minOffer;
    const maxOffer = context?.fleteQuote?.maxOffer;
    if (minOffer != null && parsed < minOffer - 0.01) {
      return {
        ok: false,
        value: null,
        error: `La oferta mínima del mercado es S/ ${minOffer.toFixed(2)}.`,
      };
    }
    if (maxOffer != null && parsed > maxOffer + 0.01) {
      return {
        ok: false,
        value: null,
        error: `La oferta máxima del mercado es S/ ${maxOffer.toFixed(2)}.`,
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

/** Prefill: smart uses quote; bid uses suggested shipping when > 0. */
export function initialFleteInputValue(
  escenario: FlipyEscenarioPago,
  suggestedFlete: number | null | undefined,
  context?: FlipyFleteValidationContext,
): string {
  if (isFlipyFleteLocked(context)) {
    const quoted = context?.fleteQuote?.recommendedFare ?? suggestedFlete;
    if (quoted != null && Number.isFinite(quoted) && quoted > 0) return String(quoted);
    return "";
  }
  const rule = getFlipyFleteUiRule(escenario, context);
  if (suggestedFlete != null && Number.isFinite(suggestedFlete) && suggestedFlete > rule.minExclusive) {
    return String(suggestedFlete);
  }
  const quoted = context?.fleteQuote?.recommendedFare;
  if (quoted != null && Number.isFinite(quoted) && quoted > rule.minExclusive) {
    return String(quoted);
  }
  return "";
}
