# Codex usage guide: Artifact Hub

The MCP server `artifact_hub` (configured in `~/.codex/config.toml`) exposes a
shared artifact store at `http://127.0.0.1:27183`. Use it to:

- **Publish** durable outputs (research notes, HTML demos, runnable code) so the human
  can review them in a browser and other agents can reuse them across sessions.
- **Consume** prior outputs from yourself or other agents before starting new work.

## Tools

| Tool              | When to call                                                          |
|-------------------|-----------------------------------------------------------------------|
| `artifact_create` | After a research pass, demo build, or any output worth keeping.       |
| `artifact_update` | When iterating on the same artifact (reuse the same id).              |
| `artifact_list`   | To browse recent work, optionally filtered by kind/tag.               |
| `artifact_get`    | To pull a known artifact's full body into context.                    |
| `artifact_search` | First thing to try when starting a new topic.                         |

## Conventions

- Always set `source.agent = "codex"` and `source.session = <session>` on create.
- `kind` is one of `html | markdown | svg | mermaid | code`.
- Let the server derive the id from `title` unless you mean to overwrite an existing one.
- Tag artifacts with topic keywords; this is the primary discovery channel.

## When NOT to publish

Skip publishing for trivial answers, ephemeral debugging output, or code that already
lives in a real file in a project repo.
