import { Entity, PrimaryKey, Property, ManyToOne, Enum, Index } from '@mikro-orm/core';
import { ReporterEventType } from '@platform/shared';
import { TestRun } from './test-run.entity';
import { TestRunItem } from './test-run-item.entity';

@Entity({ tableName: 'test_events' })
@Index({ properties: ['testRun', 'id'] })
export class TestEvent {
  // MikroORM maps bigint to string in TS to avoid JS number precision issues.
  @PrimaryKey({ type: 'bigint', autoincrement: true })
  id!: string;

  @ManyToOne(() => TestRun, { fieldName: 'test_run_id', deleteRule: 'cascade' })
  testRun!: TestRun;

  // Nullable because some events (e.g., run-level stdout) may not tie to a specific item.
  @ManyToOne(() => TestRunItem, { fieldName: 'test_run_item_id', deleteRule: 'cascade', nullable: true })
  testRunItem: TestRunItem | null = null;

  @Enum({ items: () => Object.values(ReporterEventType), type: 'string' })
  eventType!: ReporterEventType;

  @Property({ type: 'json' })
  payload: Record<string, unknown> = {};

  @Property({ type: 'datetime', length: 3, defaultRaw: 'CURRENT_TIMESTAMP(3)' })
  emittedAt: Date = new Date();
}
