import type { ToolDef, ToolEntry, ToolHandler } from "../../types/tool.js";

export class ToolRegistry {
  private readonly tools = new Map<string, ToolEntry>();

  register(def: ToolDef, handler: ToolHandler): void {
    this.tools.set(def.name, { def, handler });
  }

  get(name: string): ToolEntry | undefined {
    return this.tools.get(name);
  }

  list(): ToolDef[] {
    return [...this.tools.values()].map((e) => e.def);
  }
}
