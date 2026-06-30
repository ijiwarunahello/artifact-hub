---
description: List recent artifacts from Artifact Hub
argument-hint: "[kind]"
---

Call the `artifact_list` MCP tool against the `artifact-hub` server.

If `$ARGUMENTS` is non-empty and matches one of `html|markdown|svg|mermaid|code`, pass it as `kind`. Otherwise pass no filter. Set `limit` to 20.

Render the response as a compact markdown table with columns: `id`, `kind`, `title`, `updatedAt`. If the MCP response includes a dashboard URL, print it; do not synthesize a URL in the command.
