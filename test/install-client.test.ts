import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, test } from "vitest";
import { rm } from "node:fs/promises";

const script = resolve(import.meta.dirname, "../scripts/install-client.sh");
const homes: string[] = [];

afterEach(async () => {
  await Promise.all(homes.splice(0).map((path) => rm(path, { recursive: true })));
});

async function makeHome(): Promise<string> {
  const home = await mkdtemp(join(tmpdir(), "artifact-hub-install-"));
  homes.push(home);
  return home;
}

function runInstaller(home: string, clientId: string, secret: string) {
  return spawnSync("bash", [script], {
    cwd: resolve(import.meta.dirname, ".."),
    env: { ...process.env, HOME: home, SHELL: "/bin/zsh" },
    input: `${clientId}\n${secret}\n`,
    encoding: "utf8",
  });
}

describe("Cloudflare Access credential setup", () => {
  test("writes both exports without replacing unrelated shell settings", async () => {
    const home = await makeHome();
    const envFile = join(home, ".zshenv");
    await writeFile(envFile, "export KEEP_ME=yes\n", "utf8");

    const result = runInstaller(home, "client-id.access", "top-secret");
    const contents = await readFile(envFile, "utf8");

    expect(result.status).toBe(0);
    expect(contents).toContain("export KEEP_ME=yes");
    expect(contents).toContain(
      "export ARTIFACT_HUB_ACCESS_CLIENT_ID='client-id.access'",
    );
    expect(contents).toContain(
      "export ARTIFACT_HUB_ACCESS_CLIENT_SECRET='top-secret'",
    );
  });

  test("updates existing values without creating duplicate exports", async () => {
    const home = await makeHome();

    expect(runInstaller(home, "old-id", "old-secret").status).toBe(0);
    expect(runInstaller(home, "new-id", "new-secret").status).toBe(0);

    const contents = await readFile(join(home, ".zshenv"), "utf8");
    expect(contents.match(/ARTIFACT_HUB_ACCESS_CLIENT_ID=/g)).toHaveLength(1);
    expect(contents.match(/ARTIFACT_HUB_ACCESS_CLIENT_SECRET=/g)).toHaveLength(1);
    expect(contents).toContain("'new-id'");
    expect(contents).toContain("'new-secret'");
    expect(contents).not.toContain("old-secret");
  });

  test("does not echo credentials to stdout or stderr", async () => {
    const home = await makeHome();
    const result = runInstaller(home, "private-client-id", "private-secret");
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status).toBe(0);
    expect(output).not.toContain("private-client-id");
    expect(output).not.toContain("private-secret");
  });

  test("rejects empty credentials without modifying the environment file", async () => {
    const home = await makeHome();
    const result = runInstaller(home, "", "");

    expect(result.status).not.toBe(0);
    await expect(readFile(join(home, ".zshenv"), "utf8")).rejects.toThrow();
  });
});
