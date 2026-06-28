#!/usr/bin/env npx tsx
import { readdir, readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";

const ROOT = process.env.ARTIFACT_HUB_HOME ?? join(homedir(), ".artifact-hub");
const ARTIFACTS_DIR = join(ROOT, "artifacts");
const TMP = tmpdir();

async function kvPut(key: string, value: string): Promise<void> {
  const tmpFile = join(TMP, `kv-migrate-${Date.now()}.json`);
  await writeFile(tmpFile, value, "utf8");
  try {
    execSync(
      `npx wrangler kv key put --remote --binding=ARTIFACT_KV "${key}" --path="${tmpFile}"`,
      { stdio: "pipe" },
    );
  } finally {
    await unlink(tmpFile).catch(() => {});
  }
}

async function main() {
  const indexRaw = await readFile(join(ROOT, "index.json"), "utf8");
  const index = JSON.parse(indexRaw) as Array<{ id: string }>;

  console.log(`[migrate] found ${index.length} artifacts in ${ROOT}`);

  let uploaded = 0;

  for (const meta of index) {
    const dir = join(ARTIFACTS_DIR, meta.id);
    let files: string[];
    try {
      files = await readdir(dir);
    } catch {
      console.log(`  skip ${meta.id} (directory not found)`);
      continue;
    }

    const contentFile = files.find((f) => f.startsWith("content."));
    if (!contentFile) {
      console.log(`  skip ${meta.id} (no content file)`);
      continue;
    }

    const contentPath = join(dir, contentFile);
    const metaPath = join(dir, "meta.json");

    try {
      execSync(
        `npx wrangler r2 object put --remote "artifact-hub/content/${meta.id}" --file="${contentPath}"`,
        { stdio: "pipe" },
      );
    } catch (e) {
      console.error(`  R2 upload failed for ${meta.id}:`, (e as Error).message);
      continue;
    }

    try {
      const metaJson = await readFile(metaPath, "utf8");
      await kvPut(`meta:${meta.id}`, metaJson);
    } catch (e) {
      console.error(`  KV meta upload failed for ${meta.id}:`, (e as Error).message);
      continue;
    }

    uploaded++;
    if (uploaded % 10 === 0) console.log(`  ${uploaded}/${index.length} uploaded`);
  }

  console.log(`[migrate] uploading index (${index.length} entries)`);
  try {
    await kvPut("index", JSON.stringify(index));
    await kvPut("updated", new Date().toISOString());
  } catch (e) {
    console.error(`  index upload failed:`, (e as Error).message);
  }

  console.log(`[migrate] done. ${uploaded}/${index.length} artifacts uploaded.`);
}

main().catch((err) => {
  console.error("[migrate] fatal:", err);
  process.exit(1);
});
