import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const themeCssPath = fileURLToPath(new URL("../src/styles/theme.css", import.meta.url));

describe("shared theme CSS", () => {
  it("disables shared control transitions for reduced-motion users", () => {
    const css = readFileSync(themeCssPath, "utf8");

    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("transition-duration: 0.01ms !important;");
    expect(css).toContain("animation-duration: 0.01ms !important;");
  });
});
