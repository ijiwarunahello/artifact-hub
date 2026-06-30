---
name: storage-monitoring
description: Use when managing Artifact Hub R2 storage — checking usage, identifying large artifacts, archiving old work locally, or cleaning up storage to stay under the 10 GB free tier. Also triggers when artifact_create fails with a storage limit error.
---

# Storage Monitoring

Artifact Hub runs on Cloudflare R2 Free Tier: **10 GB** storage, 1M Class A ops, 10M Class B ops per month.

## When to trigger

- User asks about storage usage, R2 limits, or disk space
- `artifact_create` fails with "R2 storage limit" error
- User requests artifact cleanup or archival
- During long sessions that create many artifacts (check proactively)

## Check storage

Call `storage_stats` on the `artifact-hub` MCP server (no parameters needed).

The response includes total bytes, object count, and per-artifact sizes sorted largest first.

### Action thresholds

| Usage | Action |
|-------|--------|
| < 60% | No action needed |
| 60-80% | Inform user of current usage |
| 80-95% | Warn user, suggest archiving old/large artifacts |
| > 95% | Urgent — archive and delete before creating more |

## Identify large artifacts

`storage_stats` returns artifacts sorted by size (largest first). Use the top entries to recommend archival candidates. Cross-reference with `artifact_list` to get titles and dates.

## Archive workflow

To archive an artifact locally before deleting from R2:

1. `artifact_get` — fetch full content and metadata
2. Create directory `~/.artifact-hub/archive/{id}/`
3. Write `meta.json` with the artifact metadata
4. Write `content.{ext}` with the content (use extension mapping below)
5. Append entry to `~/.artifact-hub/archive/manifest.json`
6. `artifact_delete` — remove from R2
7. Report freed space

### Extension mapping

| Kind | Extension |
|------|-----------|
| html | .html |
| markdown | .md |
| svg | .svg |
| mermaid | .mmd |
| code | use `language` field, fallback .txt |

### Manifest format

`~/.artifact-hub/archive/manifest.json` is a JSON array:

```json
[
  {
    "id": "2026-06-01-example",
    "title": "Example artifact",
    "kind": "html",
    "archivedAt": "2026-06-28T12:00:00.000Z",
    "bytes": 45321
  }
]
```

Read existing manifest before appending. Create the file if it does not exist.

## Delete without archive

Use `artifact_delete` directly only when the user explicitly confirms they do not need a local copy. Always confirm with the user before permanent deletion.
