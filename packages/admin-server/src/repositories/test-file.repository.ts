import type { EntityManager } from '@mikro-orm/mysql';
import { TestFile } from '../entities/test-file.entity';

export class TestFileRepository {
  constructor(private readonly em: EntityManager) {}

  async findByDeploymentId(deploymentId: string): Promise<TestFile[]> {
    return this.em.find(TestFile, { deployment: deploymentId }, { orderBy: { sourcePath: 'asc' } });
  }
}
