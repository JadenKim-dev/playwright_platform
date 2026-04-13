import type { EntityManager } from '@mikro-orm/mysql';
import type {
  DeploymentDto,
  DeploymentCreateDto,
  DeploymentStatus,
  TestFileDto,
} from '@platform/shared';
import { Deployment } from '../entities/deployment.entity';
import type { DeploymentRepository } from '../repositories/deployment.repository';
import type { TestFileRepository } from '../repositories/test-file.repository';
import type { DeployTrigger } from '../deploy/deploy-trigger';
import { ApiError } from '../app/api/_lib/error-handler';
import { toDeploymentDto, toTestFileDto } from './mappers';

export class DeploymentService {
  constructor(
    private readonly em: EntityManager,
    private readonly deployments: DeploymentRepository,
    private readonly files: TestFileRepository,
    private readonly trigger: DeployTrigger,
  ) {}

  async list(query: {
    status?: DeploymentStatus;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: DeploymentDto[]; total: number }> {
    const { items, total } = await this.deployments.list({
      status: query.status,
      page: query.page,
      pageSize: query.pageSize,
    });
    return { items: items.map(toDeploymentDto), total };
  }

  async getById(id: string): Promise<DeploymentDto> {
    const dep = await this.deployments.findById(id);
    if (!dep) throw new ApiError(404, `deployment ${id} not found`, 'not_found');
    return toDeploymentDto(dep);
  }

  async create(dto: DeploymentCreateDto): Promise<DeploymentDto> {
    // Persist the deployment row first so the trigger failure leaves an auditable record.
    // `partial: true` opts into MikroORM v6's partial input since status/startedAt have runtime defaults.
    const dep = this.em.create(Deployment, { gitRef: dto.gitRef }, { partial: true });
    await this.em.persistAndFlush(dep);
    await this.trigger.trigger({ deploymentId: dep.id, gitRef: dep.gitRef });
    return toDeploymentDto(dep);
  }

  async listTestFiles(deploymentId: string): Promise<TestFileDto[]> {
    const dep = await this.deployments.findById(deploymentId);
    if (!dep) throw new ApiError(404, `deployment ${deploymentId} not found`, 'not_found');
    const files = await this.files.findByDeploymentId(deploymentId);
    return files.map(toTestFileDto);
  }
}
