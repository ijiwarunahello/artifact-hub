---
name: using-artifact-hub
description: Use when you finish meaningful research, build a runnable HTML demo, or want to share output with another agent or with the human across sessions — publishes the result to the local Artifact Hub MCP server so a human can view it in a browser and other agents can fetch it later.
---

# Using Artifact Hub

The Artifact Hub is a local always-on MCP server at `http://127.0.0.1:27183`. It stores
"artifacts" — durable, addressable pieces of agent output — and pushes new ones live to
a browser dashboard the human keeps open.

## When to publish

Publish (`artifact_create`) when:

- You finish a research pass and the report would be lost otherwise
- You build an interactive HTML/SVG demo the human should be able to interact with
- You produce a piece of code worth highlighting (configs, scripts, snippets)
- Another agent is likely to want this output later

Skip publishing for: trivial answers, single-shot questions, ephemeral debug output, code
that already lives in a real file in a repo.

## When to consume

Before starting a new research task, call `artifact_search` with a couple of likely
keywords. If a prior pass already covered the topic, call `artifact_get` and treat that
content as authoritative context — do not redo the same work.

Use `artifact_list` to browse what is available when you don't yet have a query.

## Tool quick reference

| Tool              | When to use                                                                    |
|-------------------|---------------------------------------------------------------------------------|
| `artifact_create` | After finishing research / building a demo. Set `kind` to one of html/markdown/svg/mermaid/code. Always set `title` and `summary`. Tag with topical keywords. |
| `artifact_update` | When iterating on the same artifact across multiple turns. Reuse the same id.   |
| `artifact_list`   | To browse recent work, optionally filtered by `kind` or `tag`.                  |
| `artifact_get`    | To pull a known artifact's full body into your context.                         |
| `artifact_search` | First step when starting a new topic — check whether prior art already exists.  |

## id conventions

- Let the server generate the id from `title` when you have no opinion (it produces `YYYY-MM-DD-slug`).
- Pass an explicit `id` only when you intend to overwrite a known artifact.

## Source attribution

Set `source.agent = "claude-code"` and `source.session = <your session id>` on every
`artifact_create` so the human and other agents can tell who produced what.
