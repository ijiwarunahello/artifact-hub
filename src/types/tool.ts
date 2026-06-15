import type { ArtifactMeta } from "./artifact.js";

export interface ToolDef {
  /** URL segment, e.g. "stl" → exposed at /t/stl */
  name: string;
  title: string;
  description: string;
  /** Optional predicate used to surface "Open with…" links from artifacts. */
  acceptsArtifact?: (meta: ArtifactMeta) => boolean;
}

export type ToolHandler = (req: Request) => Response | Promise<Response>;

export interface ToolEntry {
  def: ToolDef;
  handler: ToolHandler;
}
