import type { EntityManager } from '@mikro-orm/mysql';
import { TestCase } from '../entities/test-case.entity';

export interface ListTestCasesQuery {
  q?: string;
  tag?: string;
  page?: number;
  pageSize?: number;
}

export class TestCaseRepository {
  constructor(private readonly em: EntityManager) {}

  async listWithFilter(query: ListTestCasesQuery): Promise<{ items: TestCase[]; total: number }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where: Record<string, unknown> = {};
    if (query.q) {
      where.$or = [
        { id: { $like: `%${query.q}%` } },
        { name: { $like: `%${query.q}%` } },
      ];
    }
    if (query.tag) {
      // JSON `tags` filter uses a simple LIKE for the demo scope.
      // Production should use MySQL JSON_CONTAINS, but simplified here.
      where.tags = { $like: `%"${query.tag}"%` };
    }
    const [items, total] = await this.em.findAndCount(TestCase, where, {
      limit: pageSize,
      offset: (page - 1) * pageSize,
      orderBy: { id: 'asc' },
    });
    return { items, total };
  }

  async findById(id: string): Promise<TestCase | null> {
    return this.em.findOne(TestCase, { id });
  }

  async findByIds(ids: string[]): Promise<TestCase[]> {
    if (ids.length === 0) return [];
    return this.em.find(TestCase, { id: { $in: ids } });
  }
}
