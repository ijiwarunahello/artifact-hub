import type { ToolDef, ToolHandler } from "../../../types/tool.js";
import type { ToolRegistry } from "../registry.js";
import { renderStlViewerHtml } from "./viewer.js";

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://unpkg.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "connect-src 'self' https: blob:",
  "worker-src 'self' blob:",
  "frame-ancestors 'self'",
].join("; ");

export const stlToolDef: ToolDef = {
  name: "stl",
  title: "STL Preview",
  description:
    "Render an STL (binary or ASCII) in the browser. Accepts ?artifact=<id>, ?src=<url>, or a drag-dropped file.",
  acceptsArtifact: (meta) =>
    meta.kind === "code" && (meta.language ?? "").toLowerCase() === "stl",
};

export const stlToolHandler: ToolHandler = (req) => {
  const url = new URL(req.url);
  const artifactId = url.searchParams.get("artifact") ?? "";
  const src = url.searchParams.get("src") ?? "";
  const html = renderStlViewerHtml({ artifactId, src });
  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": CSP,
      "x-frame-options": "SAMEORIGIN",
      "cache-control": "no-store",
    },
  });
};

export function registerStlTool(registry: ToolRegistry): void {
  registry.register(stlToolDef, stlToolHandler);
}
