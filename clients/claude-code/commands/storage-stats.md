---
description: Show R2 storage usage for Artifact Hub
---

Call the `storage_stats` MCP tool against the `artifact-hub` server.

Display the result as a formatted summary:
- Total storage used (MB) and percentage of 10 GB free tier
- Number of stored objects
- Top 10 largest artifacts with their sizes
- Warning if usage exceeds 80%
