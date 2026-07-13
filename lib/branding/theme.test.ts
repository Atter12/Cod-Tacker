import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  agencyBrandCssVars,
  findMatchingPalette,
  resolveAgencyBrandTheme,
  softTintFromPrimary,
} from "@/lib/branding/theme";
import { BRANDING_DEFAULTS } from "@/lib/branding/schema";
import type { WhiteLabelSettingsRow } from "@/types/database";

describe("agency brand theme", () => {
  it("falls back to CODTracked defaults", () => {
    const theme = resolveAgencyBrandTheme(null, null);
    assert.equal(theme.productName, BRANDING_DEFAULTS.productName);
    assert.equal(theme.primaryColor, BRANDING_DEFAULTS.primaryColor);
  });

  it("applies saved settings and logo flag", () => {
    const settings = {
      product_name: "Flipy Ops",
      primary_color: "#0284C7",
      secondary_color: "#0369A1",
      logo_url: null,
      favicon_url: "https://cdn.example/favicon.ico",
      login_background_url: null,
      support_email: "ops@flipy.test",
      support_whatsapp: "+51999999999",
      hide_codtracked_branding: true,
    } as WhiteLabelSettingsRow;
    const theme = resolveAgencyBrandTheme(settings, {
      is_white_label_enabled: true,
      logo_url: "https://cdn.example/logo.png",
    });
    assert.equal(theme.productName, "Flipy Ops");
    assert.equal(theme.logoUrl, "https://cdn.example/logo.png");
    assert.equal(theme.hideCodtrackedBranding, true);
    assert.equal(theme.isWhiteLabelEnabled, true);
  });

  it("builds CSS vars from primary", () => {
    const theme = resolveAgencyBrandTheme(null, null);
    const vars = agencyBrandCssVars(theme);
    assert.equal(vars["--brand-primary"], theme.primaryColor);
    assert.match(softTintFromPrimary("#F47A32"), /^#[0-9A-F]{6}$/);
  });

  it("matches curated palettes", () => {
    const palette = findMatchingPalette("#F47A32", "#F5661F");
    assert.equal(palette?.id, "codtracked");
  });
});
