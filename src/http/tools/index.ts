import { Hono } from "hono";
import { ToolRegistry } from "./registry.js";
import { registerStlTool } from "./stl/handler.js";

export function buildDefaultRegistry(): ToolRegistry {
  const reg = new ToolRegistry();
  registerStlTool(reg);
  return reg;
}

export function createToolsRouter(): Hono {
  const registry = buildDefaultRegistry();
  const app = new Hono();

  app.all("/:tool", async (c) => {
    const entry = registry.get(c.req.param("tool"));
    if (!entry) return c.text("tool not found", 404);
    return entry.handler(c.req.raw);
  });

  return app;
}

export { ToolRegistry };
