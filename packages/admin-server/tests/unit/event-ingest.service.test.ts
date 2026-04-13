import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventIngestService } from '../../src/services/event-ingest.service.js';
import {
  ReporterEventType,
  RunItemStatus,
  RunStatus,
  type ReporterEventBatch,
} from '@platform/shared';

describe('EventIngestService', () => {
  let runRepo: any;
  let runItemRepo: any;
  let eventRepo: any;
  let em: any;
  let service: EventIngestService;

  beforeEach(() => {
    runRepo = { findById: vi.fn() };
    runItemRepo = { findById: vi.fn(), findByRunId: vi.fn() };
    eventRepo = { insertBatch: vi.fn() };
    em = { flush: vi.fn().mockResolvedValue(undefined) };
    service = new EventIngestService(em, runRepo, runItemRepo, eventRepo);
  });

  it('appendEvents — inserts batch and flushes when run exists', async () => {
    runRepo.findById.mockResolvedValue({ id: 'r1' });
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
    expect(eventRepo.insertBatch).toHaveBeenCalledWith('r1', batch.events);
    expect(em.flush).toHaveBeenCalled();
  });

  it('appendEvents — throws 404 when run does not exist', async () => {
    runRepo.findById.mockResolvedValue(null);
    await expect(service.appendEvents('x', { events: [] })).rejects.toMatchObject({ status: 404 });
  });

  it('updateItemStatus — updates status and sets finishedAt on terminal transition', async () => {
    const item = {
      id: 'i1',
      status: RunItemStatus.Running,
      durationMs: null,
      errorMessage: null,
      finishedAt: null,
    };
    runItemRepo.findById.mockResolvedValue(item);
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
    runItemRepo.findById.mockResolvedValue(null);
    await expect(
      service.updateItemStatus('r1', 'i1', { status: RunItemStatus.Passed }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('completeRun — rolls up to success when all items passed', async () => {
    const run = {
      id: 'r1',
      status: RunStatus.Running,
      finishedAt: null,
      playwrightReportKey: null,
    };
    runRepo.findById.mockResolvedValue(run);
    runItemRepo.findByRunId.mockResolvedValue([
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
    runRepo.findById.mockResolvedValue(run);
    runItemRepo.findByRunId.mockResolvedValue([
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
    runRepo.findById.mockResolvedValue(run);
    runItemRepo.findByRunId.mockResolvedValue([
      { status: RunItemStatus.Passed },
      { status: RunItemStatus.Failed },
    ]);
    await service.completeRun('r1', {});
    expect(run.status).toBe(RunStatus.Partial);
  });
});
