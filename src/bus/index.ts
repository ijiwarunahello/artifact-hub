import { EventEmitter } from "node:events";
import type { StoreEvent } from "../store/index.js";

type EventMap = {
  artifact: [StoreEvent];
};

export class EventBus extends EventEmitter {
  emitArtifact(event: StoreEvent): void {
    this.emit("artifact", event);
  }

  onArtifact(listener: (event: StoreEvent) => void): () => void {
    this.on("artifact", listener);
    return () => this.off("artifact", listener);
  }
}

export type { EventMap };
