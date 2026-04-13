import { describe, it, expect, vi } from 'vitest';
import type { ResolvedTestCaseDto } from '@platform/shared';
import { createTestCase } from './test-case.js';
import type { PlatformEnv } from './env.js';
import type { AdminClient } from './client.js';

type CapturedTestFn = (fixtures: unknown, testInfo: unknown) => Promise<void>;

interface MockTest {
  (id: string, fn: CapturedTestFn): void;
  step: (title: string, fn: () => Promise<void>) => Promise<void>;
  lastId?: string;
  lastFn?: CapturedTestFn;
  stepCalls: Array<{ title: string }>;
}

function createMockTest(): MockTest {
  const stepCalls: Array<{ title: string }> = [];
  const fn = ((id: string, testFn: CapturedTestFn) => {
    fn.lastId = id;
    fn.lastFn = testFn;
  }) as MockTest;
  fn.stepCalls = stepCalls;
  fn.step = async (title: string, cb: () => Promise<void>) => {
    stepCalls.push({ title });
    await cb();
  };
  return fn;
}

const fakeEnv: PlatformEnv = {
  runId: 'run-1',
  itemId: 'item-1',
  adminUrl: 'http://admin.local',
  internalApiToken: 'token',
  reporterChunkSize: 50,
  reporterFlushIntervalMs: 2000,
};

function makeClient(resolved: ResolvedTestCaseDto | Error): AdminClient {
  const resolve = vi.fn(async (_id: string) => {
    if (resolved instanceof Error) throw resolved;
    return resolved;
  });
  return { resolve } as unknown as AdminClient;
}

describe('testCase wrapper', () => {
  it('calls mock test with the given id', () => {
    const mockTest = createMockTest();
    const client = makeClient({ params: {}, expected: {} });
    const testCase = createTestCase({
      test: mockTest as unknown as Parameters<typeof createTestCase>[0]['test'],
      createAdminClient: () => client,
      loadPlatformEnv: () => fakeEnv,
    });

    testCase('TC-001', async () => {});

    expect(mockTest.lastId).toBe('TC-001');
    expect(typeof mockTest.lastFn).toBe('function');
  });

  it('invokes user callback with fixtures merged with params and expected', async () => {
    const mockTest = createMockTest();
    const resolved: ResolvedTestCaseDto = {
      params: { foo: 1 },
      expected: { bar: 2 },
    };
    const client = makeClient(resolved);
    const userFn = vi.fn(async () => {});
    const testCase = createTestCase({
      test: mockTest as unknown as Parameters<typeof createTestCase>[0]['test'],
      createAdminClient: () => client,
      loadPlatformEnv: () => fakeEnv,
    });

    testCase('TC-001', userFn);
    await mockTest.lastFn!({ page: 'PAGE' }, {});

    expect(userFn).toHaveBeenCalledTimes(1);
    expect(userFn).toHaveBeenCalledWith({
      page: 'PAGE',
      params: { foo: 1 },
      expected: { bar: 2 },
    });
  });

  it('calls client.resolve with the test case id at execution time', async () => {
    const mockTest = createMockTest();
    const resolved: ResolvedTestCaseDto = { params: {}, expected: {} };
    const resolveSpy = vi.fn(async (_id: string) => resolved);
    const client = { resolve: resolveSpy } as unknown as AdminClient;
    const testCase = createTestCase({
      test: mockTest as unknown as Parameters<typeof createTestCase>[0]['test'],
      createAdminClient: () => client,
      loadPlatformEnv: () => fakeEnv,
    });

    testCase('TC-042', async () => {});
    expect(resolveSpy).not.toHaveBeenCalled();
    await mockTest.lastFn!({}, {});
    expect(resolveSpy).toHaveBeenCalledWith('TC-042');
  });

  it('wraps resolve in test.step with descriptive title', async () => {
    const mockTest = createMockTest();
    const resolved: ResolvedTestCaseDto = { params: {}, expected: {} };
    const client = makeClient(resolved);
    const testCase = createTestCase({
      test: mockTest as unknown as Parameters<typeof createTestCase>[0]['test'],
      createAdminClient: () => client,
      loadPlatformEnv: () => fakeEnv,
    });

    testCase('TC-001', async () => {});
    await mockTest.lastFn!({}, {});

    expect(mockTest.stepCalls).toHaveLength(1);
    expect(mockTest.stepCalls[0].title).toBe('resolve test case TC-001');
  });

  it('propagates resolve error and does not call user callback', async () => {
    const mockTest = createMockTest();
    const boom = new Error('resolve failed');
    const client = makeClient(boom);
    const userFn = vi.fn(async () => {});
    const testCase = createTestCase({
      test: mockTest as unknown as Parameters<typeof createTestCase>[0]['test'],
      createAdminClient: () => client,
      loadPlatformEnv: () => fakeEnv,
    });

    testCase('TC-001', userFn);

    await expect(mockTest.lastFn!({}, {})).rejects.toThrow('resolve failed');
    expect(userFn).not.toHaveBeenCalled();
  });
});
