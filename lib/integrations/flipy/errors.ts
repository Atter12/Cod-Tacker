import type { FlipyPartnerApiErrorDetails } from "@/lib/integrations/flipy/partner-contract";

export class FlipyPartnerApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: FlipyPartnerApiErrorDetails;

  constructor(
    message: string,
    status: number,
    code?: string,
    details?: FlipyPartnerApiErrorDetails,
  ) {
    super(message);
    this.name = "FlipyPartnerApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const FLIPY_ERROR_CODES = {
  SALDO_INSUFICIENTE_HOLD: "SALDO_INSUFICIENTE_HOLD",
  OUT_OF_PERU: "OUT_OF_PERU",
  PRODUCTO_EXCEDE_TOPE_YAPE: "PRODUCTO_EXCEDE_TOPE_YAPE",
  TIENDA_NOT_LINKED: "TIENDA_NOT_LINKED",
  CANCEL_BLOQUEADA_ASIGNADO: "CANCEL_BLOQUEADA_ASIGNADO",
  CANCEL_BLOQUEADA_EN_CURSO: "CANCEL_BLOQUEADA_EN_CURSO",
  YA_ENTREGADO: "YA_ENTREGADO",
  HOLD_YA_CAPTURADO: "HOLD_YA_CAPTURADO",
  ENVIO_NOT_FOUND: "ENVIO_NOT_FOUND",
  SIN_DEVOLUCION_PENDIENTE: "SIN_DEVOLUCION_PENDIENTE",
  CALIFICACION_NO_DISPONIBLE: "CALIFICACION_NO_DISPONIBLE",
  SALDO_GANANCIAS_INSUFICIENTE: "SALDO_GANANCIAS_INSUFICIENTE",
  IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",
} as const;

export type FlipyErrorCode = (typeof FLIPY_ERROR_CODES)[keyof typeof FLIPY_ERROR_CODES];

export function readFlipyErrorCode(error: unknown): string | null {
  if (error instanceof FlipyPartnerApiError && error.code) return error.code;
  if (error && typeof error === "object") {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && code.trim()) return code.trim();
  }
  return null;
}

export function isFlipyInsufficientBalanceError(error: unknown): boolean {
  const code = readFlipyErrorCode(error);
  if (code === FLIPY_ERROR_CODES.SALDO_INSUFICIENTE_HOLD) return true;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  return /saldo\s*insuficiente/i.test(message);
}

export function flipyErrorUserHint(code: string | null): string | null {
  switch (code) {
    case FLIPY_ERROR_CODES.SALDO_INSUFICIENTE_HOLD:
      return "Recarga la billetera Operaciones en Flipy para crear el envío.";
    case FLIPY_ERROR_CODES.OUT_OF_PERU:
      return "La ubicación confirmada está fuera del Perú. Ajusta el pin en el mapa.";
    case FLIPY_ERROR_CODES.PRODUCTO_EXCEDE_TOPE_YAPE:
      return "El monto supera el tope Yape — considera escenario 1D.";
    case FLIPY_ERROR_CODES.TIENDA_NOT_LINKED:
      return "Reconecta Flipy en Integraciones.";
    case FLIPY_ERROR_CODES.CANCEL_BLOQUEADA_ASIGNADO:
      return "Ya hay un motorizado asignado. Cancela desde Flipy o contacta soporte.";
    case FLIPY_ERROR_CODES.CANCEL_BLOQUEADA_EN_CURSO:
      return "El envío está en curso. Gestiona devolución o soporte desde Flipy.";
    case FLIPY_ERROR_CODES.YA_ENTREGADO:
      return "El envío ya fue entregado y no puede cancelarse.";
    case FLIPY_ERROR_CODES.HOLD_YA_CAPTURADO:
      return "El hold de saldo ya fue capturado. Contacta soporte Flipy.";
    case FLIPY_ERROR_CODES.ENVIO_NOT_FOUND:
      return "No se encontró el envío Flipy para este pedido.";
    case FLIPY_ERROR_CODES.SIN_DEVOLUCION_PENDIENTE:
      return "El motorizado aún no inició la devolución o ya fue confirmada.";
    case FLIPY_ERROR_CODES.CALIFICACION_NO_DISPONIBLE:
      return "Este envío aún no puede calificarse al motorizado.";
    case FLIPY_ERROR_CODES.SALDO_GANANCIAS_INSUFICIENTE:
      return "El monto supera tu saldo en Ganancias.";
    case FLIPY_ERROR_CODES.IDEMPOTENCY_CONFLICT:
      return "Conflicto de idempotencia. Intenta de nuevo con una nueva solicitud.";
    default:
      return null;
  }
}

export function isFlipyDevolucionPendienteConfirmacion(
  devolucion: { pendienteConfirmacion?: boolean | null; estado?: string | null } | null | undefined,
): boolean {
  if (!devolucion) return false;
  if (devolucion.pendienteConfirmacion === true) return true;
  const estado = devolucion.estado?.trim().toUpperCase();
  return estado === "PENDIENTE_CONFIRMACION_TIENDA";
}

/** Estados Flipy en los que la cancelación inmediata vía Partner API está permitida. */
export const FLIPY_IMMEDIATE_CANCEL_ESTADOS = [
  "BORRADOR",
  "PENDIENTE_PUJAS",
  "ASIGNANDO_SMART",
] as const;

export function isFlipyImmediateCancelEstado(estado: string | null | undefined): boolean {
  if (!estado) return false;
  return (FLIPY_IMMEDIATE_CANCEL_ESTADOS as readonly string[]).includes(estado.trim().toUpperCase());
}

export function isFlipyTerminalEstado(estado: string | null | undefined): boolean {
  if (!estado) return false;
  const normalized = estado.trim().toUpperCase();
  return normalized === "CANCELADO" || normalized === "ENTREGADO";
}
