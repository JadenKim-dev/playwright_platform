import type { EntityManager } from '@mikro-orm/mysql';
import { TestRunItem } from '../entities/test-run-item.entity.js';

export class TestRunItemRepository {
  constructor(private readonly em: EntityManager) {}

  async findByRunId(runId: string): Promise<TestRunItem[]> {
    return this.em.find(TestRunItem, { testRun: runId }, { populate: ['testCase', 'testFile'] });
  }

  async findByTestCaseId(testCaseId: string, limit = 50): Promise<TestRunItem[]> {
    return this.em.find(
      TestRunItem,
      { testCase: testCaseId },
      { limit, orderBy: { startedAt: 'desc' } },
    );
  }

  async findById(id: string): Promise<TestRunItem | null> {
    return this.em.findOne(TestRunItem, { id });
  }
}
