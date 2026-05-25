export const ARTIFACT_KINDS = ["html", "markdown", "svg", "mermaid", "code"] as const;
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];

// Kinds that agents are allowed to publish via artifact_create.
// `markdown` is intentionally excluded — prefer `html` for write-ups so diagrams,
// layout, and interactivity can ship together. Existing markdown artifacts still
// load and render; only new creation is restricted.
export const CREATABLE_ARTIFACT_KINDS = ["html", "svg", "mermaid", "code"] as const;
export type CreatableArtifactKind = (typeof CREATABLE_ARTIFACT_KINDS)[number];

export interface ArtifactSource {
  agent?: string;
  session?: string;
}

export interface ArtifactMeta {
  id: string;
  title: string;
  kind: ArtifactKind;
  language?: string;
  tags: string[];
  source?: ArtifactSource;
  summary?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Artifact extends ArtifactMeta {
  content: string;
}

export interface CreateInput {
  kind: ArtifactKind;
  title: string;
  content: string;
  id?: string;
  tags?: string[];
  summary?: string;
  language?: string;
  source?: ArtifactSource;
}

export interface UpdateInput {
  id: string;
  content?: string;
  title?: string;
  tags?: string[];
  summary?: string;
  language?: string;
  source?: ArtifactSource;
}

export interface ListFilter {
  kind?: ArtifactKind;
  tag?: string;
  agent?: string;
  limit?: number;
  since?: string;
}

export interface SearchHit {
  meta: ArtifactMeta;
  snippet: string;
}

export const KIND_EXTENSIONS: Record<ArtifactKind, string> = {
  html: "html",
  markdown: "md",
  svg: "svg",
  mermaid: "mmd",
  code: "txt",
};
