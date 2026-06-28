---
description: Archive artifacts locally and delete from R2 to free storage
argument-hint: "<id | --old N | --large N>"
---

Archive one or more artifacts from R2 to `~/.artifact-hub/archive/`, then delete from R2.

Invoke the `storage-monitoring` skill, then follow its archive workflow.

Modes based on `$ARGUMENTS`:
- Single artifact id: archive that specific artifact
- `--old N`: archive the N oldest artifacts (by `createdAt`)
- `--large N`: archive the N largest artifacts (call `storage_stats` first to identify them)

After archiving, call `storage_stats` and display updated usage.
