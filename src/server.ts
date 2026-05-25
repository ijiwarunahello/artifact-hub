import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { promises as fs } from "node:fs";
import { WebSocketServer } from "ws";
import { ArtifactStore } from "./store/index.js";
import { EventBus } from "./bus/index.js";
import { createMcp } from "./mcp/index.js";
import { createHttpApp } from "./http/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const HOST = process.env.ARTIFACT_HUB_HOST ?? "127.0.0.1";
const PORT = Number(process.env.ARTIFACT_HUB_PORT ?? 27183);
const PUBLIC_HOST = process.env.ARTIFACT_HUB_PUBLIC_HOST ?? HOST;
const VERSION = await readPkgVersion();
const PUBLIC_BASE = `http://${PUBLIC_HOST}:${PORT}`;
const WEB_DIR = resolve(__dirname, "..", "dist", "web");

async function main() {
  const store = new ArtifactStore({
    rootDir: process.env.ARTIFACT_HUB_HOME,
  });
  await store.init();

  const bus = new EventBus();
  store.subscribe((e) => bus.emitArtifact(e));

  const mcp = await createMcp(store, {
    publicBaseUrl: PUBLIC_BASE,
    version: VERSION,
  });

  const honoApp = createHttpApp({ store, webDir: WEB_DIR, version: VERSION });

  const server = createServer(async (req, res) => {
    try {
      if (req.url && req.url.startsWith("/mcp")) {
        const body =
          req.method === "POST"
            ? await readJson(req).catch(() => undefined)
            : undefined;
        await mcp.handle(req, res, body);
        return;
      }
      await dispatchHono(honoApp, req, res);
    } catch (err) {
      console.error("[http] error", err);
      if (!res.headersSent) res.writeHead(500);
      res.end("internal error");
    }
  });

  const wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", (req, socket, head) => {
    if (!req.url || !req.url.startsWith("/ws")) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  const off = bus.onArtifact((event) => {
    const payload = JSON.stringify(event);
    for (const client of wss.clients) {
      if (client.readyState === client.OPEN) client.send(payload);
    }
  });

  server.listen(PORT, HOST, () => {
    console.log(`[artifact-hub] http://${HOST}:${PORT}  (storage: ${store.rootDir})`);
    console.log(`[artifact-hub] mcp endpoint: ${PUBLIC_BASE}/mcp`);
  });

  const shutdown = async (signal: string) => {
    console.log(`[artifact-hub] received ${signal}, shutting down…`);
    off();
    wss.close();
    server.close();
    await mcp.close();
    process.exit(0);
  };
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

async function dispatchHono(
  honoApp: import("hono").Hono,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = `${PUBLIC_BASE}${req.url ?? "/"}`;
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === "string") headers[k] = v;
    else if (Array.isArray(v)) headers[k] = v.join(", ");
  }
  const method = req.method ?? "GET";
  const body =
    method === "GET" || method === "HEAD"
      ? undefined
      : (await readBuffer(req)) as unknown as BodyInit;
  const response = await honoApp.fetch(
    new Request(url, { method, headers, body }),
  );
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  if (response.body) {
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) res.write(value);
    }
  }
  res.end();
}

async function readBuffer(req: IncomingMessage): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return new Uint8Array(Buffer.concat(chunks));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const buf = await readBuffer(req);
  if (buf.length === 0) return undefined;
  const text = Buffer.from(buf).toString("utf8");
  return JSON.parse(text);
}

async function readPkgVersion(): Promise<string> {
  try {
    const pkgPath = resolve(__dirname, "..", "package.json");
    const raw = await fs.readFile(pkgPath, "utf8");
    return JSON.parse(raw).version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

main().catch((err) => {
  console.error("[artifact-hub] fatal", err);
  process.exit(1);
});
