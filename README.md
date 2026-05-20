# Artifact Hub

Local MCP/Web server that lets Claude Code, Codex, and other agents share research,
analysis, and code outputs as live "artifacts" — and lets a human watch and learn
from those outputs in a browser as they land.

## What is an artifact?

A single addressable unit of agent output:

- `html` — interactive page, rendered in a sandboxed iframe
- `markdown` — rich text doc with code fences (highlighted)
- `svg` — vector diagram
- `mermaid` — diagram source rendered client-side
- `code` — syntax-highlighted source file

Each artifact has `id`, `title`, `tags`, `summary`, and a content body. Stored as
files under `~/.artifact-hub/artifacts/<id>/`.

## Architecture

```
agents (Claude Code / Codex) ──MCP──▶ Artifact Hub (Node)
                                          │
                                          └──WebSocket──▶ Browser (human)
```

- **MCP** over Streamable HTTP at `http://127.0.0.1:27183/mcp`
- **Web UI** at `http://127.0.0.1:27183/`
- **Storage** at `~/.artifact-hub/`

## Quickstart

```bash
npm install
npm run build
npm start
# open http://127.0.0.1:27183/
```

For development:

```bash
npm run dev       # server with watch
npm run build:web # rebuild UI bundle
```

## Installing the agent clients

### Claude Code

```bash
./scripts/install-client.sh claude-code
# then inside Claude Code:
#   /plugin marketplace add ~/.claude/plugins/marketplaces/artifact-hub
#   /plugin install artifact-hub@artifact-hub
```

### Codex

```bash
./scripts/install-client.sh codex
# this appends [mcp_servers.artifact_hub] to ~/.codex/config.toml
```

## MCP tool surface

| Tool              | Purpose                                                |
|-------------------|--------------------------------------------------------|
| `artifact_create` | Upload a new artifact (or overwrite by id)             |
| `artifact_update` | Patch fields/content of an existing artifact           |
| `artifact_list`   | Lightweight metadata listing with filters              |
| `artifact_get`    | Fetch full content for context injection               |
| `artifact_search` | Full-text search with snippet                          |

There is no delete tool. Remove artifacts manually with
`rm -rf ~/.artifact-hub/artifacts/<id>` and restart the server.

## Running as a LaunchAgent

```bash
./scripts/install-launchagent.sh
launchctl load ~/Library/LaunchAgents/com.ijiwarunahello.artifact-hub.plist
```
