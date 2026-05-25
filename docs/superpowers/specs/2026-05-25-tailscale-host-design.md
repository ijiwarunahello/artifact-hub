# Tailscale-bound startup mode

Date: 2026-05-25
Status: approved

## Goal

Let users start `artifact-hub` so the web UI is reachable from other devices
inside their Tailscale network (iPad, other laptops, phones) without exposing
the server to arbitrary LANs by configuration mistake.

Local MCP clients (Claude Code / Codex on the same machine) must keep working
unchanged.

## Non-goals

- Adding a CLI parser to `src/server.ts`.
- Filtering traffic to only the Tailscale interface (would require firewall
  rules or per-interface binding; out of scope).
- A `dev:tailscale` variant. Not requested; can be added later by copying the
  same wrapper pattern.

## Design

A thin Node wrapper script resolves the Tailscale IPv4 via the `tailscale` CLI,
prints the reachable tailnet URL, and spawns the existing server with
`ARTIFACT_HUB_HOST=0.0.0.0`. No source changes inside `src/`.

### New file: `scripts/start-tailscale.mjs`

Responsibilities:

1. Run `tailscale ip -4` via `child_process.spawnSync` (encoding `utf8`).
2. Error handling — exit `1` with a clear message in each case:
   - `ENOENT` (CLI not installed) → "`tailscale` command not found"
   - Non-zero status → print stderr trimmed
   - Empty stdout → "tailscale returned no IPv4"
3. Take the first non-empty line of stdout as the IP (Tailscale prints one IP
   per line; IPv4 first when `-4` is used).
4. Print `[start:tailscale] tailnet URL: http://<ip>:<port>/` using
   `ARTIFACT_HUB_PORT` or the default `27183`.
5. `spawn(process.execPath, ["dist/server.js"], { stdio: "inherit", env })` with
   `env.ARTIFACT_HUB_HOST = "0.0.0.0"` and
   `env.ARTIFACT_HUB_PUBLIC_HOST = <resolved Tailscale IP>` merged on top of
   `process.env` (so MCP `publicBaseUrl` becomes `http://<tailscale-ip>:PORT`
   and artifact dashboard URLs open from any tailnet device — local MCP
   clients on the host can also reach the server via the Tailscale IP).
6. Forward exit: if the child terminated by signal, re-raise the signal on the
   parent; otherwise `process.exit(code ?? 0)`.

### `package.json`

Add one script entry:

```json
"start:tailscale": "node scripts/start-tailscale.mjs"
```

### `README.md`

Add a short subsection after the existing Quickstart explaining the new script
and noting that the server binds to `0.0.0.0` in this mode (so any reachable
network can connect, not only Tailscale).

### `src/server.ts`

One small change: decouple the **bind host** from the **advertised host** so
the wrapper can set them independently.

Replace:

```ts
const HOST = process.env.ARTIFACT_HUB_HOST ?? "127.0.0.1";
const PORT = Number(process.env.ARTIFACT_HUB_PORT ?? 27183);
…
const PUBLIC_BASE = `http://${HOST}:${PORT}`;
```

with:

```ts
const HOST = process.env.ARTIFACT_HUB_HOST ?? "127.0.0.1";
const PORT = Number(process.env.ARTIFACT_HUB_PORT ?? 27183);
const PUBLIC_HOST = process.env.ARTIFACT_HUB_PUBLIC_HOST ?? HOST;
…
const PUBLIC_BASE = `http://${PUBLIC_HOST}:${PORT}`;
```

Default behavior is unchanged (when `ARTIFACT_HUB_PUBLIC_HOST` is unset,
`PUBLIC_HOST` mirrors `HOST` exactly as today). The tailscale wrapper sets
both env vars so that `HOST=0.0.0.0` (bind everywhere) and
`PUBLIC_HOST=<tailscale IP>` (advertise the tailnet-reachable URL).

## Data flow

```
npm run start:tailscale
  └─ node scripts/start-tailscale.mjs
       ├─ spawnSync("tailscale", ["ip", "-4"])
       │    ├─ fail → stderr + exit 1
       │    └─ ok   → ip = first IPv4 line
       ├─ console.log tailnet URL
       └─ spawn node dist/server.js
            (env: ARTIFACT_HUB_HOST=0.0.0.0,
                  ARTIFACT_HUB_PUBLIC_HOST=<tailscale IP>)
            └─ server listens on 0.0.0.0:PORT,
               MCP publicBaseUrl = http://<tailscale IP>:PORT
```

## Error cases

| Trigger | Behavior |
|---|---|
| `tailscale` not on PATH | print "command not found" hint, exit 1 |
| `tailscale ip -4` non-zero status | print stderr trimmed, exit 1 |
| empty stdout | print "no IPv4", exit 1 |
| `dist/server.js` exits | wrapper forwards exit code / signal |

## Testing

Manual verification only:

- `npm run build && npm run start:tailscale` on a Tailscale-connected machine →
  banner prints a `100.x.y.z` URL, web UI loads from another tailnet device.
- Same on a machine without `tailscale` installed → exit 1 with the missing
  command message.
- Same on a machine where Tailscale is installed but not signed in →
  `tailscale ip -4` returns non-zero; wrapper exits 1.

Automated tests are not included: the wrapper is a thin shell around an
external CLI, and meaningful tests would consist almost entirely of mocking
`child_process`.
