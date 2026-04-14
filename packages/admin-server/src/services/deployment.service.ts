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
import { toDeploymentDto } from '../entities/deployment.mapper';
import { toTestFileDto } from '../entities/test-file.mapper';

export class DeploymentService {
  constructor(
    private readonly em: EntityManager,
    private readonly deploymentRepository: DeploymentRepository,
    private readonly testFileRepository: TestFileRepository,
    private readonly deployTrigger: DeployTrigger,
  ) {}

  async list(query: {
    status?: DeploymentStatus;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: DeploymentDto[]; total: number }> {
    const { items, total } = await this.deploymentRepository.list({
      status: query.status,
      page: query.page,
      pageSize: query.pageSize,
    });
    return { items: items.map(toDeploymentDto), total };
  }

  async getById(id: string): Promise<DeploymentDto> {
    const deployment = await this.deploymentRepository.findById(id);
    if (!deployment) throw new ApiError(404, `deployment ${id} not found`, 'not_found');
    return toDeploymentDto(deployment);
  }

  async create(dto: DeploymentCreateDto): Promise<DeploymentDto> {
    // Persist the deployment row first so the trigger failure leaves an auditable record.
    // `partial: true` opts into MikroORM v6's partial input since status/startedAt have runtime defaults.
    const deployment = this.em.create(Deployment, { gitRef: dto.gitRef }, { partial: true });
    await this.em.flush();
    await this.deployTrigger.trigger({ deploymentId: deployment.id, gitRef: deployment.gitRef });
    return toDeploymentDto(deployment);
  }

  async listTestFiles(deploymentId: string): Promise<TestFileDto[]> {
    const deployment = await this.deploymentRepository.findById(deploymentId);
    if (!deployment) throw new ApiError(404, `deployment ${deploymentId} not found`, 'not_found');
    const testFiles = await this.testFileRepository.findByDeploymentId(deploymentId);
    return testFiles.map(toTestFileDto);
  }
}
