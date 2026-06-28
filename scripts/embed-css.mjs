#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require_ = createRequire(import.meta.url);
const hljsDir = dirname(require_.resolve("highlight.js/package.json"));

const light = readFileSync(resolve(hljsDir, "styles", "github.min.css"), "utf8");
const dark = readFileSync(resolve(hljsDir, "styles", "github-dark.min.css"), "utf8");

const out = `export const HLJS_LIGHT = ${JSON.stringify(light)};\nexport const HLJS_DARK = ${JSON.stringify(dark)};\n`;

const outPath = resolve(__dirname, "..", "src", "http", "render-css.generated.ts");
writeFileSync(outPath, out, "utf8");
console.log(`[embed-css] wrote ${outPath}`);
