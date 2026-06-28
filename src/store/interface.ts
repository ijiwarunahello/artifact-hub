import type {
  Artifact,
  ArtifactKind,
  ArtifactMeta,
  CreateInput,
  ListFilter,
  SearchHit,
  UpdateInput,
} from "../types/artifact.js";

export type StoreEvent =
  | { type: "created"; meta: ArtifactMeta }
  | { type: "updated"; meta: ArtifactMeta };

export type StoreListener = (event: StoreEvent) => void;

export interface IArtifactStore {
  init(): Promise<void>;
  subscribe(listener: StoreListener): () => void;
  create(input: CreateInput): Promise<{ meta: ArtifactMeta; overwritten: boolean }>;
  update(input: UpdateInput): Promise<ArtifactMeta>;
  get(id: string): Promise<Artifact | undefined>;
  list(filter?: ListFilter): ArtifactMeta[];
  has(id: string): boolean;
  meta(id: string): ArtifactMeta | undefined;
  metas(): ArtifactMeta[];
  search(
    query: string,
    opts?: { kind?: ArtifactKind; tag?: string; limit?: number },
  ): Promise<SearchHit[]>;
}
