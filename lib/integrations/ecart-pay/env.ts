import "server-only";

/** Sandbox default; override with ECART_PAY_API_BASE_URL for production. */
export function getEcartPayApiBaseUrl(): string {
  const raw = process.env.ECART_PAY_API_BASE_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  return "https://sandbox.ecartpay.com";
}
