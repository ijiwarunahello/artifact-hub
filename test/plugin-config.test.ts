import { access, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const root = resolve(import.meta.dirname, "..");
const pluginRoot = resolve(root, "clients/agent-plugin");
const workerMcpUrl = "https://artifact-hub.ijiwarunahello.workers.dev/mcp";

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(resolve(root, path), "utf8"));
}

async function markdownFiles(directory: string): Promise<string[]> {
  const entries = await readdir(resolve(root, directory), {
    recursive: true,
    withFileTypes: true,
  });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => resolve(entry.parentPath, entry.name));
}

describe("dual-platform plugin packaging", () => {
  test("both marketplaces point to the shared plugin", async () => {
    const claudeMarketplace = await readJson(".claude-plugin/marketplace.json");
    const codexMarketplace = await readJson(".agents/plugins/marketplace.json");

    expect(claudeMarketplace).toMatchObject({
      plugins: [{ name: "artifact-hub", source: "./clients/agent-plugin" }],
    });
    expect(codexMarketplace).toMatchObject({
      plugins: [
        {
          name: "artifact-hub",
          source: { source: "local", path: "./clients/agent-plugin" },
        },
      ],
    });
  });

  test("both plugin manifests and their referenced MCP files exist", async () => {
    const claudeManifest = await readJson(
      "clients/agent-plugin/.claude-plugin/plugin.json",
    );
    const codexManifest = await readJson(
      "clients/agent-plugin/.codex-plugin/plugin.json",
    );

    expect(claudeManifest).toMatchObject({ name: "artifact-hub" });
    expect(codexManifest).toMatchObject({
      name: "artifact-hub",
      mcpServers: "./codex.mcp.json",
    });
    await access(resolve(pluginRoot, ".mcp.json"));
    await access(resolve(pluginRoot, String(codexManifest.mcpServers).slice(2)));
  });

  test("Claude MCP config uses Workers and environment-expanded Access headers", async () => {
    const config = await readJson("clients/agent-plugin/.mcp.json");

    expect(config).toEqual({
      mcpServers: {
        "artifact-hub": {
          type: "http",
          url: workerMcpUrl,
          headers: {
            "CF-Access-Client-Id": "${ARTIFACT_HUB_ACCESS_CLIENT_ID}",
            "CF-Access-Client-Secret":
              "${ARTIFACT_HUB_ACCESS_CLIENT_SECRET}",
          },
        },
      },
    });
  });

  test("Codex MCP config maps Access headers to environment variable names", async () => {
    const config = await readJson("clients/agent-plugin/codex.mcp.json");

    expect(config).toEqual({
      mcp_servers: {
        "artifact-hub": {
          url: workerMcpUrl,
          env_http_headers: {
            "CF-Access-Client-Id": "ARTIFACT_HUB_ACCESS_CLIENT_ID",
            "CF-Access-Client-Secret": "ARTIFACT_HUB_ACCESS_CLIENT_SECRET",
          },
        },
      },
    });
  });

  test("user-facing plugin documentation has no legacy localhost setup", async () => {
    const files = [
      resolve(root, "README.md"),
      ...(await markdownFiles("clients/agent-plugin")),
    ];
    const contents = await Promise.all(files.map((file) => readFile(file, "utf8")));

    expect(contents.join("\n")).not.toContain("127.0.0.1:27183");
    await expect(access(resolve(root, "clients/codex"))).rejects.toThrow();
  });
});
