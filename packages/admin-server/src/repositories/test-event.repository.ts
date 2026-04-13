import type { EntityManager } from '@mikro-orm/mysql';
import type { ReporterEvent } from '@platform/shared';
import { TestEvent } from '../entities/test-event.entity.js';

export class TestEventRepository {
  constructor(private readonly em: EntityManager) {}

  async insertBatch(testRunId: string, events: ReporterEvent[]): Promise<void> {
    for (const event of events) {
      const entity = this.em.create(TestEvent, {
        testRun: testRunId,
        testRunItem: event.itemId,
        eventType: event.type,
        payload: event.payload as Record<string, unknown>,
        emittedAt: new Date(event.ts),
      });
      this.em.persist(entity);
    }
  }
}
