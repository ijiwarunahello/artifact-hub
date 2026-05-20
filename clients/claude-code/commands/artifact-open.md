---
description: Load an artifact by id into context and print its dashboard URL
argument-hint: "<id>"
---

Argument: `$ARGUMENTS` (the artifact id).

1. Call `artifact_get` MCP tool on `artifact-hub` with `id = "$ARGUMENTS"`.
2. If found, summarize the metadata (kind, title, tags, updatedAt) in two short lines, then inline the full content into the conversation. Cite the id when referring to it later.
3. Print the URL `http://127.0.0.1:27183/render/$ARGUMENTS` and tell the user they can open it in a browser to see the rendered artifact.
4. If not found, suggest running `/artifact-list` to discover ids.
