import type { EntityManager } from '@mikro-orm/mysql';
import { TestCaseMapping } from '../entities/test-case-mapping.entity';

export class TestCaseMappingRepository {
  constructor(private readonly em: EntityManager) {}

  async findByDeploymentId(deploymentId: string): Promise<TestCaseMapping[]> {
    return this.em.find(
      TestCaseMapping,
      { deployment: deploymentId },
      { populate: ['testCase', 'testFile'] },
    );
  }

  async findByDeploymentAndTcs(deploymentId: string, tcIds: string[]): Promise<TestCaseMapping[]> {
    if (tcIds.length === 0) return [];
    return this.em.find(
      TestCaseMapping,
      { deployment: deploymentId, testCase: { $in: tcIds } },
      { populate: ['testCase', 'testFile'] },
    );
  }
}
