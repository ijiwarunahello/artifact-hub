import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import type { ArtifactStore } from "../store/index.js";
import { renderArtifact } from "./render.js";
import { createToolsRouter } from "./tools/index.js";

export function createHttpApp(opts: {
  store: ArtifactStore;
  webDir: string;
  version: string;
}): Hono {
  const app = new Hono();

  app.get("/api/health", (c) =>
    c.json({ ok: true, version: opts.version, count: opts.store.metas().length }),
  );

  app.get("/api/version", (c) =>
    c.json({ name: "artifact-hub", version: opts.version }),
  );

  app.get("/api/artifacts", (c) => {
    const url = new URL(c.req.url);
    const kind = url.searchParams.get("kind") ?? undefined;
    const tag = url.searchParams.get("tag") ?? undefined;
    const limit = url.searchParams.get("limit");
    const items = opts.store.list({
      kind: kind as never,
      tag: tag ?? undefined,
      limit: limit ? Number(limit) : undefined,
    });
    return c.json({ items });
  });

  app.get("/api/artifacts/:id", async (c) => {
    const artifact = await opts.store.get(c.req.param("id"));
    if (!artifact) return c.json({ error: "not found" }, 404);
    return c.json(artifact);
  });

  app.get("/api/artifacts/:id/content", async (c) => {
    const artifact = await opts.store.get(c.req.param("id"));
    if (!artifact) return c.text("not found", 404);
    return new Response(artifact.content, {
      status: 200,
      headers: {
        "content-type": "application/octet-stream",
        "cache-control": "no-store",
      },
    });
  });

  app.get("/a/:id", (c) =>
    c.redirect(`/?id=${encodeURIComponent(c.req.param("id"))}`, 302),
  );

  app.get("/render/:id", async (c) => {
    const id = c.req.param("id");
    const artifact = await opts.store.get(id);
    if (!artifact) return c.text("not found", 404);
    const result = renderArtifact(artifact);
    return new Response(result.html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "content-security-policy": result.csp,
        "x-frame-options": "SAMEORIGIN",
      },
    });
  });

  app.route("/t", createToolsRouter());

  app.use(
    "/*",
    serveStatic({
      root: opts.webDir,
      rewriteRequestPath: (path) => (path === "/" ? "/index.html" : path),
    }),
  );

  return app;
}
