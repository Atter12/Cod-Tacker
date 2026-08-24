export class FlipyPartnerApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "FlipyPartnerApiError";
    this.status = status;
    this.code = code;
  }
}

export const FLIPY_ERROR_CODES = {
  SALDO_INSUFICIENTE_HOLD: "SALDO_INSUFICIENTE_HOLD",
  OUT_OF_PERU: "OUT_OF_PERU",
  PRODUCTO_EXCEDE_TOPE_YAPE: "PRODUCTO_EXCEDE_TOPE_YAPE",
  TIENDA_NOT_LINKED: "TIENDA_NOT_LINKED",
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
    default:
      return null;
  }
}
