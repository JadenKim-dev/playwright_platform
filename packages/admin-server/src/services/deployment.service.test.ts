import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeploymentService } from './deployment.service.js';
import { DeploymentStatus } from '@platform/shared';

// Minimal entity-like fixture for tests; shape matches Deployment entity fields used by the mapper.
const makeDeployment = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'dep-1',
  gitRef: 'main',
  status: DeploymentStatus.Pending,
  errorMessage: null,
  startedAt: new Date('2026-04-13T00:00:00Z'),
  finishedAt: null,
  ...overrides,
});

describe('DeploymentService', () => {
  let deploymentRepository: {
    list: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findLatestSuccess: ReturnType<typeof vi.fn>;
  };
  let testFileRepository: { findByDeploymentId: ReturnType<typeof vi.fn> };
  let trigger: { trigger: ReturnType<typeof vi.fn> };
  let em: {
    flush: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  let service: DeploymentService;

  beforeEach(() => {
    deploymentRepository = { list: vi.fn(), findById: vi.fn(), findLatestSuccess: vi.fn() };
    testFileRepository = { findByDeploymentId: vi.fn() };
    trigger = { trigger: vi.fn().mockResolvedValue(undefined) };
    em = {
      flush: vi.fn().mockResolvedValue(undefined),
      create: vi.fn((_cls, data) => ({ ...makeDeployment(), ...data })),
    };
    service = new DeploymentService(
      em as any,
      deploymentRepository as any,
      testFileRepository as any,
      trigger as any,
    );
  });

  it('create — inserts a pending deployment, calls deploy trigger, and returns DTO', async () => {
    const dto = await service.create({ gitRef: 'feature/x' });

    expect(em.create).toHaveBeenCalled();
    expect(em.flush).toHaveBeenCalledOnce();
    expect(trigger.trigger).toHaveBeenCalledWith({ deploymentId: dto.id, gitRef: 'feature/x' });
    expect(dto.gitRef).toBe('feature/x');
    expect(dto.status).toBe(DeploymentStatus.Pending);
  });

  it('create — keeps the deployment row (pending) even if the trigger fails', async () => {
    trigger.trigger.mockRejectedValue(new Error('deploy down'));
    await expect(service.create({ gitRef: 'main' })).rejects.toThrow('deploy down');
    expect(em.flush).toHaveBeenCalledOnce();
  });

  it('list — delegates pagination to the repository', async () => {
    deploymentRepository.list.mockResolvedValue({ items: [makeDeployment()], total: 1 });
    const result = await service.list({ page: 2, pageSize: 10 });
    expect(deploymentRepository.list).toHaveBeenCalledWith({ page: 2, pageSize: 10, status: undefined });
    expect(result.total).toBe(1);
    expect(result.items[0]?.id).toBe('dep-1');
  });

  it('getById — throws 404 when the deployment is not found', async () => {
    deploymentRepository.findById.mockResolvedValue(null);
    await expect(service.getById('x')).rejects.toMatchObject({ status: 404 });
  });

  it('listTestFiles — throws 404 when the deployment is missing', async () => {
    deploymentRepository.findById.mockResolvedValue(null);
    await expect(service.listTestFiles('x')).rejects.toMatchObject({ status: 404 });
    expect(testFileRepository.findByDeploymentId).not.toHaveBeenCalled();
  });

  it('listTestFiles — delegates to the repository and maps to DTOs', async () => {
    deploymentRepository.findById.mockResolvedValue(makeDeployment());
    testFileRepository.findByDeploymentId.mockResolvedValue([
      {
        id: 'f1',
        deployment: { id: 'dep-1' },
        sourcePath: 'a.spec.ts',
        bundleKey: 'k1',
        createdAt: new Date(),
      },
    ]);
    const items = await service.listTestFiles('dep-1');
    expect(items).toHaveLength(1);
    expect(items[0]?.sourcePath).toBe('a.spec.ts');
  });
});
