// @vitest-environment node

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const themeCssPath = fileURLToPath(new URL("../src/styles/theme.css", import.meta.url));
const resetCssPath = fileURLToPath(new URL("../src/theme/reset.css", import.meta.url));
const utilitiesCssPath = fileURLToPath(new URL("../src/theme/utilities.css", import.meta.url));
const navigationCssPath = fileURLToPath(new URL("../src/theme/components/navigation.css", import.meta.url));
const cardsCssPath = fileURLToPath(new URL("../src/theme/components/cards.css", import.meta.url));
const loginCssPath = fileURLToPath(new URL("../src/theme/pages/login.css", import.meta.url));
const settingsCssPath = fileURLToPath(new URL("../src/theme/pages/settings.css", import.meta.url));

describe("shared theme CSS", () => {
  it("legacy compat entry point imports all modules", () => {
    const css = readFileSync(themeCssPath, "utf8");

    expect(css).toContain("@import");
    expect(css).toContain("../theme/reset.css");
    expect(css).toContain("../theme/utilities.css");
    expect(css).toContain("../theme/components/navigation.css");
    expect(css).toContain("../theme/pages/settings.css");
  });

  it("disables shared control transitions for reduced-motion users", () => {
    const css = readFileSync(utilitiesCssPath, "utf8");

    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("transition-duration: 0.01ms !important;");
    expect(css).toContain("animation-duration: 0.01ms !important;");
  });

  it("reset.css contains base body styles", () => {
    const css = readFileSync(resetCssPath, "utf8");
    expect(css).toContain("body {");
    expect(css).toContain("--fg-color-canvas");
  });

  it("navigation.css contains sidebar styles", () => {
    const css = readFileSync(navigationCssPath, "utf8");
    expect(css).toContain(".ff-sidebar {");
    expect(css).toContain(".ff-topbar {");
    expect(css).toContain(".ff-bottom-tab-bar {");
  });

  it("cards.css contains card and pill styles", () => {
    const css = readFileSync(cardsCssPath, "utf8");
    expect(css).toContain(".fg-card {");
    expect(css).toContain(".fg-pill {");
    expect(css).toContain(".fg-kpi {");
  });

  it("login.css contains public shell and login card", () => {
    const css = readFileSync(loginCssPath, "utf8");
    expect(css).toContain(".ff-login-card");
    expect(css).toContain(".ff-public-shell");
  });

  it("settings.css contains settings styles", () => {
    const css = readFileSync(settingsCssPath, "utf8");
    expect(css).toContain(".ff-settings-item {");
  });
});
