# Artifact Hub

Artifact Hub is a Cloudflare Workers MCP server and browser UI for sharing durable
research, demos, diagrams, and code between Claude Code, Codex, and humans.

## Architecture

```text
Claude Code / Codex ── Streamable HTTP MCP ──▶ Cloudflare Workers
                                                    │
                                                    ├── KV: metadata and index
                                                    ├── R2: artifact content
                                                    └── Static assets: Web UI
```

- Web UI: <https://artifact-hub.ijiwarunahello.workers.dev>
- MCP: `https://artifact-hub.ijiwarunahello.workers.dev/mcp`
- Authentication: Cloudflare Access Service Token
- Deployment: pushes to `main` deploy through GitHub Actions

## Install the agent plugin

The same plugin bundles the Artifact Hub skills and MCP connection for Claude
Code and Codex. Before installing it, create a Cloudflare Access Service Token
and include it in a `Service Auth` policy for the Artifact Hub Access
application.

### Claude Code

Inside Claude Code:

```text
/plugin marketplace add /absolute/path/to/artifact-hub
/plugin install artifact-hub@artifact-hub
```

### Codex

From a terminal:

```bash
codex plugin marketplace add /absolute/path/to/artifact-hub
```

Open `/plugins`, select the Artifact Hub marketplace, and install
`artifact-hub`.

### Configure Cloudflare Access credentials

After installing the plugin, run this script from the repository:

```bash
./scripts/install-client.sh
source ~/.zshenv
```

The script prompts for the Client ID and Client Secret without echoing the
secret, then maintains these variables in `~/.zshenv`:

```text
ARTIFACT_HUB_ACCESS_CLIENT_ID
ARTIFACT_HUB_ACCESS_CLIENT_SECRET
```

Restart Codex CLI after sourcing the file. For Codex app, add the same two
variables through Local Environments and start a new thread. For Claude Code,
run `/reload-plugins` or restart it. Confirm the connection by calling
`artifact_list`.

Do not commit Service Token values. The plugin contains only environment
variable references.

## Migrate an existing local installation

1. Remove the manually configured `[mcp_servers.artifact_hub]` block from
   `~/.codex/config.toml`; the Codex plugin now owns that MCP registration.
2. Disable or uninstall the old Claude Code plugin whose MCP endpoint points to
   localhost.
3. Install the dual-platform plugin and configure the Access variables as
   described above.
4. Restart both clients and verify `artifact_list`.

## MCP tools

| Tool | Purpose |
|---|---|
| `artifact_create` | Create or replace an artifact |
| `artifact_update` | Update an artifact |
| `artifact_list` | List artifact metadata |
| `artifact_get` | Fetch content and metadata |
| `artifact_search` | Search content |
| `storage_stats` | Inspect R2 usage |
| `artifact_delete` | Permanently delete an artifact |
| `tool_stl_view` | Build an STL preview URL |

## Development

Requirements: Node.js 20 or newer and a Cloudflare account configured for
Wrangler.

```bash
npm install
npm run dev
```

`wrangler dev` provides local KV and R2 emulation. Its data is separate from
the deployed Worker. Run the checks before deployment:

```bash
npm run typecheck
npm test
npm run build
```

Deploy manually with `npm run deploy`. To migrate legacy filesystem artifacts
to the remote KV/R2 resources, run `npx tsx scripts/migrate-data.ts`; its
Wrangler writes use `--remote`.

Cloudflare configuration lives in `wrangler.toml`. The `ARTIFACT_KV` binding
stores metadata and indexes, `ARTIFACT_R2` stores content, and
`PUBLIC_BASE_URL` supplies public artifact links.
