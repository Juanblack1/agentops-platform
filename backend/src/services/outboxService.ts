import type { Logger } from "pino";
import { ServiceBusClient } from "@azure/service-bus";
import type { OutboxMessage } from "../domain/types";
import { withSpan } from "../observability/tracing";
import { InMemoryStore } from "../repositories/inMemoryStore";

export interface OutboxPublisher {
  publish(message: OutboxMessage): Promise<void>;
}

export class LocalOutboxPublisher implements OutboxPublisher {
  constructor(private readonly logger: Logger) {}

  async publish(message: OutboxMessage) {
    this.logger.info(
      {
        outboxId: message.id,
        eventId: message.eventId,
        type: message.type
      },
      "outbox message dispatched locally"
    );
  }
}

export class ServiceBusOutboxPublisher implements OutboxPublisher {
  constructor(
    private readonly connectionString: string,
    private readonly topicName: string
  ) {}

  async publish(message: OutboxMessage) {
    const client = new ServiceBusClient(this.connectionString);
    const sender = client.createSender(this.topicName);

    try {
      await sender.sendMessages({
        messageId: message.id,
        subject: message.type,
        contentType: "application/json",
        body: message.payload,
        applicationProperties: {
          eventId: message.eventId,
          eventType: message.type,
          createdAt: message.createdAt
        }
      });
    } finally {
      await sender.close();
      await client.close();
    }
  }
}

export class OutboxService {
  constructor(
    private readonly store: InMemoryStore,
    private readonly publisher: OutboxPublisher
  ) {}

  async dispatchPending(limit = 25) {
    return withSpan("outbox.dispatch", { "outbox.limit": limit }, async (span) => {
      const pending = this.store.listPendingOutboxMessages().slice(0, limit);
      const delivered = [];
      const failed = [];
      span.setAttribute("outbox.pending_scanned", pending.length);

      for (const message of pending) {
        try {
          await this.publisher.publish(message);
          const updated = this.store.markOutboxDelivered(message.id);
          if (updated) delivered.push(updated);
        } catch (error) {
          const updated = this.store.markOutboxFailed(message.id, error instanceof Error ? error.message : "Unknown error");
          if (updated) failed.push(updated);
        }
      }

      span.setAttribute("outbox.delivered", delivered.length);
      span.setAttribute("outbox.failed", failed.length);
      return {
        scanned: pending.length,
        delivered,
        failed
      };
    });
  }
}
