import type { EntityManager } from '@mikro-orm/mysql';
import { TestRun } from '../entities/test-run.entity';

export class TestRunRepository {
  constructor(private readonly em: EntityManager) {}

  async list(query: { page?: number; pageSize?: number }) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const [items, total] = await this.em.findAndCount(
      TestRun,
      {},
      {
        limit: pageSize,
        offset: (page - 1) * pageSize,
        orderBy: { requestedAt: 'desc' },
      },
    );
    return { items, total };
  }

  async findById(id: string): Promise<TestRun | null> {
    return this.em.findOne(TestRun, { id });
  }

  async findByIds(ids: string[]): Promise<TestRun[]> {
    if (ids.length === 0) return [];
    return this.em.find(TestRun, { id: { $in: ids } });
  }
}
