import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ReporterEventType,
  RunItemStatus,
  type ReporterEventBatch,
  type RunItemStatusUpdateDto,
} from '@platform/shared';
import { StreamingReporter } from './reporter.js';
import type { AdminClient } from './client.js';
import type { PlatformEnv } from './env.js';

interface FakeClient {
  postEvents: ReturnType<typeof vi.fn>;
  updateItemStatus: ReturnType<typeof vi.fn>;
}

function makeClient(): FakeClient {
  return {
    postEvents: vi.fn<(batch: ReporterEventBatch) => Promise<void>>().mockResolvedValue(undefined),
    updateItemStatus: vi
      .fn<(body: RunItemStatusUpdateDto) => Promise<void>>()
      .mockResolvedValue(undefined),
  };
}

const fakeEnv: PlatformEnv = {
  runId: 'run-1',
  itemId: 'item-1',
  adminUrl: 'http://admin.local',
  internalApiToken: 'token',
  reporterChunkSize: 50,
  reporterFlushIntervalMs: 2000,
};

function makeTestCase() {
  return {} as unknown;
}
function makeTestResult(
  partial: Partial<{ status: string; duration: number; error: { message: string } }> = {},
) {
  return {
    status: partial.status ?? 'passed',
    duration: partial.duration ?? 0,
    error: partial.error,
  } as unknown;
}

describe('StreamingReporter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('onEnd flushes remaining buffer and calls updateItemStatus with captured status', async () => {
    const client = makeClient();
    const reporter = new StreamingReporter({
      env: fakeEnv,
      client: client as unknown as AdminClient,
      chunkSize: 1000,
      flushIntervalMs: 100000,
    });
    reporter.onBegin();
    // @ts-expect-error duck typed
    reporter.onTestEnd(makeTestCase(), makeTestResult({ status: 'passed', duration: 42 }));
    // @ts-expect-error duck typed
    await reporter.onEnd({ status: 'passed' });
    expect(client.postEvents).toHaveBeenCalledTimes(1);
    expect(client.updateItemStatus).toHaveBeenCalledTimes(1);
    expect(client.updateItemStatus.mock.calls[0][0]).toEqual({
      status: RunItemStatus.Passed,
      durationMs: 42,
      errorMessage: undefined,
    });
  });

  it('onStepBegin ignores steps whose category is not test.step', async () => {
    const client = makeClient();
    const reporter = new StreamingReporter({
      env: fakeEnv,
      client: client as unknown as AdminClient,
      chunkSize: 1000,
      flushIntervalMs: 100000,
    });
    // @ts-expect-error duck typed
    reporter.onStepBegin(makeTestCase(), makeTestResult(), { category: 'hook', title: 'beforeAll' });
    // @ts-expect-error duck typed
    reporter.onStepBegin(makeTestCase(), makeTestResult(), { category: 'fixture', title: 'page' });
    // @ts-expect-error duck typed
    reporter.onStepBegin(makeTestCase(), makeTestResult(), { category: 'test.step', title: 'user step' });
    // @ts-expect-error duck typed
    reporter.onTestEnd(makeTestCase(), makeTestResult({ status: 'passed', duration: 1 }));
    // @ts-expect-error duck typed
    await reporter.onEnd({ status: 'passed' });
    const batch = client.postEvents.mock.calls[0][0] as ReporterEventBatch;
    expect(batch.events.map((e) => e.type)).toEqual([
      ReporterEventType.StepBegin,
      ReporterEventType.TestEnd,
    ]);
  });

  it('onTestEnd with failed status + error passes errorMessage into event and updateItemStatus', async () => {
    const client = makeClient();
    const reporter = new StreamingReporter({
      env: fakeEnv,
      client: client as unknown as AdminClient,
      chunkSize: 1000,
      flushIntervalMs: 100000,
    });
    reporter.onBegin();
    // @ts-expect-error duck typed
    reporter.onTestEnd(makeTestCase(), makeTestResult({ status: 'failed', duration: 55, error: { message: 'boom' } }));
    // @ts-expect-error duck typed
    await reporter.onEnd({ status: 'failed' });
    const batch = client.postEvents.mock.calls[0][0] as ReporterEventBatch;
    const testEndEvent = batch.events.find((e) => e.type === ReporterEventType.TestEnd);
    expect(testEndEvent).toBeDefined();
    expect((testEndEvent as { payload: { errorMessage?: string } }).payload.errorMessage).toBe(
      'boom',
    );
    expect(client.updateItemStatus.mock.calls[0][0]).toEqual({
      status: RunItemStatus.Failed,
      durationMs: 55,
      errorMessage: 'boom',
    });
  });
});
