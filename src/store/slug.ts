const ASCII_SAFE = /[^a-z0-9-]+/g;

function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

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
  return `untitled-${fnv1a(input)}`;
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
  return `${base}-${fnv1a(`${title}-${now.toISOString()}`)}`;
}
