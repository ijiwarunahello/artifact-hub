import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("web mobile layout", () => {
  it("has a mobile back control for returning from preview to the list", async () => {
    const html = await readFile(join(root, "web/index.html"), "utf8");

    expect(html).toContain('id="back-to-list"');
    expect(html).toContain('class="back-button"');
  });

  it("defines mobile list and preview view states", async () => {
    const css = await readFile(join(root, "web/src/styles.css"), "utf8");

    expect(css).toContain("@media (max-width: 768px)");
    expect(css).toContain(".layout.mobile-preview .sidebar");
    expect(css).toContain(".layout.mobile-list .preview");
    expect(css).toContain("100dvh");
  });
});
