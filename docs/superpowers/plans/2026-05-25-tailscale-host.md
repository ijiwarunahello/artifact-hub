# Tailscale-bound Startup Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let `npm run start:tailscale` resolve the host's Tailscale IPv4, print a tailnet-reachable URL, and start the server bound to `0.0.0.0` with MCP `publicBaseUrl` advertising the Tailscale IP (so artifact dashboard URLs open from any tailnet device).

**Architecture:** A thin Node wrapper script (`scripts/start-tailscale.mjs`) shells out to `tailscale ip -4`, errors out if Tailscale isn't available, and spawns `node dist/server.js` with two env vars: `ARTIFACT_HUB_HOST=0.0.0.0` (bind) and `ARTIFACT_HUB_PUBLIC_HOST=<resolved tailscale IP>` (advertise). `src/server.ts` gets a 1-line change to split bind vs. advertise host.

**Tech Stack:** Node 20+, vitest, tsx, hono.

**Spec:** `docs/superpowers/specs/2026-05-25-tailscale-host-design.md`

---

### Task 1: Decouple bind host from advertised host in `src/server.ts`

**Files:**
- Modify: `src/server.ts:13-16`

Currently:

```ts
const HOST = process.env.ARTIFACT_HUB_HOST ?? "127.0.0.1";
const PORT = Number(process.env.ARTIFACT_HUB_PORT ?? 27183);
const VERSION = await readPkgVersion();
const PUBLIC_BASE = `http://${HOST}:${PORT}`;
```

`PUBLIC_BASE` is hardwired to the bind host, so binding to `0.0.0.0` would make MCP `publicBaseUrl` become `http://0.0.0.0:27183`. We need a separate `PUBLIC_HOST` that defaults to `HOST` (preserving current behavior) but can be overridden via env.

- [ ] **Step 1: Make the edit**

In `src/server.ts`, replace lines 13–16:

```ts
const HOST = process.env.ARTIFACT_HUB_HOST ?? "127.0.0.1";
const PORT = Number(process.env.ARTIFACT_HUB_PORT ?? 27183);
const VERSION = await readPkgVersion();
const PUBLIC_BASE = `http://${HOST}:${PORT}`;
```

with:

```ts
const HOST = process.env.ARTIFACT_HUB_HOST ?? "127.0.0.1";
const PORT = Number(process.env.ARTIFACT_HUB_PORT ?? 27183);
const PUBLIC_HOST = process.env.ARTIFACT_HUB_PUBLIC_HOST ?? HOST;
const VERSION = await readPkgVersion();
const PUBLIC_BASE = `http://${PUBLIC_HOST}:${PORT}`;
```

No other lines change. `PUBLIC_BASE` is still used by `createMcp({ publicBaseUrl: PUBLIC_BASE, ... })` and by the startup log.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exits 0 with no errors.

- [ ] **Step 3: Run the existing test suite (regression check)**

Run: `npm test`
Expected: all tests pass (existing `bus`, `slug`, `store`, `web-layout` tests).

- [ ] **Step 4: Manual smoke — default behavior unchanged**

Run: `npm run build && node dist/server.js &` then `curl -s http://127.0.0.1:27183/api/health`
Expected: `{"ok":true,...}`. Kill the process with `kill %1`.

This confirms that with no env vars set, server still binds to `127.0.0.1` and serves health.

- [ ] **Step 5: Manual smoke — override behavior works**

Run:

```bash
ARTIFACT_HUB_HOST=0.0.0.0 ARTIFACT_HUB_PUBLIC_HOST=127.0.0.1 node dist/server.js &
sleep 1
curl -s http://127.0.0.1:27183/api/version
kill %1
```

Expected: `{"name":"artifact-hub","version":"0.1.0"}` (server is reachable via 127.0.0.1 even though bound to 0.0.0.0; the startup log should print `http://0.0.0.0:27183`, and MCP publicBaseUrl should be `http://127.0.0.1:27183`). Confirm the startup log line reads `[artifact-hub] http://0.0.0.0:27183 (storage: …)` and `[artifact-hub] mcp endpoint: http://127.0.0.1:27183/mcp`.

- [ ] **Step 6: Commit**

