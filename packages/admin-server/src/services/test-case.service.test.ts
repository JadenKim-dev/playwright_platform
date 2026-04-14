import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EntityManager } from '@mikro-orm/mysql';
import { TestCaseService } from './test-case.service.js';
import { ApiError } from '../app/api/_lib/error-handler.js';
import type { TestCaseRepository } from '../repositories/test-case.repository.js';
import type { TestCaseMappingRepository } from '../repositories/test-case-mapping.repository.js';
import type { DeploymentRepository } from '../repositories/deployment.repository.js';
import { mock } from '../testing/mock.js';

/**
 * Minimal entity-like fixture for tests; shape matches `TestCase` entity fields used by the mapper.
 */
const makeEntity = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'TC-001',
  name: 'cart add',
  description: null,
  params: { qty: 1 },
  expected: { count: 1 },
  tags: ['cart'],
  autoCreated: true,
  createdAt: new Date('2026-04-13T00:00:00Z'),
  updatedAt: new Date('2026-04-13T00:00:00Z'),
  ...overrides,
});

describe('TestCaseService', () => {
  let testCaseRepository: {
    listWithFilter: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findByIds: ReturnType<typeof vi.fn>;
  };
  let testCaseMappingRepository: { findByDeploymentId: ReturnType<typeof vi.fn> };
  let deploymentRepository: { findLatestSuccess: ReturnType<typeof vi.fn> };
  let em: { flush: ReturnType<typeof vi.fn> };
  let service: TestCaseService;

  beforeEach(() => {
    testCaseRepository = {
      listWithFilter: vi.fn(),
      findById: vi.fn(),
      findByIds: vi.fn(),
    };
    testCaseMappingRepository = { findByDeploymentId: vi.fn() };
    deploymentRepository = { findLatestSuccess: vi.fn() };
    em = { flush: vi.fn() };
    service = new TestCaseService(
      mock<EntityManager>(em),
      mock<TestCaseRepository>(testCaseRepository),
      mock<TestCaseMappingRepository>(testCaseMappingRepository),
      mock<DeploymentRepository>(deploymentRepository),
    );
  });

  it('list — computes active set and attaches isActive', async () => {
    testCaseRepository.listWithFilter.mockResolvedValue({
      items: [makeEntity({ id: 'TC-001' }), makeEntity({ id: 'TC-002' })],
      total: 2,
    });
    deploymentRepository.findLatestSuccess.mockResolvedValue({ id: 'dep-1' });
    testCaseMappingRepository.findByDeploymentId.mockResolvedValue([{ testCase: { id: 'TC-001' } }]);

    const result = await service.list({});

    expect(result.total).toBe(2);
    expect(result.items[0]?.isActive).toBe(true);
    expect(result.items[1]?.isActive).toBe(false);
  });

  it('list — activeOnly=true excludes inactive items', async () => {
    testCaseRepository.listWithFilter.mockResolvedValue({
      items: [makeEntity({ id: 'TC-001' }), makeEntity({ id: 'TC-002' })],
      total: 2,
    });
    deploymentRepository.findLatestSuccess.mockResolvedValue({ id: 'dep-1' });
    testCaseMappingRepository.findByDeploymentId.mockResolvedValue([{ testCase: { id: 'TC-001' } }]);

    const result = await service.list({ activeOnly: true });

    expect(result.items.map((item) => item.id)).toEqual(['TC-001']);
  });

  it('list — when no successful deployment exists, all items are inactive', async () => {
    testCaseRepository.listWithFilter.mockResolvedValue({ items: [makeEntity()], total: 1 });
    deploymentRepository.findLatestSuccess.mockResolvedValue(null);

    const result = await service.list({});
    expect(result.items[0]?.isActive).toBe(false);
  });

  it('getById — throws ApiError 404 when not found', async () => {
    testCaseRepository.findById.mockResolvedValue(null);
    await expect(service.getById('TC-X')).rejects.toBeInstanceOf(ApiError);
    await expect(service.getById('TC-X')).rejects.toMatchObject({ status: 404 });
  });

  it('patch — applies partial update and flushes', async () => {
    const entity = makeEntity();
    testCaseRepository.findById.mockResolvedValue(entity);
    deploymentRepository.findLatestSuccess.mockResolvedValue(null);

    const result = await service.patch('TC-001', { name: 'new name', tags: ['updated'] });

    expect(em.flush).toHaveBeenCalledOnce();
    expect(entity.name).toBe('new name');
    expect(entity.tags).toEqual(['updated']);
    expect(result.id).toBe('TC-001');
  });

  it('patch — throws ApiError 404 when not found', async () => {
    testCaseRepository.findById.mockResolvedValue(null);
    await expect(service.patch('TC-X', { name: 'x' })).rejects.toMatchObject({ status: 404 });
  });

  it('listRunnable — returns only TCs mapped to the latest successful deployment', async () => {
    deploymentRepository.findLatestSuccess.mockResolvedValue({ id: 'dep-1' });
    testCaseMappingRepository.findByDeploymentId.mockResolvedValue([
      { testCase: makeEntity({ id: 'TC-001' }) },
      { testCase: makeEntity({ id: 'TC-002' }) },
    ]);
    const result = await service.listRunnable();
    expect(result.map((testCase) => testCase.id)).toEqual(['TC-001', 'TC-002']);
    expect(result.every((testCase) => testCase.isActive)).toBe(true);
  });

  it('listRunnable — returns empty array when no successful deployment exists', async () => {
    deploymentRepository.findLatestSuccess.mockResolvedValue(null);
    const result = await service.listRunnable();
    expect(result).toEqual([]);
  });
});
