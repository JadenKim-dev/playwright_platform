import type { EntityManager } from '@mikro-orm/mysql';
import type { TestCaseDto, TestCasePatchDto } from '@platform/shared';
import type { TestCaseRepository } from '../repositories/test-case.repository';
import type { TestCaseMappingRepository } from '../repositories/test-case-mapping.repository';
import type { DeploymentRepository } from '../repositories/deployment.repository';
import { ApiError } from '../app/api/_lib/error-handler';
import { toTestCaseDto } from '../entities/test-case.mapper';

export interface TestCaseListParams {
  q?: string;
  tag?: string;
  activeOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export class TestCaseService {
  constructor(
    private readonly em: EntityManager,
    private readonly testCaseRepository: TestCaseRepository,
    private readonly testCaseMappingRepository: TestCaseMappingRepository,
    private readonly deploymentRepository: DeploymentRepository,
  ) {}

  async list(query: TestCaseListParams): Promise<{ items: TestCaseDto[]; total: number }> {
    const { items, total } = await this.testCaseRepository.listWithFilter({
      q: query.q,
      tag: query.tag,
      page: query.page,
      pageSize: query.pageSize,
    });
    const activeIds = await this.computeActiveIds();
    const mapped = items.map((entity) => toTestCaseDto(entity, activeIds.has(entity.id)));
    if (query.activeOnly) {
      const filtered = mapped.filter((dto) => dto.isActive);
      return { items: filtered, total: filtered.length };
    }
    return { items: mapped, total };
  }

  async getById(id: string): Promise<TestCaseDto> {
    const entity = await this.testCaseRepository.findById(id);
    if (!entity) throw new ApiError(404, `test case ${id} not found`, 'not_found');
    const activeIds = await this.computeActiveIds();
    return toTestCaseDto(entity, activeIds.has(id));
  }

  async patch(id: string, patch: TestCasePatchDto): Promise<TestCaseDto> {
    const entity = await this.testCaseRepository.findById(id);
    if (!entity) throw new ApiError(404, `test case ${id} not found`, 'not_found');
    if (patch.name !== undefined) entity.name = patch.name;
    if (patch.description !== undefined) entity.description = patch.description;
    if (patch.params !== undefined) entity.params = patch.params;
    if (patch.expected !== undefined) entity.expected = patch.expected;
    if (patch.tags !== undefined) entity.tags = patch.tags;
    await this.em.flush();
    const activeIds = await this.computeActiveIds();
    return toTestCaseDto(entity, activeIds.has(id));
  }

  async listRunnable(): Promise<TestCaseDto[]> {
    const latestDeployment = await this.deploymentRepository.findLatestSuccess();
    if (!latestDeployment) return [];
    const mappings = await this.testCaseMappingRepository.findByDeploymentId(latestDeployment.id);
    return mappings.map((mapping) => toTestCaseDto(mapping.testCase, true));
  }

  private async computeActiveIds(): Promise<Set<string>> {
    const latestDeployment = await this.deploymentRepository.findLatestSuccess();
    if (!latestDeployment) return new Set();
    const mappings = await this.testCaseMappingRepository.findByDeploymentId(latestDeployment.id);
    return new Set(mappings.map((mapping) => mapping.testCase.id));
  }
}
