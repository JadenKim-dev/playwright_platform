import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EntityManager } from '@mikro-orm/mysql';
import { RunService } from './run.service.js';
import { RunStatus, RunItemStatus, DeploymentStatus } from '@platform/shared';
import type { DeploymentRepository } from '../repositories/deployment.repository.js';
import type { TestCaseRepository } from '../repositories/test-case.repository.js';
import type { TestCaseMappingRepository } from '../repositories/test-case-mapping.repository.js';
import type { TestRunRepository } from '../repositories/test-run.repository.js';
import type { TestRunItemRepository } from '../repositories/test-run-item.repository.js';
import type { RunQueuePublisher } from '../queue/run-queue-publisher.js';
import type { ObjectStorageClient } from '../storage/object-storage-client.js';
import { mock } from '../testing/mock.js';

describe('RunService', () => {
  let deploymentRepository: { findLatestSuccess: ReturnType<typeof vi.fn> };
  let testCaseRepository: { findByIds: ReturnType<typeof vi.fn> };
  let testCaseMappingRepository: { findByDeploymentAndTcs: ReturnType<typeof vi.fn> };
  let testRunRepository: {
    list: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findByIds: ReturnType<typeof vi.fn>;
  };
  let testRunItemRepository: {
    findByRunId: ReturnType<typeof vi.fn>;
    findByTestCaseId: ReturnType<typeof vi.fn>;
  };
  let storage: { presignedGetUrl: ReturnType<typeof vi.fn> };
  let publisher: { publish: ReturnType<typeof vi.fn> };
  let em: {
    create: ReturnType<typeof vi.fn>;
    flush: ReturnType<typeof vi.fn>;
    transactional: ReturnType<typeof vi.fn>;
  };
  let service: RunService;

  beforeEach(() => {
    deploymentRepository = { findLatestSuccess: vi.fn() };
    testCaseRepository = { findByIds: vi.fn() };
    testCaseMappingRepository = { findByDeploymentAndTcs: vi.fn() };
    testRunRepository = { list: vi.fn(), findById: vi.fn(), findByIds: vi.fn() };
    testRunItemRepository = { findByRunId: vi.fn(), findByTestCaseId: vi.fn() };
    storage = { presignedGetUrl: vi.fn().mockResolvedValue('https://signed/x') };
    publisher = { publish: vi.fn().mockResolvedValue(undefined) };
    em = {
      // Mock em.create: return a plain object with an id and sensible timestamp
      // defaults so the RunDto mapper can serialize the entity without TypeError.
      create: vi.fn((_cls: unknown, data: Record<string, unknown>) => ({
        id: data.id ?? 'auto',
        requestedAt: new Date(),
        startedAt: null,
        finishedAt: null,
        playwrightReportKey: null,
        ...data,
      })),
      flush: vi.fn().mockResolvedValue(undefined),
      transactional: vi.fn(async (fn: (em: unknown) => unknown) => fn(em)),
    };
    service = new RunService(
      mock<EntityManager>(em),
      mock<DeploymentRepository>(deploymentRepository),
      mock<TestCaseRepository>(testCaseRepository),
      mock<TestCaseMappingRepository>(testCaseMappingRepository),
      mock<TestRunRepository>(testRunRepository),
      mock<TestRunItemRepository>(testRunItemRepository),
      mock<RunQueuePublisher>(publisher),
      mock<ObjectStorageClient>(storage),
      'http://admin:3000',
    );
  });

  it('create — throws 409 when no successful deployment exists', async () => {
    deploymentRepository.findLatestSuccess.mockResolvedValue(null);
    await expect(service.create({ testCaseIds: ['TC-1'] })).rejects.toMatchObject({ status: 409 });
  });

  it('create — throws 400 when a test case is not mapped in the current deployment', async () => {
    deploymentRepository.findLatestSuccess.mockResolvedValue({
      id: 'dep-1',
      status: DeploymentStatus.Success,
    });
    testCaseRepository.findByIds.mockResolvedValue([{ id: 'TC-1', params: {}, expected: {} }]);
    testCaseMappingRepository.findByDeploymentAndTcs.mockResolvedValue([]);
    await expect(service.create({ testCaseIds: ['TC-1'] })).rejects.toMatchObject({ status: 400 });
  });

  it('create — pins test case params/expected into the item snapshot', async () => {
    deploymentRepository.findLatestSuccess.mockResolvedValue({
      id: 'dep-1',
      status: DeploymentStatus.Success,
    });
    const testCase = { id: 'TC-1', params: { qty: 2 }, expected: { count: 2 } };
    testCaseRepository.findByIds.mockResolvedValue([testCase]);
    testCaseMappingRepository.findByDeploymentAndTcs.mockResolvedValue([
      { testCase, testFile: { id: 'file-1', bundleKey: 'k1' } },
    ]);

    await service.create({ testCaseIds: ['TC-1'] });

    const itemCreateCalls = em.create.mock.calls.filter(
      (call: unknown[]) => (call[1] as Record<string, unknown>).paramsSnapshot !== undefined,
    );
    expect(itemCreateCalls).toHaveLength(1);
    expect(itemCreateCalls[0]![1].paramsSnapshot).toEqual({ qty: 2 });
    expect(itemCreateCalls[0]![1].expectedSnapshot).toEqual({ count: 2 });
    expect(itemCreateCalls[0]![1].status).toBe(RunItemStatus.Pending);
  });

  it('create — merges paramOverrides on top of the pinned snapshot', async () => {
    deploymentRepository.findLatestSuccess.mockResolvedValue({
      id: 'dep-1',
      status: DeploymentStatus.Success,
    });
    const testCase = { id: 'TC-1', params: { qty: 1 }, expected: { count: 1 } };
    testCaseRepository.findByIds.mockResolvedValue([testCase]);
    testCaseMappingRepository.findByDeploymentAndTcs.mockResolvedValue([
      { testCase, testFile: { id: 'file-1', bundleKey: 'k1' } },
    ]);

    await service.create({
      testCaseIds: ['TC-1'],
      paramOverrides: { 'TC-1': { qty: 5 } },
    });

    const itemCreateCall = em.create.mock.calls.find(
      (call: unknown[]) => (call[1] as Record<string, unknown>).paramsSnapshot !== undefined,
    );
    expect(itemCreateCall![1].paramsSnapshot).toEqual({ qty: 5 });
  });

  it('create — publishes one RabbitMQ message per item with the routing-key payload shape', async () => {
    deploymentRepository.findLatestSuccess.mockResolvedValue({
      id: 'dep-1',
      status: DeploymentStatus.Success,
    });
    const firstTestCase = { id: 'TC-1', params: {}, expected: {} };
    const secondTestCase = { id: 'TC-2', params: {}, expected: {} };
    testCaseRepository.findByIds.mockResolvedValue([firstTestCase, secondTestCase]);
    testCaseMappingRepository.findByDeploymentAndTcs.mockResolvedValue([
      { testCase: firstTestCase, testFile: { id: 'file-1', bundleKey: 'k1' } },
      { testCase: secondTestCase, testFile: { id: 'file-2', bundleKey: 'k2' } },
    ]);

    await service.create({ testCaseIds: ['TC-1', 'TC-2'] });

    expect(publisher.publish).toHaveBeenCalledTimes(2);
    const firstMessage = publisher.publish.mock.calls[0]?.[0];
    expect(firstMessage.testCaseId).toBe('TC-1');
    expect(firstMessage.deploymentId).toBe('dep-1');
    expect(firstMessage.testFileBundleKey).toBe('k1');
    expect(firstMessage.adminBaseUrl).toBe('http://admin:3000');
  });

  it('getReportUrl — throws 404 when playwrightReportKey is missing', async () => {
    testRunRepository.findById.mockResolvedValue({ id: 'r1', playwrightReportKey: null });
    await expect(service.getReportUrl('r1')).rejects.toMatchObject({ status: 404 });
  });

  it('getReportUrl — delegates to storage.presignedGetUrl when the key is set', async () => {
    testRunRepository.findById.mockResolvedValue({
      id: 'r1',
      playwrightReportKey: 'runs/r1/report/index.html',
    });
    const url = await service.getReportUrl('r1');
    expect(storage.presignedGetUrl).toHaveBeenCalledWith('runs/r1/report/index.html', expect.any(Number));
    expect(url).toBe('https://signed/x');
  });

  it('listRunsForTestCase — extracts unique run ids from items and returns run DTOs', async () => {
    testRunItemRepository.findByTestCaseId.mockResolvedValue([
      { testRun: { id: 'r1' } },
      { testRun: { id: 'r1' } },
      { testRun: { id: 'r2' } },
    ]);
    testRunRepository.findByIds.mockResolvedValue([
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
