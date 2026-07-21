/**
 * Normalize customer phones for WhatsApp Cloud API `to` / `from` (digits, country code).
 * PE mobiles stored as 9 digits (9xxxxxxxx) expand to 51XXXXXXXXX.
 */

export function normalizeWhatsAppPhone(
  phone: string,
  countryCode?: string | null,
): string {
  let digits = phone.replace(/\D/g, "");
  const cc = countryCode?.trim().toUpperCase();
  if (cc === "PE" && digits.length === 9 && digits.startsWith("9")) {
    digits = `51${digits}`;
  }
  if (!cc && digits.length === 9 && digits.startsWith("9")) {
    digits = `51${digits}`;
  }
  return digits;
}

/** E.164-ish display with leading + for storage consistency (digits only in API calls). */
export function formatWhatsAppPhoneE164(
  phone: string,
  countryCode?: string | null,
): string {
  const digits = normalizeWhatsAppPhone(phone, countryCode);
  return digits ? `+${digits}` : "";
}
