import { Entity, PrimaryKey, Property, ManyToOne, Enum, Index } from '@mikro-orm/core';
import { v4 as uuidv4 } from 'uuid';
import { RunItemStatus } from '@platform/shared';
import { TestRun } from './test-run.entity.js';
import { TestCase } from './test-case.entity.js';
import { TestFile } from './test-file.entity.js';

@Entity({ tableName: 'test_run_items' })
@Index({ properties: ['testRun'] })
@Index({ properties: ['testCase'] })
export class TestRunItem {
  @PrimaryKey({ type: 'string', length: 36 })
  id: string = uuidv4();

  @ManyToOne(() => TestRun, { fieldName: 'test_run_id', deleteRule: 'cascade' })
  testRun!: TestRun;

  @ManyToOne(() => TestCase, { fieldName: 'test_case_id', deleteRule: 'restrict' })
  testCase!: TestCase;

  @ManyToOne(() => TestFile, { fieldName: 'test_file_id', deleteRule: 'restrict' })
  testFile!: TestFile;

  @Enum({ items: () => Object.values(RunItemStatus), type: 'string' })
  status: RunItemStatus = RunItemStatus.Pending;

  @Property({ type: 'integer', nullable: true })
  durationMs: number | null = null;

  @Property({ type: 'text', nullable: true })
  errorMessage: string | null = null;

  @Property({ type: 'json' })
  paramsSnapshot: Record<string, unknown> = {};

  @Property({ type: 'json' })
  expectedSnapshot: Record<string, unknown> = {};

  @Property({ type: 'datetime', length: 3, nullable: true })
  startedAt: Date | null = null;

  @Property({ type: 'datetime', length: 3, nullable: true })
  finishedAt: Date | null = null;
}
