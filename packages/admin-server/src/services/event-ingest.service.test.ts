import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EntityManager } from '@mikro-orm/mysql';
import { EventIngestService } from './event-ingest.service.js';
import {
  ReporterEventType,
  RunItemStatus,
  RunStatus,
  type ReporterEventBatch,
} from '@platform/shared';
import type { TestRunRepository } from '../repositories/test-run.repository.js';
import type { TestRunItemRepository } from '../repositories/test-run-item.repository.js';
import type { TestEventRepository } from '../repositories/test-event.repository.js';
import { mock } from '../testing/mock.js';

describe('EventIngestService', () => {
  let testRunRepository: {
    findById: ReturnType<typeof vi.fn>;
  };
  let testRunItemRepository: {
    findById: ReturnType<typeof vi.fn>;
    findByRunId: ReturnType<typeof vi.fn>;
  };
  let testEventRepository: { insertBatch: ReturnType<typeof vi.fn> };
  let em: { flush: ReturnType<typeof vi.fn> };
  let service: EventIngestService;

  beforeEach(() => {
    testRunRepository = { findById: vi.fn() };
    testRunItemRepository = { findById: vi.fn(), findByRunId: vi.fn() };
    testEventRepository = { insertBatch: vi.fn() };
    em = { flush: vi.fn().mockResolvedValue(undefined) };
    service = new EventIngestService(
      mock<EntityManager>(em),
      mock<TestRunRepository>(testRunRepository),
      mock<TestRunItemRepository>(testRunItemRepository),
      mock<TestEventRepository>(testEventRepository),
    );
  });

  it('appendEvents — inserts batch and flushes when run exists', async () => {
    testRunRepository.findById.mockResolvedValue({ id: 'r1' });
    const batch: ReporterEventBatch = {
      events: [
        {
          type: ReporterEventType.TestBegin,
          itemId: 'i1',
          ts: '2026-04-13T00:00:00Z',
          payload: {},
        },
      ],
    };
    await service.appendEvents('r1', batch);
    expect(testEventRepository.insertBatch).toHaveBeenCalledWith('r1', batch.events);
    expect(em.flush).toHaveBeenCalled();
  });

  it('appendEvents — throws 404 when run does not exist', async () => {
    testRunRepository.findById.mockResolvedValue(null);
    await expect(service.appendEvents('x', { events: [] })).rejects.toMatchObject({ status: 404 });
  });

  it('updateItemStatus — updates status and sets finishedAt on terminal transition', async () => {
    const item = {
      id: 'i1',
      status: RunItemStatus.Running,
      durationMs: null,
      errorMessage: null,
      finishedAt: null,
      testRun: { id: 'r1' },
    };
    testRunItemRepository.findById.mockResolvedValue(item);
    await service.updateItemStatus('r1', 'i1', {
      status: RunItemStatus.Passed,
      durationMs: 42,
    });
    expect(item.status).toBe(RunItemStatus.Passed);
    expect(item.durationMs).toBe(42);
    expect(item.finishedAt).toBeInstanceOf(Date);
    expect(em.flush).toHaveBeenCalled();
  });

  it('updateItemStatus — throws 404 when item does not exist', async () => {
    testRunItemRepository.findById.mockResolvedValue(null);
    await expect(
      service.updateItemStatus('r1', 'i1', { status: RunItemStatus.Passed }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('updateItemStatus — throws 404 when item belongs to a different run', async () => {
    const item = {
      id: 'i1',
      status: RunItemStatus.Running,
      durationMs: null,
      errorMessage: null,
      finishedAt: null,
      testRun: { id: 'other-run' },
    };
    testRunItemRepository.findById.mockResolvedValue(item);
    await expect(
      service.updateItemStatus('r1', 'i1', { status: RunItemStatus.Passed }),
    ).rejects.toMatchObject({ status: 404 });
    expect(em.flush).not.toHaveBeenCalled();
  });

  it('completeRun — rolls up to success when all items passed', async () => {
    const run = {
      id: 'r1',
      status: RunStatus.Running,
      finishedAt: null,
      playwrightReportKey: null,
    };
    testRunRepository.findById.mockResolvedValue(run);
    testRunItemRepository.findByRunId.mockResolvedValue([
      { status: RunItemStatus.Passed },
      { status: RunItemStatus.Passed },
    ]);
    await service.completeRun('r1', { playwrightReportKey: 'runs/r1/report/index.html' });
    expect(run.status).toBe(RunStatus.Success);
    expect(run.playwrightReportKey).toBe('runs/r1/report/index.html');
    expect(run.finishedAt).toBeInstanceOf(Date);
  });

  it('completeRun — rolls up to failed when all items failed or timed out', async () => {
    const run = {
      id: 'r1',
      status: RunStatus.Running,
      finishedAt: null,
      playwrightReportKey: null,
    };
    testRunRepository.findById.mockResolvedValue(run);
    testRunItemRepository.findByRunId.mockResolvedValue([
      { status: RunItemStatus.Failed },
      { status: RunItemStatus.Timedout },
    ]);
    await service.completeRun('r1', {});
    expect(run.status).toBe(RunStatus.Failed);
  });

  it('completeRun — rolls up to partial when only some items passed', async () => {
    const run = {
      id: 'r1',
      status: RunStatus.Running,
      finishedAt: null,
      playwrightReportKey: null,
    };
    testRunRepository.findById.mockResolvedValue(run);
    testRunItemRepository.findByRunId.mockResolvedValue([
      { status: RunItemStatus.Passed },
      { status: RunItemStatus.Failed },
    ]);
    await service.completeRun('r1', {});
    expect(run.status).toBe(RunStatus.Partial);
  });
});
