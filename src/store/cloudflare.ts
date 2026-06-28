import {
  ARTIFACT_KINDS,
  type Artifact,
  type ArtifactKind,
  type ArtifactMeta,
  type CreateInput,
  type ListFilter,
  type SearchHit,
  type StorageStats,
  type UpdateInput,
} from "../types/artifact.js";
import type { IArtifactStore, StoreEvent, StoreListener } from "./interface.js";
import { buildId, slugify, todayPrefix } from "./slug.js";

export class CloudflareStore implements IArtifactStore {
  private readonly kv: KVNamespace;
  private readonly r2: R2Bucket;
  private readonly index = new Map<string, ArtifactMeta>();
  private readonly listeners = new Set<StoreListener>();
  private ready = false;

  constructor(kv: KVNamespace, r2: R2Bucket) {
    this.kv = kv;
    this.r2 = r2;
  }

  async init(): Promise<void> {
    if (this.ready) return;
    const raw = await this.kv.get("index");
    if (raw) {
      const metas = JSON.parse(raw) as ArtifactMeta[];
      for (const m of metas) this.index.set(m.id, m);
    }
    this.ready = true;
  }

  subscribe(listener: StoreListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: StoreEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error("[cloudflare-store] listener error", err);
      }
    }
  }

  private async persistIndex(): Promise<void> {
    const list = [...this.index.values()].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
    await this.kv.put("index", JSON.stringify(list));
    await this.kv.put("updated", new Date().toISOString());
  }

  async create(input: CreateInput): Promise<{ meta: ArtifactMeta; overwritten: boolean }> {
    if (!ARTIFACT_KINDS.includes(input.kind)) {
      throw new Error(`unknown kind: ${input.kind}`);
    }
    const now = new Date();
    const isoNow = now.toISOString();
    const id = resolveId(input, this.index, now);
    const existing = this.index.get(id);
    const contentBytes = new TextEncoder().encode(input.content).byteLength;
    const meta: ArtifactMeta = {
      id,
      title: input.title,
      kind: input.kind,
      language: input.language,
      tags: input.tags ?? [],
      source: input.source,
      summary: input.summary,
      contentBytes,
      createdAt: existing?.createdAt ?? isoNow,
      updatedAt: isoNow,
    };
    await this.r2.put(`content/${id}`, input.content);
    await this.kv.put(`meta:${id}`, JSON.stringify(meta));
    this.index.set(id, meta);
    await this.persistIndex();
    this.emit({ type: existing ? "updated" : "created", meta });
    return { meta, overwritten: Boolean(existing) };
  }

  async update(input: UpdateInput): Promise<ArtifactMeta> {
    const existing = this.index.get(input.id);
    if (!existing) {
      throw new Error(`artifact not found: ${input.id}`);
    }
    const isoNow = new Date().toISOString();
    const content = input.content ?? await this.readContent(input.id);
    const contentBytes = new TextEncoder().encode(content).byteLength;
    const meta: ArtifactMeta = {
      ...existing,
      title: input.title ?? existing.title,
      tags: input.tags ?? existing.tags,
      summary: input.summary ?? existing.summary,
      language: input.language ?? existing.language,
      source: input.source ?? existing.source,
      contentBytes,
      updatedAt: isoNow,
    };
    await this.r2.put(`content/${meta.id}`, content);
    await this.kv.put(`meta:${meta.id}`, JSON.stringify(meta));
    this.index.set(meta.id, meta);
    await this.persistIndex();
    this.emit({ type: "updated", meta });
    return meta;
  }

  async get(id: string): Promise<Artifact | undefined> {
    const meta = this.index.get(id);
    if (!meta) return undefined;
    const content = await this.readContent(id);
    return { ...meta, content };
  }

  list(filter: ListFilter = {}): ArtifactMeta[] {
    let items = [...this.index.values()];
    if (filter.kind) items = items.filter((m) => m.kind === filter.kind);
    if (filter.tag) items = items.filter((m) => m.tags.includes(filter.tag!));
    if (filter.agent) items = items.filter((m) => m.source?.agent === filter.agent);
    if (filter.since) {
      items = items.filter((m) => m.updatedAt > filter.since!);
    }
    items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (filter.limit && filter.limit > 0) items = items.slice(0, filter.limit);
    return items;
  }

  has(id: string): boolean {
    return this.index.has(id);
  }

  meta(id: string): ArtifactMeta | undefined {
    return this.index.get(id);
  }

  metas(): ArtifactMeta[] {
    return [...this.index.values()];
  }

  async search(
    query: string,
    opts: { kind?: ArtifactKind; tag?: string; limit?: number } = {},
  ): Promise<SearchHit[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const hits: SearchHit[] = [];
    const limit = opts.limit ?? 20;
    const candidates = this.list({ kind: opts.kind, tag: opts.tag });
    for (const meta of candidates) {
      const text = await this.readContent(meta.id).catch(() => "");
      const haystack = [meta.title, meta.summary ?? "", meta.tags.join(" "), text].join("\n");
      const idx = haystack.toLowerCase().indexOf(q);
      if (idx === -1) continue;
      const start = Math.max(0, idx - 60);
      const end = Math.min(haystack.length, idx + q.length + 60);
      const snippet = haystack.slice(start, end).replace(/\s+/g, " ").trim();
      hits.push({ meta, snippet });
      if (hits.length >= limit) break;
    }
    return hits;
  }

  async delete(id: string): Promise<void> {
    if (!this.index.has(id)) {
      throw new Error(`artifact not found: ${id}`);
    }
    await this.r2.delete(`content/${id}`);
    await this.kv.delete(`meta:${id}`);
    this.index.delete(id);
    await this.persistIndex();
    this.emit({ type: "deleted", id });
  }

  async storageStats(): Promise<StorageStats> {
    const artifacts: StorageStats["artifacts"] = [];
    let cursor: string | undefined;
    do {
      const result = await this.r2.list({ prefix: "content/", cursor, limit: 1000 });
      for (const obj of result.objects) {
        const id = obj.key.replace(/^content\//, "");
        artifacts.push({ id, bytes: obj.size, updatedAt: obj.uploaded.toISOString() });
      }
      cursor = result.truncated ? result.cursor : undefined;
    } while (cursor);
    artifacts.sort((a, b) => b.bytes - a.bytes);
    const totalBytes = artifacts.reduce((sum, a) => sum + a.bytes, 0);
    return { totalBytes, objectCount: artifacts.length, artifacts };
  }

  private async readContent(id: string): Promise<string> {
    const obj = await this.r2.get(`content/${id}`);
    if (!obj) return "";
    return await obj.text();
  }
}

function resolveId(
  input: CreateInput,
  index: Map<string, ArtifactMeta>,
  now: Date,
): string {
  if (input.id) {
    const cleaned = slugify(input.id, 80);
    if (!cleaned) {
      throw new Error("id must contain at least one alphanumeric character");
    }
    return cleaned;
  }
  const titleSlug = slugify(input.title, 60);
  const dated = `${todayPrefix(now)}-${titleSlug}`;
  if (!index.has(dated)) return dated;
  return buildId(input.title, new Set(index.keys()), now);
}
