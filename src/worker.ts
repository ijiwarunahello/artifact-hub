import type { Env } from "./types/env.js";
import { CloudflareStore } from "./store/cloudflare.js";
import { createHttpApp } from "./http/index.js";
import { handleMcpRequest } from "./mcp/index.js";

const VERSION = "0.1.0";

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/mcp")) {
      const store = new CloudflareStore(env.ARTIFACT_KV, env.ARTIFACT_R2);
      await store.init();
      return handleMcpRequest(request, store, env.PUBLIC_BASE_URL, VERSION);
    }

    const store = new CloudflareStore(env.ARTIFACT_KV, env.ARTIFACT_R2);
    await store.init();
    const app = createHttpApp({ store, version: VERSION });
    return app.fetch(request, env, _ctx);
  },
};
