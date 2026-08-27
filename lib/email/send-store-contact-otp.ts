import "server-only";

import { logger } from "@/lib/observability/logger";

type SendStoreContactOtpInput = {
  to: string;
  code: string;
  storeName: string;
};

export async function sendStoreContactOtpEmail(input: SendStoreContactOtpInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim() ?? "CODTracked <noreply@codtracked.com>";
  const subject = `Código de verificación — ${input.storeName}`;
  const text = [
    `Tu código de verificación para la tienda "${input.storeName}" en CODTracked es:`,
    "",
    input.code,
    "",
    "El código expira en 10 minutos. Si no solicitaste este correo, ignóralo.",
  ].join("\n");

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "RESEND_API_KEY no configurada. Añádela en Vercel para enviar códigos de verificación de tienda.",
      );
    }
    logger.info("store_contact_otp.dev_fallback", {
      to: input.to,
      store_name: input.storeName,
      code: input.code,
    });
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject,
      text,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    logger.error("store_contact_otp.send_failed", {
      status: response.status,
      body: body.slice(0, 500),
      to: input.to,
    });
    throw new Error("No se pudo enviar el correo de verificación. Intenta de nuevo en unos minutos.");
  }
}
