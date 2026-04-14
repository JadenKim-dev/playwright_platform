import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RunService } from './run.service.js';
import { RunStatus, RunItemStatus, DeploymentStatus } from '@platform/shared';

describe('RunService', () => {
  let depRepo: any;
  let tcRepo: any;
  let mapRepo: any;
  let runRepo: any;
  let runItemRepo: any;
  let storage: { presignedGetUrl: ReturnType<typeof vi.fn> };
  let publisher: { publish: ReturnType<typeof vi.fn> };
  let em: any;
  let service: RunService;

  beforeEach(() => {
    depRepo = { findLatestSuccess: vi.fn() };
    tcRepo = { findByIds: vi.fn() };
    mapRepo = { findByDeploymentAndTcs: vi.fn() };
    runRepo = { list: vi.fn(), findById: vi.fn(), findByIds: vi.fn() };
    runItemRepo = { findByRunId: vi.fn(), findByTestCaseId: vi.fn() };
    storage = { presignedGetUrl: vi.fn().mockResolvedValue('https://signed/x') };
    publisher = { publish: vi.fn().mockResolvedValue(undefined) };
    em = {
      // Mock em.create: return a plain object with an id and sensible timestamp
      // defaults so the RunDto mapper can serialize the entity without TypeError.
      create: vi.fn((_cls, data) => ({
        id: data.id ?? 'auto',
        requestedAt: new Date(),
        startedAt: null,
        finishedAt: null,
        playwrightReportKey: null,
        ...data,
      })),
      flush: vi.fn().mockResolvedValue(undefined),
      transactional: vi.fn(async (fn: any) => fn(em)),
    };
    service = new RunService(
      em,
      depRepo,
      tcRepo,
      mapRepo,
      runRepo,
      runItemRepo,
      publisher as any,
      storage as any,
      'http://admin:3000',
    );
  });

  it('create — throws 409 when no successful deployment exists', async () => {
    depRepo.findLatestSuccess.mockResolvedValue(null);
    await expect(service.create({ testCaseIds: ['TC-1'] })).rejects.toMatchObject({ status: 409 });
  });

  it('create — throws 400 when a test case is not mapped in the current deployment', async () => {
    depRepo.findLatestSuccess.mockResolvedValue({ id: 'dep-1', status: DeploymentStatus.Success });
    tcRepo.findByIds.mockResolvedValue([{ id: 'TC-1', params: {}, expected: {} }]);
    mapRepo.findByDeploymentAndTcs.mockResolvedValue([]);
    await expect(service.create({ testCaseIds: ['TC-1'] })).rejects.toMatchObject({ status: 400 });
  });

  it('create — pins test case params/expected into the item snapshot', async () => {
    depRepo.findLatestSuccess.mockResolvedValue({ id: 'dep-1', status: DeploymentStatus.Success });
    const tc = { id: 'TC-1', params: { qty: 2 }, expected: { count: 2 } };
    tcRepo.findByIds.mockResolvedValue([tc]);
    mapRepo.findByDeploymentAndTcs.mockResolvedValue([
      { testCase: tc, testFile: { id: 'file-1', bundleKey: 'k1' } },
    ]);

    await service.create({ testCaseIds: ['TC-1'] });

    const itemCalls = em.create.mock.calls.filter((c: any[]) => c[1].paramsSnapshot !== undefined);
    expect(itemCalls).toHaveLength(1);
    expect(itemCalls[0][1].paramsSnapshot).toEqual({ qty: 2 });
    expect(itemCalls[0][1].expectedSnapshot).toEqual({ count: 2 });
    expect(itemCalls[0][1].status).toBe(RunItemStatus.Pending);
  });

  it('create — merges paramOverrides on top of the pinned snapshot', async () => {
    depRepo.findLatestSuccess.mockResolvedValue({ id: 'dep-1', status: DeploymentStatus.Success });
    const tc = { id: 'TC-1', params: { qty: 1 }, expected: { count: 1 } };
    tcRepo.findByIds.mockResolvedValue([tc]);
    mapRepo.findByDeploymentAndTcs.mockResolvedValue([
      { testCase: tc, testFile: { id: 'file-1', bundleKey: 'k1' } },
    ]);

    await service.create({
      testCaseIds: ['TC-1'],
      paramOverrides: { 'TC-1': { qty: 5 } },
    });

    const itemCall = em.create.mock.calls.find((c: any[]) => c[1].paramsSnapshot !== undefined);
    expect(itemCall![1].paramsSnapshot).toEqual({ qty: 5 });
  });

  it('create — publishes one RabbitMQ message per item with the routing-key payload shape', async () => {
    depRepo.findLatestSuccess.mockResolvedValue({ id: 'dep-1', status: DeploymentStatus.Success });
    const tc1 = { id: 'TC-1', params: {}, expected: {} };
    const tc2 = { id: 'TC-2', params: {}, expected: {} };
    tcRepo.findByIds.mockResolvedValue([tc1, tc2]);
    mapRepo.findByDeploymentAndTcs.mockResolvedValue([
      { testCase: tc1, testFile: { id: 'file-1', bundleKey: 'k1' } },
      { testCase: tc2, testFile: { id: 'file-2', bundleKey: 'k2' } },
    ]);

    await service.create({ testCaseIds: ['TC-1', 'TC-2'] });

    expect(publisher.publish).toHaveBeenCalledTimes(2);
    const firstMsg = publisher.publish.mock.calls[0]?.[0];
    expect(firstMsg.testCaseId).toBe('TC-1');
    expect(firstMsg.deploymentId).toBe('dep-1');
    expect(firstMsg.testFileBundleKey).toBe('k1');
    expect(firstMsg.adminBaseUrl).toBe('http://admin:3000');
  });

  it('getReportUrl — throws 404 when playwrightReportKey is missing', async () => {
    runRepo.findById.mockResolvedValue({ id: 'r1', playwrightReportKey: null });
    await expect(service.getReportUrl('r1')).rejects.toMatchObject({ status: 404 });
  });

  it('getReportUrl — delegates to storage.presignedGetUrl when the key is set', async () => {
    runRepo.findById.mockResolvedValue({ id: 'r1', playwrightReportKey: 'runs/r1/report/index.html' });
    const url = await service.getReportUrl('r1');
    expect(storage.presignedGetUrl).toHaveBeenCalledWith('runs/r1/report/index.html', expect.any(Number));
    expect(url).toBe('https://signed/x');
  });

  it('listRunsForTestCase — extracts unique run ids from items and returns run DTOs', async () => {
    runItemRepo.findByTestCaseId.mockResolvedValue([
      { testRun: { id: 'r1' } },
      { testRun: { id: 'r1' } },
      { testRun: { id: 'r2' } },
    ]);
    runRepo.findByIds.mockResolvedValue([
      {
        id: 'r1',
        deployment: { id: 'd1' },
        requestedTestCaseIds: ['TC-1'],
        status: RunStatus.Success,
        requestedAt: new Date(),
        startedAt: null,
        finishedAt: null,
        playwrightReportKey: null,
      },
      {
        id: 'r2',
        deployment: { id: 'd1' },
        requestedTestCaseIds: ['TC-1'],
        status: RunStatus.Failed,
        requestedAt: new Date(),
        startedAt: null,
        finishedAt: null,
        playwrightReportKey: null,
      },
    ]);
    const items = await service.listRunsForTestCase('TC-1');
    expect(items).toHaveLength(2);
  });
});
