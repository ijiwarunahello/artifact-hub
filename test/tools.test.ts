import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ArtifactStore } from "../src/store/index.js";
import { createHttpApp } from "../src/http/index.js";
import { ToolRegistry } from "../src/http/tools/registry.js";
import type { ToolDef } from "../src/types/tool.js";

let dir: string;
let store: ArtifactStore;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "artifact-hub-tools-"));
  store = new ArtifactStore({ rootDir: dir });
  await store.init();
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("ToolRegistry", () => {
  it("registers and resolves tools by name", () => {
    const reg = new ToolRegistry();
    const def: ToolDef = {
      name: "echo",
      title: "Echo",
      description: "for testing",
    };
    reg.register(def, () => new Response("hello", { status: 200 }));
    const entry = reg.get("echo");
    expect(entry?.def.title).toBe("Echo");
  });

  it("returns undefined for unknown tool name", () => {
    const reg = new ToolRegistry();
    expect(reg.get("missing")).toBeUndefined();
  });

  it("lists registered tool definitions", () => {
    const reg = new ToolRegistry();
    reg.register(
      { name: "a", title: "A", description: "" },
      () => new Response(""),
    );
    reg.register(
      { name: "b", title: "B", description: "" },
      () => new Response(""),
    );
    const names = reg.list().map((d) => d.name).sort();
    expect(names).toEqual(["a", "b"]);
  });
});

describe("GET /t/:tool dispatcher", () => {
  it("returns 404 for unknown tool", async () => {
    const app = createHttpApp({ store, webDir: "/tmp", version: "test" });
    const res = await app.fetch(new Request("http://test/t/unknown-tool"));
    expect(res.status).toBe(404);
  });

  it("serves the STL viewer HTML for /t/stl", async () => {
    const app = createHttpApp({ store, webDir: "/tmp", version: "test" });
    const res = await app.fetch(new Request("http://test/t/stl"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const body = await res.text();
    expect(body).toContain("STL");
    expect(body).toContain("three");
  });
});
