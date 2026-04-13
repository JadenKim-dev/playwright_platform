import type { EntityManager } from '@mikro-orm/mysql';
import { DeploymentStatus } from '@platform/shared';
import { Deployment } from '../entities/deployment.entity.js';

export class DeploymentRepository {
  constructor(private readonly em: EntityManager) {}

  async list(query: { status?: DeploymentStatus; page?: number; pageSize?: number }) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    const [items, total] = await this.em.findAndCount(Deployment, where, {
      limit: pageSize,
      offset: (page - 1) * pageSize,
      orderBy: { startedAt: 'desc' },
    });
    return { items, total };
  }

  async findById(id: string): Promise<Deployment | null> {
    return this.em.findOne(Deployment, { id });
  }

  async findLatestSuccess(): Promise<Deployment | null> {
    return this.em.findOne(
      Deployment,
      { status: DeploymentStatus.Success },
      { orderBy: { finishedAt: 'desc' } },
    );
  }
}
