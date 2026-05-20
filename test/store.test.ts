import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ArtifactStore } from "../src/store/index.js";

let dir: string;
let store: ArtifactStore;
const now = new Date("2026-05-20T10:00:00.000Z");

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "artifact-hub-"));
  store = new ArtifactStore({ rootDir: dir, now: () => now });
  await store.init();
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("ArtifactStore", () => {
  it("creates, lists, and gets an artifact", async () => {
    const { meta } = await store.create({
      kind: "markdown",
      title: "Hello World",
      content: "# Hi",
      tags: ["greet"],
    });
    expect(meta.id).toBe("2026-05-20-hello-world");
    expect(store.list()).toHaveLength(1);
    const got = await store.get(meta.id);
    expect(got?.content).toBe("# Hi");
  });

  it("overwrites when explicit id collides and keeps createdAt", async () => {
    const a = await store.create({
      kind: "markdown",
      title: "Same",
      content: "v1",
      id: "fixed-id",
    });
    const b = await store.create({
      kind: "markdown",
      title: "Same updated",
      content: "v2",
      id: "fixed-id",
    });
    expect(a.meta.id).toBe(b.meta.id);
    expect(b.overwritten).toBe(true);
    expect(b.meta.createdAt).toBe(a.meta.createdAt);
    const got = await store.get(b.meta.id);
    expect(got?.content).toBe("v2");
  });

  it("auto-increments id when same title used without explicit id", async () => {
    const a = await store.create({ kind: "markdown", title: "Same", content: "v1" });
    const b = await store.create({ kind: "markdown", title: "Same", content: "v2" });
    expect(b.meta.id).not.toBe(a.meta.id);
    expect(b.meta.id.endsWith("-2")).toBe(true);
  });

  it("updates partial fields without losing content", async () => {
    const { meta } = await store.create({
      kind: "code",
      title: "Snippet",
      content: "console.log(1);",
      language: "ts",
    });
    const updated = await store.update({ id: meta.id, tags: ["new"] });
    expect(updated.tags).toEqual(["new"]);
    const got = await store.get(meta.id);
    expect(got?.content).toBe("console.log(1);");
  });

  it("filters list by kind/tag", async () => {
    await store.create({ kind: "markdown", title: "A", content: "x", tags: ["t1"] });
    await store.create({ kind: "code", title: "B", content: "y", tags: ["t2"], language: "ts" });
    expect(store.list({ kind: "code" })).toHaveLength(1);
    expect(store.list({ tag: "t1" })).toHaveLength(1);
  });

  it("searches by query and returns snippet", async () => {
    await store.create({
      kind: "markdown",
      title: "Rabbit R1 research",
      content: "LineageOS 21 is the recommended ROM for rabbit",
    });
    const hits = await store.search("lineageos");
    expect(hits).toHaveLength(1);
    expect(hits[0]!.snippet.toLowerCase()).toContain("lineageos");
  });

  it("emits events for create and update", async () => {
    const events: string[] = [];
    store.subscribe((e) => events.push(e.type));
    const { meta } = await store.create({ kind: "markdown", title: "x", content: "a" });
    await store.update({ id: meta.id, content: "b" });
    expect(events).toEqual(["created", "updated"]);
  });

  it("rebuilds index on init from existing files", async () => {
    await store.create({ kind: "markdown", title: "Persist", content: "ok" });
    const fresh = new ArtifactStore({ rootDir: dir, now: () => now });
    await fresh.init();
    expect(fresh.list()).toHaveLength(1);
  });

  it("honors explicit id", async () => {
    const { meta } = await store.create({
      kind: "markdown",
      title: "Whatever",
      content: "x",
      id: "my-custom-id",
    });
    expect(meta.id).toBe("my-custom-id");
  });

  it("verifies index.json is written", async () => {
    await store.create({ kind: "markdown", title: "x", content: "y" });
    const idx = JSON.parse(await fs.readFile(join(dir, "index.json"), "utf8"));
    expect(Array.isArray(idx)).toBe(true);
    expect(idx).toHaveLength(1);
  });
});
