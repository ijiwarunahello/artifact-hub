---
description: List recent artifacts from the local Artifact Hub
argument-hint: "[kind]"
---

Call the `artifact_list` MCP tool against the `artifact-hub` server.

If `$ARGUMENTS` is non-empty and matches one of `html|markdown|svg|mermaid|code`, pass it as `kind`. Otherwise pass no filter. Set `limit` to 20.

Render the response as a compact markdown table with columns: `id`, `kind`, `title`, `updatedAt`. Below the table, print the URL `http://127.0.0.1:27183/` so the user can open the dashboard in a browser.
