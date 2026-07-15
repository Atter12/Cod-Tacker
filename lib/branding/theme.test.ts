import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  agencyBrandCssVars,
  brandChartRamp,
  brandFaviconMetadata,
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

  it("builds favicon metadata with mime type", () => {
    const icons = brandFaviconMetadata("https://cdn.example/mark.png?t=1");
    assert.equal(icons?.icon[0]?.url, "https://cdn.example/mark.png?t=1");
    assert.equal(icons?.icon[0]?.type, "image/png");
    assert.equal(brandFaviconMetadata(null), undefined);
  });

  it("builds CSS vars including chart ramp from primary", () => {
    const theme = resolveAgencyBrandTheme(
      {
        primary_color: "#7C3AED",
        secondary_color: "#5B21B6",
      } as WhiteLabelSettingsRow,
      null,
    );
    const vars = agencyBrandCssVars(theme);
    assert.equal(vars["--brand-primary"], "#7C3AED");
    assert.equal(vars["--chart-1"], "#7C3AED");
    assert.equal(vars["--chart-2"], "#5B21B6");
    assert.equal(vars["--chart-3"], brandChartRamp("#7C3AED")[2]);
    assert.match(softTintFromPrimary("#0D4F55"), /^#[0-9A-F]{6}$/);
  });

  it("matches curated palettes", () => {
    const palette = findMatchingPalette("#0D4F55", "#08383C");
    assert.equal(palette?.id, "codtracked");
    assert.equal(findMatchingPalette("#F36A1D", "#C84E12")?.id, "codtracked-accion");
  });
});
