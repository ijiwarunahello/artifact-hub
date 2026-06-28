#!/usr/bin/env npx tsx
import { readdir, readFile } from "node:fs/promises";
import { join, homedir } from "node:path";
import { execSync } from "node:child_process";

const ROOT = process.env.ARTIFACT_HUB_HOME ?? join(homedir(), ".artifact-hub");
const ARTIFACTS_DIR = join(ROOT, "artifacts");

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
        `npx wrangler r2 object put "artifact-hub/content/${meta.id}" --file="${contentPath}"`,
        { stdio: "pipe" },
      );
    } catch (e) {
      console.error(`  R2 upload failed for ${meta.id}:`, (e as Error).message);
      continue;
    }

    const metaJson = await readFile(metaPath, "utf8");
    try {
      execSync(
        `npx wrangler kv key put --binding=ARTIFACT_KV "meta:${meta.id}" --text='${metaJson.replace(/'/g, "'\\''")}'`,
        { stdio: "pipe" },
      );
    } catch (e) {
      console.error(`  KV meta upload failed for ${meta.id}:`, (e as Error).message);
      continue;
    }

    uploaded++;
    if (uploaded % 10 === 0) console.log(`  ${uploaded}/${index.length} uploaded`);
  }

  console.log(`[migrate] uploading index (${index.length} entries)`);
  const compactIndex = JSON.stringify(index);
  try {
    execSync(
      `npx wrangler kv key put --binding=ARTIFACT_KV "index" --text='${compactIndex.replace(/'/g, "'\\''")}'`,
      { stdio: "pipe" },
    );
    execSync(
      `npx wrangler kv key put --binding=ARTIFACT_KV "updated" --text='${new Date().toISOString()}'`,
      { stdio: "pipe" },
    );
  } catch (e) {
    console.error(`  index upload failed:`, (e as Error).message);
  }

  console.log(`[migrate] done. ${uploaded}/${index.length} artifacts uploaded.`);
}

main().catch((err) => {
  console.error("[migrate] fatal:", err);
  process.exit(1);
});
