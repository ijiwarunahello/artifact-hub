import { createHash } from "node:crypto";

const ASCII_SAFE = /[^a-z0-9-]+/g;

export function slugify(input: string, maxLen = 40): string {
  const lower = input.toLowerCase().trim();
  const ascii = lower
    .replace(/[\s_]+/g, "-")
    .replace(ASCII_SAFE, "")
    .replace(/-{2,}/g, "-");
  const trimmed = ascii.replace(/^-+|-+$/g, "");
  if (trimmed.length > 0) {
    return trimmed.slice(0, maxLen);
  }
  const hash = createHash("sha1").update(input).digest("hex").slice(0, 8);
  return `untitled-${hash}`;
}

export function todayPrefix(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function buildId(title: string, existing: Set<string>, now: Date = new Date()): string {
  const base = `${todayPrefix(now)}-${slugify(title)}`;
  if (!existing.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`;
    if (!existing.has(candidate)) return candidate;
  }
  const hash = createHash("sha1").update(`${title}-${now.toISOString()}`).digest("hex").slice(0, 8);
  return `${base}-${hash}`;
}
