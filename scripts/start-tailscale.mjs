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
