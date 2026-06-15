import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ArtifactStore } from "../store/index.js";
import { ARTIFACT_KINDS, CREATABLE_ARTIFACT_KINDS } from "../types/artifact.js";

const MAX_CONTENT_BYTES = 2 * 1024 * 1024;

export interface McpHandle {
  handle: (req: IncomingMessage, res: ServerResponse, body?: unknown) => Promise<void>;
  close: () => Promise<void>;
}

export async function createMcp(
  store: ArtifactStore,
  opts: { publicBaseUrl: string; version: string },
): Promise<McpHandle> {
  const transports = new Map<string, StreamableHTTPServerTransport>();

  const urlFor = (id: string) => `${opts.publicBaseUrl}/a/${id}`;
  const toolUrl = (tool: string, params: Record<string, string>): string => {
    const url = new URL(`${opts.publicBaseUrl}/t/${tool}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return url.toString();
  };

  const buildServer = (): McpServer => {
    const server = new McpServer({
      name: "artifact-hub",
      version: opts.version,
    });

    server.registerTool(
      "artifact_create",
      {
        title: "Create artifact",
        description:
          "Upload a new artifact. kind must be one of: html (preferred for write-ups — supports layout, diagrams, interactivity), svg, mermaid, or code. Markdown is not accepted — use html instead so diagrams and structure ship with the prose. Same id overwrites and returns overwritten=true.",
        inputSchema: {
          kind: z.enum(CREATABLE_ARTIFACT_KINDS),
          title: z.string().min(1).max(200),
          content: z.string(),
          id: z.string().min(1).max(120).optional(),
          tags: z.array(z.string()).optional(),
          summary: z.string().max(500).optional(),
          language: z.string().max(40).optional(),
          source: z
            .object({
              agent: z.string().optional(),
              session: z.string().optional(),
            })
            .optional(),
        },
      },
      async (args) => {
        assertSize(args.content);
        const { meta, overwritten } = await store.create(args);
        const url = urlFor(meta.id);
        return {
          content: [
            {
              type: "text",
              text: `${overwritten ? "Overwrote" : "Created"} ${meta.id}\n${url}`,
            },
          ],
          structuredContent: { id: meta.id, url, overwritten },
        };
      },
    );

    server.registerTool(
      "artifact_update",
      {
        title: "Update artifact",
        description: "Patch fields and/or content of an existing artifact by id.",
        inputSchema: {
          id: z.string().min(1),
          content: z.string().optional(),
          title: z.string().min(1).max(200).optional(),
          tags: z.array(z.string()).optional(),
          summary: z.string().max(500).optional(),
          language: z.string().max(40).optional(),
        },
      },
      async (args) => {
        if (args.content !== undefined) assertSize(args.content);
        const meta = await store.update(args);
        const url = urlFor(meta.id);
        return {
          content: [{ type: "text", text: `Updated ${meta.id}\n${url}` }],
          structuredContent: { id: meta.id, url },
        };
      },
    );

    server.registerTool(
      "artifact_list",
      {
        title: "List artifacts",
        description: "List artifact metadata, newest first. Use filters to narrow.",
        inputSchema: {
          kind: z.enum(ARTIFACT_KINDS).optional(),
          tag: z.string().optional(),
          agent: z.string().optional(),
          limit: z.number().int().min(1).max(200).optional(),
          since: z.string().optional(),
        },
      },
      async (args) => {
        const items = store.list(args);
        const text =
          items.length === 0
            ? "(no artifacts)"
            : items.map((m) => `- ${m.id} [${m.kind}] ${m.title}`).join("\n");
        return {
          content: [{ type: "text", text }],
          structuredContent: { items },
        };
      },
    );

    server.registerTool(
      "artifact_get",
      {
        title: "Get artifact",
        description:
          "Fetch the full content and metadata for an artifact by id. Use this to inject prior research into your context.",
        inputSchema: { id: z.string().min(1) },
      },
      async ({ id }) => {
        const artifact = await store.get(id);
        if (!artifact) {
          return {
            content: [{ type: "text", text: `not found: ${id}` }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text", text: artifact.content }],
          structuredContent: { ...artifact },
        };
      },
    );

    server.registerTool(
      "tool_stl_view",
      {
        title: "STL Preview",
        description:
          "Return a browser URL that renders an STL model in 3D. Provide artifact_id (an existing artifact saved as kind=code, language=stl) or src (a URL the browser can fetch).",
        inputSchema: {
          artifact_id: z.string().min(1).optional(),
          src: z.string().min(1).optional(),
        },
      },
      async ({ artifact_id, src }) => {
        if (!artifact_id && !src) {
          return {
            content: [
              { type: "text", text: "either artifact_id or src is required" },
            ],
            isError: true,
          };
        }
        const params: Record<string, string> = artifact_id
          ? { artifact: artifact_id }
          : { src: src! };
        const url = toolUrl("stl", params);
        return {
          content: [{ type: "text", text: url }],
          structuredContent: { url },
        };
      },
    );

    server.registerTool(
      "artifact_search",
      {
        title: "Search artifacts",
        description:
          "Full-text search across title, summary, tags, and body. Returns ranked hits with snippets.",
        inputSchema: {
          query: z.string().min(1),
          kind: z.enum(ARTIFACT_KINDS).optional(),
          tag: z.string().optional(),
          limit: z.number().int().min(1).max(50).optional(),
        },
      },
      async (args) => {
        const hits = await store.search(args.query, args);
        const text =
          hits.length === 0
            ? "(no hits)"
            : hits
                .map(
                  (h) =>
                    `- ${h.meta.id} [${h.meta.kind}] ${h.meta.title}\n  ${h.snippet}`,
                )
                .join("\n");
        return {
          content: [{ type: "text", text }],
          structuredContent: { hits },
        };
      },
    );

    return server;
  };

  const handle = async (
    req: IncomingMessage,
    res: ServerResponse,
    body?: unknown,
  ): Promise<void> => {
    const sessionHeader = req.headers["mcp-session-id"];
    const sessionId = Array.isArray(sessionHeader) ? sessionHeader[0] : sessionHeader;

    let transport = sessionId ? transports.get(sessionId) : undefined;

    if (!transport) {
      if (req.method !== "POST" || !isInitializeRequest(body)) {
        res.statusCode = 400;
        res.setHeader("content-type", "application/json");
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: {
              code: -32000,
              message:
                "Bad Request: no valid session. Send an initialize request first.",
            },
            id: null,
          }),
        );
        return;
      }
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          transports.set(id, transport!);
        },
      });
      transport.onclose = () => {
        if (transport!.sessionId) transports.delete(transport!.sessionId);
      };
      const server = buildServer();
      await server.connect(transport);
    }

    await transport.handleRequest(req, res, body);
  };

  const close = async (): Promise<void> => {
    for (const t of transports.values()) {
      await t.close();
    }
    transports.clear();
  };

  return { handle, close };
}

function assertSize(content: string): void {
  const size = Buffer.byteLength(content, "utf8");
  if (size > MAX_CONTENT_BYTES) {
    throw new Error(
      `content too large: ${size} bytes (max ${MAX_CONTENT_BYTES})`,
    );
  }
}
