import type { AuditEvent } from "../domain/types";

export type PlatformEvent = AuditEvent;

type EventHandler = (event: PlatformEvent) => void | Promise<void>;

export class InMemoryEventBus {
  private readonly handlers = new Map<PlatformEvent["type"], EventHandler[]>();

  subscribe(type: PlatformEvent["type"], handler: EventHandler) {
    const current = this.handlers.get(type) ?? [];
    current.push(handler);
    this.handlers.set(type, current);
  }

  async publish(event: PlatformEvent) {
    const handlers = this.handlers.get(event.type) ?? [];
    await Promise.all(handlers.map((handler) => handler(event)));
  }
}
