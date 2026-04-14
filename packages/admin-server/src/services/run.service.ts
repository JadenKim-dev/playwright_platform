import type { EntityManager } from '@mikro-orm/mysql';
import {
  RunStatus,
  RunItemStatus,
  type RunDto,
  type RunItemDto,
  type RunCreateDto,
  type RunItemExecuteMessage,
} from '@platform/shared';
import { TestRun } from '../entities/test-run.entity';
import { TestRunItem } from '../entities/test-run-item.entity';
import type { DeploymentRepository } from '../repositories/deployment.repository';
import type { TestCaseRepository } from '../repositories/test-case.repository';
import type { TestCaseMappingRepository } from '../repositories/test-case-mapping.repository';
import type { TestRunRepository } from '../repositories/test-run.repository';
import type { TestRunItemRepository } from '../repositories/test-run-item.repository';
import type { RunQueuePublisher } from '../queue/run-queue-publisher';
import type { ObjectStorageClient } from '../storage/object-storage-client';
import { ApiError } from '../app/api/_lib/error-handler';
import { toRunDto, toRunItemDto } from './mappers';

// Presigned report URLs stay valid long enough for the UI to open the report
// without being so long that a leaked URL is a durable hazard.
const REPORT_URL_TTL_SECONDS = 60 * 10;

export class RunService {
  constructor(
    private readonly em: EntityManager,
    private readonly deploymentRepository: DeploymentRepository,
    private readonly testCaseRepository: TestCaseRepository,
    private readonly testCaseMappingRepository: TestCaseMappingRepository,
    private readonly testRunRepository: TestRunRepository,
    private readonly testRunItemRepository: TestRunItemRepository,
    private readonly runQueuePublisher: RunQueuePublisher,
    private readonly objectStorageClient: ObjectStorageClient,
    private readonly adminBaseUrl: string,
  ) {}

  async create(dto: RunCreateDto): Promise<RunDto> {
    if (dto.testCaseIds.length === 0) {
      throw new ApiError(400, 'testCaseIds must not be empty', 'invalid_input');
    }

    // Spec §6.2: a run always executes against the latest successful deployment
    // so the bundle key and TC mapping line up with what worker nodes can fetch.
    const dep = await this.deploymentRepository.findLatestSuccess();
    if (!dep) {
      throw new ApiError(409, 'no successful deployment available', 'no_deployment');
    }

    const tcs = await this.testCaseRepository.findByIds(dto.testCaseIds);
    const tcById = new Map(tcs.map((t) => [t.id, t]));
    const missingTcs = dto.testCaseIds.filter((id) => !tcById.has(id));
    if (missingTcs.length > 0) {
      throw new ApiError(400, `unknown test cases: ${missingTcs.join(',')}`, 'unknown_tc');
    }

    const mappings = await this.testCaseMappingRepository.findByDeploymentAndTcs(
      dep.id,
      dto.testCaseIds,
    );
    const mapByTc = new Map(mappings.map((m) => [m.testCase.id, m]));
    const unmapped = dto.testCaseIds.filter((id) => !mapByTc.has(id));
    if (unmapped.length > 0) {
      throw new ApiError(
        400,
        `not mapped in current deployment: ${unmapped.join(',')}`,
        'unmapped_tc',
      );
    }

    // `partial: true` opts into MikroORM v6's partial input: id / requestedAt /
    // status all have runtime defaults on the entity.
    const run = this.em.create(
      TestRun,
      {
        deployment: dep,
        requestedTestCaseIds: [...dto.testCaseIds],
        status: RunStatus.Queued,
      },
      { partial: true },
    );
    this.em.persist(run);

    const items: TestRunItem[] = [];
    for (const tcId of dto.testCaseIds) {
      const mapping = mapByTc.get(tcId)!;
      const tc = tcById.get(tcId)!;
      const overrides = dto.paramOverrides?.[tcId];
      const item = this.em.create(
        TestRunItem,
        {
          testRun: run,
          testCase: tc,
          testFile: mapping.testFile,
          status: RunItemStatus.Pending,
          // Snapshot TC params/expected at run creation so later edits to the TC
          // do not retroactively change what the run executed against.
          paramsSnapshot: overrides ? { ...tc.params, ...overrides } : { ...tc.params },
          expectedSnapshot: { ...tc.expected },
        },
        { partial: true },
      );
      this.em.persist(item);
      items.push(item);
    }
    await this.em.flush();

    // Publish after flush so consumers never see a message referencing a row
    // that is not yet committed. Phase 3b will add retry/DLQ; a partial publish
    // failure here leaves the run Queued and requires manual intervention.
    for (const item of items) {
      const message: RunItemExecuteMessage = {
        runId: run.id,
        itemId: item.id,
        deploymentId: dep.id,
        testCaseId: item.testCase.id,
        testFileBundleKey: item.testFile.bundleKey,
        adminBaseUrl: this.adminBaseUrl,
      };
      await this.runQueuePublisher.publish(message);
    }

    return toRunDto(run);
  }

  async list(query: {
    page?: number;
    pageSize?: number;
  }): Promise<{ items: RunDto[]; total: number }> {
    const { items, total } = await this.testRunRepository.list(query);
    return { items: items.map(toRunDto), total };
  }

  async getById(id: string): Promise<{ run: RunDto; items: RunItemDto[] }> {
    const run = await this.testRunRepository.findById(id);
    if (!run) throw new ApiError(404, `run ${id} not found`, 'not_found');
    const items = await this.testRunItemRepository.findByRunId(id);
    return { run: toRunDto(run), items: items.map(toRunItemDto) };
  }

  async getReportUrl(id: string): Promise<string> {
    const run = await this.testRunRepository.findById(id);
    if (!run) throw new ApiError(404, `run ${id} not found`, 'not_found');
    if (!run.playwrightReportKey) {
      throw new ApiError(404, 'report not ready', 'no_report');
    }
    return this.objectStorageClient.presignedGetUrl(
      run.playwrightReportKey,
      REPORT_URL_TTL_SECONDS,
    );
  }

  async listRunsForTestCase(testCaseId: string): Promise<RunDto[]> {
    const items = await this.testRunItemRepository.findByTestCaseId(testCaseId);
    // Dedup run ids — a TC can appear multiple times across the same run's history.
    const uniqueIds = [...new Set(items.map((i) => i.testRun.id))];
    const runs = await this.testRunRepository.findByIds(uniqueIds);
    return runs.map(toRunDto);
  }
}
