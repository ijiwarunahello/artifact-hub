import { describe, expect, it } from "vitest";
import { buildId, slugify, todayPrefix } from "../src/store/slug.js";

describe("slugify", () => {
  it("lowercases and replaces spaces", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("strips non-ascii and falls back to hash", () => {
    expect(slugify("こんにちは")).toMatch(/^untitled-[a-f0-9]{8}$/);
  });

  it("trims dashes and length", () => {
    expect(slugify("---abc---")).toBe("abc");
    expect(slugify("a".repeat(200), 10).length).toBe(10);
  });

  it("collapses internal consecutive dashes", () => {
    expect(slugify("Rabbit R1 — 非公式ファーム / カスタム OS 調査メモ")).toBe("rabbit-r1-os");
    expect(slugify("foo / bar / baz")).toBe("foo-bar-baz");
  });
});

describe("todayPrefix", () => {
  it("formats date", () => {
    expect(todayPrefix(new Date("2026-05-20T10:00:00Z"))).toBe("2026-05-20");
  });
});

describe("buildId", () => {
  const now = new Date("2026-05-20T10:00:00Z");
  it("returns base id when not taken", () => {
    expect(buildId("hello", new Set(), now)).toBe("2026-05-20-hello");
  });
  it("appends suffix on collision", () => {
    const existing = new Set(["2026-05-20-hello"]);
    expect(buildId("hello", existing, now)).toBe("2026-05-20-hello-2");
  });
});
