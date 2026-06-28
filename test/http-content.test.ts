import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ArtifactStore } from "../src/store/index.js";
import { createHttpApp } from "../src/http/index.js";

let dir: string;
let store: ArtifactStore;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "artifact-hub-http-"));
  store = new ArtifactStore({ rootDir: dir });
  await store.init();
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("GET /api/artifacts/:id/content", () => {
  it("returns the raw artifact content bytes", async () => {
    const { meta } = await store.create({
      kind: "code",
      title: "Bracket",
      language: "stl",
      content: "solid bracket\nendsolid bracket\n",
    });
    const app = createHttpApp({ store, version: "test" });
    const res = await app.fetch(
      new Request(`http://test/api/artifacts/${meta.id}/content`),
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe("solid bracket\nendsolid bracket\n");
    expect(res.headers.get("content-type")).toBe("application/octet-stream");
  });

  it("returns 404 for unknown id", async () => {
    const app = createHttpApp({ store, version: "test" });
    const res = await app.fetch(
      new Request("http://test/api/artifacts/does-not-exist/content"),
    );
    expect(res.status).toBe(404);
  });
});
