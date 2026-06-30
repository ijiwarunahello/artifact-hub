---
description: Load an artifact by id into context and print its dashboard URL
argument-hint: "<id>"
---

Argument: `$ARGUMENTS` (the artifact id).

1. Call `artifact_get` MCP tool on `artifact-hub` with `id = "$ARGUMENTS"`.
2. If found, summarize the metadata (kind, title, tags, updatedAt) in two short lines, then inline the full content into the conversation. Cite the id when referring to it later.
3. If the MCP response includes an artifact URL, print it. Do not synthesize a URL when the response does not provide one.
4. If not found, suggest running `/artifact-list` to discover ids.
