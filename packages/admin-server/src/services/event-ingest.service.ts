import type { EntityManager } from '@mikro-orm/mysql';
import {
  RunStatus,
  RunItemStatus,
  type ReporterEventBatch,
  type RunItemStatusUpdateDto,
  type RunCompleteDto,
} from '@platform/shared';
import type { TestRunRepository } from '../repositories/test-run.repository';
import type { TestRunItemRepository } from '../repositories/test-run-item.repository';
import type { TestEventRepository } from '../repositories/test-event.repository';
import { ApiError } from '../app/api/_lib/error-handler';

export class EventIngestService {
  constructor(
    private readonly em: EntityManager,
    private readonly testRunRepository: TestRunRepository,
    private readonly testRunItemRepository: TestRunItemRepository,
    private readonly testEventRepository: TestEventRepository,
  ) {}

  async appendEvents(runId: string, batch: ReporterEventBatch): Promise<void> {
    const run = await this.testRunRepository.findById(runId);
    if (!run) throw new ApiError(404, `run ${runId} not found`, 'not_found');
    await this.testEventRepository.insertBatch(runId, batch.events);
    await this.em.flush();
  }

  async updateItemStatus(
    runId: string,
    itemId: string,
    update: RunItemStatusUpdateDto,
  ): Promise<void> {
    const item = await this.testRunItemRepository.findById(itemId);
    if (!item) throw new ApiError(404, `run item ${itemId} not found`, 'not_found');
    // Defense-in-depth: a malformed route must not mutate a sibling run's item.
    if (item.testRun.id !== runId) {
      throw new ApiError(404, `run item ${itemId} not found`, 'not_found');
    }
    item.status = update.status;
    if (update.durationMs !== undefined) item.durationMs = update.durationMs;
    if (update.errorMessage !== undefined) item.errorMessage = update.errorMessage;
    if (this.isTerminal(update.status)) item.finishedAt = new Date();
    await this.em.flush();
  }

  async completeRun(runId: string, body: RunCompleteDto): Promise<void> {
    const run = await this.testRunRepository.findById(runId);
    if (!run) throw new ApiError(404, `run ${runId} not found`, 'not_found');
    const items = await this.testRunItemRepository.findByRunId(runId);
    run.status = this.rollupStatus(items.map((i) => i.status));
    run.finishedAt = new Date();
    if (body.playwrightReportKey !== undefined) {
      run.playwrightReportKey = body.playwrightReportKey;
    }
    await this.em.flush();
  }

  private isTerminal(s: RunItemStatus): boolean {
    return (
      s === RunItemStatus.Passed ||
      s === RunItemStatus.Failed ||
      s === RunItemStatus.Skipped ||
      s === RunItemStatus.Timedout
    );
  }

  private rollupStatus(itemStatuses: RunItemStatus[]): RunStatus {
    // All terminal-success-like items -> overall success
    const allPassed = itemStatuses.every(
      (s) => s === RunItemStatus.Passed || s === RunItemStatus.Skipped,
    );
    if (allPassed) return RunStatus.Success;
    // At least one passed among mixed results -> partial success
    const anyPassed = itemStatuses.some((s) => s === RunItemStatus.Passed);
    return anyPassed ? RunStatus.Partial : RunStatus.Failed;
  }
}
