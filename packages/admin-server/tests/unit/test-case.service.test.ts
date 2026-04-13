import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestCaseService } from '../../src/services/test-case.service.js';
import { ApiError } from '../../src/app/api/_lib/error-handler.js';

// Minimal entity-like fixture for tests; shape matches TestCase entity fields used by the mapper.
const makeEntity = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'TC-001',
  name: 'cart add',
  description: null,
  params: { qty: 1 },
  expected: { count: 1 },
  tags: ['cart'],
  autoCreated: true,
  createdAt: new Date('2026-04-13T00:00:00Z'),
  updatedAt: new Date('2026-04-13T00:00:00Z'),
  ...over,
});

describe('TestCaseService', () => {
  let testCaseRepo: {
    listWithFilter: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findByIds: ReturnType<typeof vi.fn>;
  };
  let mappingRepo: { findByDeploymentId: ReturnType<typeof vi.fn> };
  let deploymentRepo: { findLatestSuccess: ReturnType<typeof vi.fn> };
  let em: { flush: ReturnType<typeof vi.fn> };
  let service: TestCaseService;

  beforeEach(() => {
    testCaseRepo = {
      listWithFilter: vi.fn(),
      findById: vi.fn(),
      findByIds: vi.fn(),
    };
    mappingRepo = { findByDeploymentId: vi.fn() };
    deploymentRepo = { findLatestSuccess: vi.fn() };
    em = { flush: vi.fn() };
    service = new TestCaseService(
      em as any,
      testCaseRepo as any,
      mappingRepo as any,
      deploymentRepo as any,
    );
  });

  it('list — computes active set and attaches isActive', async () => {
    testCaseRepo.listWithFilter.mockResolvedValue({
      items: [makeEntity({ id: 'TC-001' }), makeEntity({ id: 'TC-002' })],
      total: 2,
    });
    deploymentRepo.findLatestSuccess.mockResolvedValue({ id: 'dep-1' });
    mappingRepo.findByDeploymentId.mockResolvedValue([{ testCase: { id: 'TC-001' } }]);

    const result = await service.list({});

    expect(result.total).toBe(2);
    expect(result.items[0]?.isActive).toBe(true);
    expect(result.items[1]?.isActive).toBe(false);
  });

  it('list — activeOnly=true excludes inactive items', async () => {
    testCaseRepo.listWithFilter.mockResolvedValue({
      items: [makeEntity({ id: 'TC-001' }), makeEntity({ id: 'TC-002' })],
      total: 2,
    });
    deploymentRepo.findLatestSuccess.mockResolvedValue({ id: 'dep-1' });
    mappingRepo.findByDeploymentId.mockResolvedValue([{ testCase: { id: 'TC-001' } }]);

    const result = await service.list({ activeOnly: true });

    expect(result.items.map((i) => i.id)).toEqual(['TC-001']);
  });

  it('list — when no successful deployment exists, all items are inactive', async () => {
    testCaseRepo.listWithFilter.mockResolvedValue({ items: [makeEntity()], total: 1 });
    deploymentRepo.findLatestSuccess.mockResolvedValue(null);

    const result = await service.list({});
    expect(result.items[0]?.isActive).toBe(false);
  });

  it('getById — throws ApiError 404 when not found', async () => {
    testCaseRepo.findById.mockResolvedValue(null);
    await expect(service.getById('TC-X')).rejects.toBeInstanceOf(ApiError);
    await expect(service.getById('TC-X')).rejects.toMatchObject({ status: 404 });
  });

  it('patch — applies partial update and flushes', async () => {
    const entity = makeEntity();
    testCaseRepo.findById.mockResolvedValue(entity);
    deploymentRepo.findLatestSuccess.mockResolvedValue(null);

    const result = await service.patch('TC-001', { name: 'new name', tags: ['updated'] });

    expect(em.flush).toHaveBeenCalledOnce();
    expect(entity.name).toBe('new name');
    expect(entity.tags).toEqual(['updated']);
    expect(result.id).toBe('TC-001');
  });

  it('patch — throws ApiError 404 when not found', async () => {
    testCaseRepo.findById.mockResolvedValue(null);
    await expect(service.patch('TC-X', { name: 'x' })).rejects.toMatchObject({ status: 404 });
  });

  it('listRunnable — returns only TCs mapped to the latest successful deployment', async () => {
    deploymentRepo.findLatestSuccess.mockResolvedValue({ id: 'dep-1' });
    mappingRepo.findByDeploymentId.mockResolvedValue([
      { testCase: makeEntity({ id: 'TC-001' }) },
      { testCase: makeEntity({ id: 'TC-002' }) },
    ]);
    const result = await service.listRunnable();
    expect(result.map((tc) => tc.id)).toEqual(['TC-001', 'TC-002']);
    expect(result.every((tc) => tc.isActive)).toBe(true);
  });

  it('listRunnable — returns empty array when no successful deployment exists', async () => {
    deploymentRepo.findLatestSuccess.mockResolvedValue(null);
    const result = await service.listRunnable();
    expect(result).toEqual([]);
  });
});
