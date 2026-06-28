---
description: Delete an artifact from R2 storage permanently
argument-hint: "<id>"
---

Permanently delete an artifact without archiving.

1. Call `artifact_get` with `$ARGUMENTS` as the id to confirm it exists
2. Show the artifact title, kind, and id
3. Ask the user to confirm deletion
4. If confirmed, call `artifact_delete` on the `artifact-hub` server
5. Call `storage_stats` and display updated usage
