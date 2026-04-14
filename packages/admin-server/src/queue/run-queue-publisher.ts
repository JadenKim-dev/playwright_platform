import type { RunItemExecuteMessage } from '@platform/shared';

export interface RunQueuePublisher {
  publish(message: RunItemExecuteMessage): Promise<void>;
}

/**
 * Used when the queue publisher is not connected. Keeps messages in memory so
 * tests can inspect them. Replaced by an amqplib-based implementation in Phase 3b.
 */
export class NoopRunQueuePublisher implements RunQueuePublisher {
  readonly published: RunItemExecuteMessage[] = [];

  async publish(message: RunItemExecuteMessage): Promise<void> {
    this.published.push(message);
  }
}
