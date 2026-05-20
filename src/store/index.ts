import { promises as fs } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import {
  ARTIFACT_KINDS,
  Artifact,
  ArtifactKind,
  ArtifactMeta,
  CreateInput,
  KIND_EXTENSIONS,
  ListFilter,
  SearchHit,
  UpdateInput,
} from "../types/artifact.js";
import { buildId, slugify, todayPrefix } from "./slug.js";

export interface StoreOptions {
  rootDir?: string;
  now?: () => Date;
}

export type StoreEvent =
  | { type: "created"; meta: ArtifactMeta }
  | { type: "updated"; meta: ArtifactMeta };

export type StoreListener = (event: StoreEvent) => void;

const META_FILE = "meta.json";

export class ArtifactStore {
  readonly rootDir: string;
  private readonly artifactsDir: string;
  private readonly indexFile: string;
  private readonly now: () => Date;
  private readonly index = new Map<string, ArtifactMeta>();
  private readonly listeners = new Set<StoreListener>();
  private ready = false;

  constructor(options: StoreOptions = {}) {
    this.rootDir = options.rootDir ?? join(homedir(), ".artifact-hub");
    this.artifactsDir = join(this.rootDir, "artifacts");
    this.indexFile = join(this.rootDir, "index.json");
    this.now = options.now ?? (() => new Date());
  }

  async init(): Promise<void> {
    if (this.ready) return;
    await fs.mkdir(this.artifactsDir, { recursive: true });
    await this.rebuildIndex();
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
        console.error("[store] listener error", err);
      }
    }
  }

  private async rebuildIndex(): Promise<void> {
    this.index.clear();
    let entries: string[] = [];
    try {
      entries = await fs.readdir(this.artifactsDir);
    } catch {
      return;
    }
    for (const id of entries) {
      const metaPath = join(this.artifactsDir, id, META_FILE);
      try {
        const raw = await fs.readFile(metaPath, "utf8");
        const meta = JSON.parse(raw) as ArtifactMeta;
        this.index.set(meta.id, meta);
      } catch {
        // skip malformed
      }
    }
    await this.persistIndex();
  }

  private async persistIndex(): Promise<void> {
    const list = [...this.index.values()].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
    await fs.writeFile(this.indexFile, JSON.stringify(list, null, 2), "utf8");
  }

  private contentPath(meta: ArtifactMeta): string {
    const ext =
      meta.kind === "code" && meta.language
        ? safeExt(meta.language)
        : KIND_EXTENSIONS[meta.kind];
    return join(this.artifactsDir, meta.id, `content.${ext}`);
  }

  async create(input: CreateInput): Promise<{ meta: ArtifactMeta; overwritten: boolean }> {
    if (!ARTIFACT_KINDS.includes(input.kind)) {
      throw new Error(`unknown kind: ${input.kind}`);
    }
    const now = this.now();
    const isoNow = now.toISOString();
    const id = resolveId(input, this.index, now);
    const existing = this.index.get(id);
    const meta: ArtifactMeta = {
      id,
      title: input.title,
      kind: input.kind,
      language: input.language,
      tags: input.tags ?? [],
      source: input.source,
      summary: input.summary,
      createdAt: existing?.createdAt ?? isoNow,
      updatedAt: isoNow,
    };
    await this.writeArtifact(meta, input.content);
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
    const isoNow = this.now().toISOString();
    const meta: ArtifactMeta = {
      ...existing,
      title: input.title ?? existing.title,
      tags: input.tags ?? existing.tags,
      summary: input.summary ?? existing.summary,
      language: input.language ?? existing.language,
      source: input.source ?? existing.source,
      updatedAt: isoNow,
    };
    let content = input.content;
    if (content === undefined) {
      const current = await fs.readFile(this.contentPath(existing), "utf8");
      content = current;
    }
    if (meta.language !== existing.language || meta.kind !== existing.kind) {
      try {
        await fs.unlink(this.contentPath(existing));
      } catch {
        // ignore
      }
    }
    await this.writeArtifact(meta, content);
    this.index.set(meta.id, meta);
    await this.persistIndex();
    this.emit({ type: "updated", meta });
    return meta;
  }

  private async writeArtifact(meta: ArtifactMeta, content: string): Promise<void> {
    const dir = join(this.artifactsDir, meta.id);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(join(dir, META_FILE), JSON.stringify(meta, null, 2), "utf8");
    await fs.writeFile(this.contentPath(meta), content, "utf8");
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

  async get(id: string): Promise<Artifact | undefined> {
    const meta = this.index.get(id);
    if (!meta) return undefined;
    try {
      const content = await fs.readFile(this.contentPath(meta), "utf8");
      return { ...meta, content };
    } catch {
      return undefined;
    }
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
      const text = await fs.readFile(this.contentPath(meta), "utf8").catch(() => "");
      const haystack = [
        meta.title,
        meta.summary ?? "",
        meta.tags.join(" "),
        text,
      ].join("\n");
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

  metas(): ArtifactMeta[] {
    return [...this.index.values()];
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

function safeExt(language: string): string {
  return language.toLowerCase().replace(/[^a-z0-9.]+/g, "").slice(0, 10) || "txt";
}
