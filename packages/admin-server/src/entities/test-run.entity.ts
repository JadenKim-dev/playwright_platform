import { Entity, PrimaryKey, Property, ManyToOne, Enum, Index } from '@mikro-orm/core';
import { v4 as uuidv4 } from 'uuid';
import { RunStatus } from '@platform/shared';
import { Deployment } from './deployment.entity.js';

@Entity({ tableName: 'test_runs' })
export class TestRun {
  @PrimaryKey({ type: 'string', length: 36 })
  id: string = uuidv4();

  @ManyToOne(() => Deployment, { fieldName: 'deployment_id', deleteRule: 'restrict' })
  deployment!: Deployment;

  @Property({ type: 'json' })
  requestedTestCaseIds: string[] = [];

  @Enum({ items: () => Object.values(RunStatus), type: 'string' })
  @Index()
  status: RunStatus = RunStatus.Queued;

  @Property({ type: 'datetime', length: 3, defaultRaw: 'CURRENT_TIMESTAMP(3)' })
  requestedAt: Date = new Date();

  @Property({ type: 'datetime', length: 3, nullable: true })
  startedAt: Date | null = null;

  @Property({ type: 'datetime', length: 3, nullable: true })
  finishedAt: Date | null = null;

  @Property({ type: 'string', length: 512, nullable: true })
  playwrightReportKey: string | null = null;
}