```bash
git add src/server.ts
git commit -m "feat(server): split ARTIFACT_HUB_PUBLIC_HOST from bind host

Allows the bind host (HOST) and the host advertised to MCP clients
(PUBLIC_HOST) to differ — needed for the tailscale startup wrapper
which binds 0.0.0.0 but advertises 127.0.0.1."
```

---

### Task 2: Create the tailscale launcher script

**Files:**
- Create: `scripts/start-tailscale.mjs`

This is a Node ESM script (matches the project's `"type": "module"`). It runs `tailscale ip -4`, exits 1 on any failure with a clear message, then spawns the server with the right env.

- [ ] **Step 1: Write the script**

Create `scripts/start-tailscale.mjs`:

```js
#!/usr/bin/env node
import { spawnSync, spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const serverEntry = resolve(repoRoot, "dist", "server.js");

const result = spawnSync("tailscale", ["ip", "-4"], { encoding: "utf8" });

if (result.error && result.error.code === "ENOENT") {
  console.error(
    "[start:tailscale] `tailscale` command not found. Install Tailscale and ensure it is on PATH.",
  );
  process.exit(1);
}
if (result.error) {
  console.error("[start:tailscale] failed to invoke tailscale:", result.error.message);
  process.exit(1);
}
if (result.status !== 0) {
  const stderr = (result.stderr ?? "").trim();
  console.error("[start:tailscale] `tailscale ip -4` exited with", result.status);
  if (stderr) console.error(stderr);
  process.exit(1);
}

const ip = (result.stdout ?? "")
  .split(/\r?\n/)
  .map((s) => s.trim())
  .find((s) => s.length > 0);

if (!ip) {
  console.error("[start:tailscale] tailscale returned no IPv4 address");
  process.exit(1);
}

const port = process.env.ARTIFACT_HUB_PORT ?? "27183";
console.log(`[start:tailscale] tailnet URL: http://${ip}:${port}/`);

const env = {
  ...process.env,
  ARTIFACT_HUB_HOST: "0.0.0.0",
  ARTIFACT_HUB_PUBLIC_HOST: ip,
};

const child = spawn(process.execPath, [serverEntry], {
  stdio: "inherit",
  env,
});

const forward = (sig) => {
  if (!child.killed) child.kill(sig);
};
process.on("SIGINT", () => forward("SIGINT"));
process.on("SIGTERM", () => forward("SIGTERM"));

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
```

- [ ] **Step 2: Verify the script parses**

Run: `node --check scripts/start-tailscale.mjs`
Expected: exits 0 with no output (syntax OK).

- [ ] **Step 3: Manual smoke — missing-tailscale path**

Temporarily shadow `tailscale` with an empty PATH and confirm the script exits cleanly:

```bash
env -i PATH=/usr/bin:/bin node scripts/start-tailscale.mjs
echo "exit: $?"
```

Expected: stderr line containing `tailscale\` command not found`, then `exit: 1`.

(If `tailscale` happens to live under `/usr/bin` on this machine, replace `PATH=/usr/bin:/bin` with a directory you control that does not contain it, e.g. `PATH=/tmp`.)

- [ ] **Step 4: Manual smoke — happy path (only if tailscale is installed)**

```bash
npm run build
node scripts/start-tailscale.mjs &
sleep 1
curl -s http://127.0.0.1:27183/api/health
kill %1
```

Expected: a `[start:tailscale] tailnet URL: http://100.x.y.z:27183/` line appears, then `[artifact-hub] http://0.0.0.0:27183 …`, then the curl returns `{"ok":true,...}`.

If Tailscale is not installed/up on this dev box, skip this step and document that manual verification will happen on a Tailscale-connected machine.

- [ ] **Step 5: Commit**

```bash
git add scripts/start-tailscale.mjs
git commit -m "feat(scripts): add start-tailscale wrapper

Resolves the host's Tailscale IPv4 via the tailscale CLI, logs a
tailnet-reachable URL, and spawns dist/server.js with HOST=0.0.0.0
and PUBLIC_HOST=127.0.0.1. Exits 1 if Tailscale isn't installed,
not running, or returns no IPv4."
```

---

### Task 3: Wire up the npm script

**Files:**
- Modify: `package.json:7-16` (the `scripts` block)

- [ ] **Step 1: Add the script entry**

In `package.json`, locate:

```json
"start": "node dist/server.js",
```

Add immediately after it:

```json
"start:tailscale": "node scripts/start-tailscale.mjs",
```

Final `scripts` block should read:

```json
"scripts": {
  "build:server": "tsc -p tsconfig.json",
  "build:web": "vite build",
  "build": "npm run build:server && npm run build:web",
  "dev": "tsx watch src/server.ts",
  "start": "node dist/server.js",
  "start:tailscale": "node scripts/start-tailscale.mjs",
  "test": "vitest run",
  "test:watch": "vitest",
  "typecheck": "tsc -p tsconfig.json --noEmit"
}
```

- [ ] **Step 2: Verify npm picks it up**

Run: `npm run` (no args — lists available scripts).
Expected: output includes `start:tailscale` and `node scripts/start-tailscale.mjs`.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add npm run start:tailscale"
```

---

### Task 4: Document in README

**Files:**
- Modify: `README.md` (insert after the Quickstart block ending around line 46)

- [ ] **Step 1: Insert the new subsection**

In `README.md`, find the existing Quickstart section:

```
## Quickstart

\`\`\`bash
npm install
npm run build
npm start
# open http://127.0.0.1:27183/
\`\`\`

For development:

\`\`\`bash
npm run dev       # server with watch
npm run build:web # rebuild UI bundle
\`\`\`
```

Immediately after that block (before `## Installing the agent clients`), insert:

```markdown
### Sharing over Tailscale

To make the web UI reachable from other devices on your tailnet:

\`\`\`bash
npm run build
npm run start:tailscale
\`\`\`

This resolves the host's Tailscale IPv4 (via `tailscale ip -4`), prints a
tailnet URL like `http://100.x.y.z:27183/`, and binds the server to `0.0.0.0`.
The MCP `publicBaseUrl` is set to the Tailscale IP, so artifact dashboard URLs
returned by MCP tools open from any tailnet device (and still work locally on
the host because the Tailscale IP is reachable from the host itself).

Requirements:
- The `tailscale` CLI must be on PATH and signed in. The script exits with
  status 1 if Tailscale is not installed or not connected.

> **Heads up:** binding to `0.0.0.0` also exposes the server to any other
> network the machine is on (LAN, etc.), not only Tailscale. If that matters,
> use a firewall or stick with the default `npm start`.
```

- [ ] **Step 2: Eyeball the rendered structure**

Run: `grep -n "^##" README.md`
Expected: shows the section headings in order, with `### Sharing over Tailscale` appearing between Quickstart and `## Installing the agent clients`.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document npm run start:tailscale"
```

---

### Task 5: Final verification

- [ ] **Step 1: Full build + tests**

Run: `npm run build && npm run typecheck && npm test`
Expected: all three exit 0.

- [ ] **Step 2: Default startup still works**

```bash
node dist/server.js &
sleep 1
curl -s http://127.0.0.1:27183/api/health
kill %1
```

Expected: `{"ok":true,...}`.

- [ ] **Step 3: Tailscale startup works (if available on this machine)**

```bash
node scripts/start-tailscale.mjs &
sleep 1
curl -s http://127.0.0.1:27183/api/health
kill %1
```

Expected: tailnet URL log line, then health responds. If Tailscale isn't on
this machine, note the limitation and verify manually on a Tailscale-connected
box before declaring done.

- [ ] **Step 4: Confirm clean git state**

Run: `git status`
Expected: only the in-progress files from this plan are staged/changed (nothing unexpected).

---

## Self-review notes (already applied)

- **Spec coverage:** Tasks 1 (server.ts split), 2 (wrapper script), 3 (npm script), 4 (README) cover every section of `2026-05-25-tailscale-host-design.md`. The spec's "no automated tests" decision is honored — Task 2 manually verifies the missing-tailscale path instead.
- **Type consistency:** env var names used across tasks: `ARTIFACT_HUB_HOST`, `ARTIFACT_HUB_PUBLIC_HOST`, `ARTIFACT_HUB_PORT` — consistent.
- **Placeholder scan:** no TBDs, every code-changing step contains the exact code.
