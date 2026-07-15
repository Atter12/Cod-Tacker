import { BRANDING_DEFAULTS } from "@/lib/branding/schema";
import type { WhiteLabelSettingsRow } from "@/types/database";

export type AgencyBrandTheme = {
  productName: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  loginBackgroundUrl: string | null;
  supportEmail: string | null;
  supportWhatsapp: string | null;
  hideCodtrackedBranding: boolean;
  isWhiteLabelEnabled: boolean;
};

export type BrandColorPalette = {
  id: string;
  label: string;
  primary: string;
  secondary: string;
};

/**
 * Brand tokens (CODTracked style guide), as solid same-hue pairs
 * (primary + darker secondary), matching the picker swatch style.
 * Deep Teal #0D4F55 · COD Orange #F36A1D · Charcoal #171A1F · Amber #F4B740 · Soft Teal #DCEDEE
 */
export const BRAND_COLOR_PALETTES: readonly BrandColorPalette[] = [
  // Platform brand presets first
  { id: "codtracked", label: "CODTracked", primary: "#0D4F55", secondary: "#08383C" },
  { id: "codtracked-accion", label: "CODTracked Acción", primary: "#F36A1D", secondary: "#C84E12" },
  { id: "codtracked-confianza", label: "CODTracked Confianza", primary: "#1F6B72", secondary: "#0D4F55" },
  { id: "codtracked-ambar", label: "CODTracked Ámbar", primary: "#F4B740", secondary: "#D97706" },
  { id: "codtracked-carbon", label: "CODTracked Carbón", primary: "#171A1F", secondary: "#0F1215" },
  { id: "codtracked-suave", label: "CODTracked Suave", primary: "#5A9A9F", secondary: "#0D4F55" },
  // Generic extras
  { id: "sunset", label: "Atardecer", primary: "#EA580C", secondary: "#C2410C" },
  { id: "coral", label: "Coral", primary: "#F43F5E", secondary: "#BE123C" },
  { id: "amber", label: "Ámbar", primary: "#D97706", secondary: "#B45309" },
  { id: "forest", label: "Bosque", primary: "#059669", secondary: "#047857" },
  { id: "teal", label: "Teal", primary: "#0D9488", secondary: "#0F766E" },
  { id: "ocean", label: "Océano", primary: "#0284C7", secondary: "#0369A1" },
  { id: "indigo", label: "Índigo", primary: "#4F46E5", secondary: "#3730A3" },
  { id: "violet", label: "Violeta", primary: "#7C3AED", secondary: "#5B21B6" },
  { id: "slate", label: "Pizarra", primary: "#475569", secondary: "#334155" },
] as const;

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

export function isValidBrandHex(value: string | null | undefined): value is string {
  return typeof value === "string" && HEX_RE.test(value.trim());
}

function normalizeHex(value: string | null | undefined, fallback: string): string {
  if (!isValidBrandHex(value)) return fallback;
  return value.trim().toUpperCase();
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  if (!isValidBrandHex(hex)) return null;
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  };
}

function rgbToHex(rgb: { r: number; g: number; b: number }): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`.toUpperCase();
}

/** Mix primary toward white for soft surfaces (light UI). */
export function softTintFromPrimary(primary: string, amount = 0.88): string {
  const rgb = parseHex(primary);
  if (!rgb) return "#FFF2EA";
  const mix = (channel: number) => Math.round(channel + (255 - channel) * amount);
  return rgbToHex({ r: mix(rgb.r), g: mix(rgb.g), b: mix(rgb.b) });
}

export function softerTintFromPrimary(primary: string): string {
  return softTintFromPrimary(primary, 0.94);
}

/** Four-step ramp for funnels / multi-series charts from the brand primary. */
export function brandChartRamp(primary: string): [string, string, string, string] {
  return [
    softTintFromPrimary(primary, 0),
    softTintFromPrimary(primary, 0.22),
    softTintFromPrimary(primary, 0.42),
    softTintFromPrimary(primary, 0.72),
  ];
}

export function findMatchingPalette(
  primary: string,
  secondary: string,
): BrandColorPalette | null {
  const p = primary.toUpperCase();
  const s = secondary.toUpperCase();
  return (
    BRAND_COLOR_PALETTES.find(
      (palette) => palette.primary.toUpperCase() === p && palette.secondary.toUpperCase() === s,
    ) ?? null
  );
}

export function resolveAgencyBrandTheme(
  settings: WhiteLabelSettingsRow | null,
  flags?: { is_white_label_enabled: boolean; logo_url: string | null } | null,
): AgencyBrandTheme {
  const primaryColor = normalizeHex(settings?.primary_color, BRANDING_DEFAULTS.primaryColor);
  const secondaryColor = normalizeHex(settings?.secondary_color, BRANDING_DEFAULTS.secondaryColor);
  const productName = settings?.product_name?.trim() || BRANDING_DEFAULTS.productName;
  const logoUrl = settings?.logo_url?.trim() || flags?.logo_url?.trim() || null;

  return {
    productName,
    primaryColor,
    secondaryColor,
    logoUrl,
    faviconUrl: settings?.favicon_url?.trim() || null,
    loginBackgroundUrl: settings?.login_background_url?.trim() || null,
    supportEmail: settings?.support_email?.trim() || null,
    supportWhatsapp: settings?.support_whatsapp?.trim() || null,
    hideCodtrackedBranding: Boolean(settings?.hide_codtracked_branding),
    isWhiteLabelEnabled: Boolean(flags?.is_white_label_enabled),
  };
}

/** Inline CSS variables for AppShell — overrides theme tokens in scope. */
export function agencyBrandCssVars(theme: AgencyBrandTheme): Record<string, string> {
  const [c1, c2, c3, c4] = brandChartRamp(theme.primaryColor);
  return {
    "--brand-primary": theme.primaryColor,
    "--brand-secondary": theme.secondaryColor,
    "--brand-accent": theme.primaryColor,
    "--brand-soft": softTintFromPrimary(theme.primaryColor),
    "--brand-softer": softerTintFromPrimary(theme.primaryColor),
    "--ring": theme.primaryColor,
    // Recharts + funnel colors inherit via CSS vars
    "--chart-1": c1,
    "--chart-2": theme.secondaryColor,
    "--chart-3": c3,
    "--chart-4": c4,
    // Keep a mid primary tint available for ramps that need 4 steps of one hue
    "--chart-ramp-2": c2,
  };
}

export function brandInitialLetter(productName: string): string {
  const trimmed = productName.trim();
  if (!trimmed) return "C";
  return trimmed.charAt(0).toUpperCase();
}

/** Next.js Metadata `icons` for an agency favicon URL (Storage or absolute). */
export function brandFaviconMetadata(faviconUrl: string | null | undefined): {
  icon: { url: string; type?: string }[];
  shortcut: string;
  apple: string;
} | undefined {
  const url = faviconUrl?.trim();
  if (!url) return undefined;
  const lower = url.toLowerCase();
  const type = lower.includes(".svg")
    ? "image/svg+xml"
    : lower.includes(".png")
      ? "image/png"
      : lower.includes(".webp")
        ? "image/webp"
        : lower.includes(".ico")
          ? "image/x-icon"
          : undefined;
  return {
    icon: [{ url, ...(type ? { type } : {}) }],
    shortcut: url,
    apple: url,
  };
}
