---
description: Search artifacts by query and fetch the top match into context
argument-hint: "<query>"
---

The user gave the search query: `$ARGUMENTS`.

1. Call the `artifact_search` MCP tool on `artifact-hub` with `query = "$ARGUMENTS"` and `limit = 10`.
2. List the hits in chat as a numbered list (id, title, snippet).
3. If exactly one hit, immediately call `artifact_get` for it and inline the content so you can refer to it for the remainder of this conversation. If multiple, ask which id to load.
