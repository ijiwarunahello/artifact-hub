import { describe, expect, it } from "vitest";
import { EventBus } from "../src/bus/index.js";
import type { ArtifactMeta } from "../src/types/artifact.js";

const sampleMeta: ArtifactMeta = {
  id: "x",
  title: "x",
  kind: "markdown",
  tags: [],
  createdAt: "2026-05-20T00:00:00.000Z",
  updatedAt: "2026-05-20T00:00:00.000Z",
};

describe("EventBus", () => {
  it("delivers artifact events to subscribers", () => {
    const bus = new EventBus();
    const seen: string[] = [];
    const off = bus.onArtifact((e) => seen.push(e.type));
    bus.emitArtifact({ type: "created", meta: sampleMeta });
    bus.emitArtifact({ type: "updated", meta: sampleMeta });
    off();
    bus.emitArtifact({ type: "created", meta: sampleMeta });
    expect(seen).toEqual(["created", "updated"]);
  });
});
