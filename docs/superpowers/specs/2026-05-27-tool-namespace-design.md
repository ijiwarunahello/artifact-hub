# Tool namespace — STL preview prototype

## Context

artifact-hub stores "knowledge artifacts" — HTML/markdown/SVG/mermaid/code
outputs from agents — with persistence, search, and a list/detail Web UI.

Single-shot utilities (STL preview, JSON formatter, color picker, …) have a
different shape: they accept an input, render it once, and forget. Mixing them
into the artifact model would dilute the `kind` enum, inflate the search index,
and confuse the list/detail UX.

This spec introduces a `/t/<tool>` namespace served by the same process so the
two concerns share infrastructure (HTTP server, artifact store) without sharing
identity (URL space, storage, code path).

STL Preview is the first tool and the prototype for further additions.

## Architecture

```
artifact-hub server  (one process, one port — 27183)
├── /a/:id, /render/:id, /api/artifacts/*, /ws   ← artifact layer (unchanged)
└── /t/:tool                                     ← tool layer (new)
    └── /t/stl                                    ← STL preview
```

**Artifact layer** — persisted, searchable, listed in Web UI, indexed by id.

**Tool layer** — stateless, ephemeral, addressed by URL only. Tools may read
from the artifact store (read-only) but never write.

The two layers exchange data through a new read-only API:
`GET /api/artifacts/:id/content` returns the raw bytes of an artifact's
content file.

## Code layout

```
src/
├── http/
│   ├── index.ts          mounts /api/artifacts/:id/content + /t/*
│   ├── render.ts         unchanged (artifact rendering)
│   └── tools/
│       ├── index.ts      dispatcher (/t/:tool → ToolEntry.handler)
│       ├── registry.ts   ToolRegistry (Map<name, ToolEntry>)
│       └── stl/
│           ├── handler.ts  ToolDef + ToolHandler
│           └── viewer.ts   HTML template (three.js client)
├── mcp/
│   └── index.ts          adds tool_stl_view (artifact_* unchanged)
└── types/
    └── tool.ts           ToolDef, ToolHandler, ToolEntry
```

`ToolDef` is intentionally minimal: name, title, description, optional
`acceptsArtifact(meta)` predicate. The handler signature is
`(req: Request) => Response`. Tools never touch the store directly — they
serve HTML that the browser uses to call back into `/api/artifacts/.../content`.

## STL preview

- **Client**: three.js 0.160 via `unpkg` import map + `STLLoader` +
  `OrbitControls`. ASCII and binary STL both supported by the loader.
- **CSP**: same pattern as `render.ts` mermaid handling — `script-src 'self'
  'unsafe-inline' https://unpkg.com`.
- **Inputs**:
  - `?artifact=<id>` — viewer fetches `/api/artifacts/<id>/content`
  - `?src=<url>` — viewer fetches the URL directly (CORS on caller)
  - drag-drop file — `FileReader`, never leaves the browser
- **UX**: monochrome Swiss style — grey/white surface, single accent on
  the tool link, no emoji or animation. Title bar shows filename, vertex
  count, byte size.

## Artifact → tool linking

Artifact detail pages render a small "open in stl preview" link when the
artifact matches `kind = "code" && language = "stl"`. Implementation is a
client-side predicate in `web/src/main.ts::detectTools` — no server-side
discovery API. When more tools land, this predicate generalizes.

Binary STL → artifact storage is out of scope; today's artifact `kind` enum
covers text only. ASCII STL stored as `code, language=stl` is the supported
artifact form for the prototype.

## MCP

```
tool_stl_view({ artifact_id?, src? }) → { url }
```

Pure URL construction over `publicBaseUrl`. Naming convention
`tool_<name>_<verb>` mirrors `artifact_*` for parallel discoverability.

## Verification

- `pnpm typecheck` clean
- `pnpm test` — store/bus/slug/web-layout (existing) + http-content + tools
  (new) all green
- Dev server smoke: drag-drop, `?src`, `?artifact`, MCP roundtrip, artifact
  detail link

## Out of scope

- Binary STL as a first-class artifact kind
- `/t/` index page
- Dynamic `acceptsArtifact()` discovery via API
- Additional viewer/transform tools (OBJ, GLB, JSON formatter, …)
- Authentication beyond the existing loopback assumption
