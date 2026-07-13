import { z } from "zod";

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Usa un color hexadecimal de 6 dígitos (#RRGGBB).");

const optionalUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => !v || /^https?:\/\//i.test(v), "La URL debe comenzar con http:// o https://")
  .optional()
  .nullable()
  .transform((v) => (v && v.length ? v : null));

export const brandingUpdateSchema = z.object({
  productName: z.string().trim().min(1).max(80).nullable().optional(),
  primaryColor: hexColor.nullable().optional(),
  secondaryColor: hexColor.nullable().optional(),
  logoUrl: optionalUrl,
  faviconUrl: optionalUrl,
  loginBackgroundUrl: optionalUrl,
  supportEmail: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => {
      if (v == null) return null;
      const t = String(v).trim();
      return t.length ? t : null;
    })
    .refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: "Correo de soporte inválido.",
    }),
  supportWhatsapp: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => {
      if (v == null) return null;
      const t = String(v).trim();
      return t.length ? t : null;
    })
    .refine((v) => v === null || /^[0-9+\-\s]+$/.test(v), {
      message: "WhatsApp solo admite dígitos y +.",
    }),
  hideCodtrackedBranding: z.boolean().optional(),
  isWhiteLabelEnabled: z.boolean().optional(),
});

export type BrandingUpdateInput = z.infer<typeof brandingUpdateSchema>;

export const BRANDING_DEFAULTS = {
  productName: "CODTracked",
  primaryColor: "#F47A32",
  secondaryColor: "#F5661F",
  logoUrl: null as string | null,
  faviconUrl: null as string | null,
  loginBackgroundUrl: null as string | null,
  supportEmail: null as string | null,
  supportWhatsapp: null as string | null,
  hideCodtrackedBranding: false,
  isWhiteLabelEnabled: false,
} as const;
