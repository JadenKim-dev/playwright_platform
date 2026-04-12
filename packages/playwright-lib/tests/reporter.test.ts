import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ReporterEventType,
  RunItemStatus,
  type ReporterEventBatch,
  type RunItemStatusUpdateDto,
} from '@platform/shared';
import { StreamingReporter } from '../src/reporter.js';
import type { AdminClient } from '../src/client.js';
import type { PlatformEnv } from '../src/env.js';

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
function makeTestResult(partial: Partial<{ status: string; duration: number; error: { message: string } }> = {}) {
  return {
    status: partial.status ?? 'passed',
    duration: partial.duration ?? 0,
    error: partial.error,
  } as unknown;
}
function makeStep(category: string, title = 'step title', duration = 10, error?: { message: string }) {
  return { category, title, duration, error } as unknown;
}

describe('StreamingReporter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('onTestBegin pushes a TestBegin event to the buffer', () => {
    const client = makeClient();
    const reporter = new StreamingReporter({
      env: fakeEnv,
      client: client as unknown as AdminClient,
      chunkSize: 100,
      flushIntervalMs: 100000,
    });
    // @ts-expect-error duck typed
    reporter.onTestBegin(makeTestCase(), makeTestResult());
    expect(client.postEvents).not.toHaveBeenCalled();
  });

  it('flushes when buffer hits chunkSize (events length = chunkSize)', async () => {
    const client = makeClient();
    const reporter = new StreamingReporter({
      env: fakeEnv,
      client: client as unknown as AdminClient,
      chunkSize: 2,
      flushIntervalMs: 100000,
    });
    // @ts-expect-error duck typed
    reporter.onTestBegin(makeTestCase(), makeTestResult());
    // @ts-expect-error duck typed
    reporter.onTestBegin(makeTestCase(), makeTestResult());
    await vi.runAllTimersAsync();
    await Promise.resolve();
    expect(client.postEvents).toHaveBeenCalledTimes(1);
    const arg = client.postEvents.mock.calls[0][0] as ReporterEventBatch;
    expect(arg.events).toHaveLength(2);
  });

  it('periodically flushes via setInterval on flushIntervalMs', async () => {
    const client = makeClient();
    const reporter = new StreamingReporter({
      env: fakeEnv,
      client: client as unknown as AdminClient,
      chunkSize: 1000,
      flushIntervalMs: 100,
    });
    reporter.onBegin();
    // @ts-expect-error duck typed
    reporter.onTestBegin(makeTestCase(), makeTestResult());
    await vi.advanceTimersByTimeAsync(150);
    expect(client.postEvents).toHaveBeenCalledTimes(1);
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

  it('onStepBegin ignores steps whose category is not test.step', () => {
    const client = makeClient();
    const reporter = new StreamingReporter({
      env: fakeEnv,
      client: client as unknown as AdminClient,
      chunkSize: 1000,
      flushIntervalMs: 100000,
    });
    // @ts-expect-error duck typed
    reporter.onStepBegin(makeTestCase(), makeTestResult(), makeStep('hook', 'beforeAll'));
    // @ts-expect-error duck typed
    reporter.onStepBegin(makeTestCase(), makeTestResult(), makeStep('fixture', 'page'));
    // @ts-expect-error duck typed
    reporter.onStepBegin(makeTestCase(), makeTestResult(), makeStep('test.step', 'user step'));
    // buffer should have only 1 event — force flush via chunkSize=1 is simpler but we inspect via onEnd
    // trigger a no-op onTestEnd to then flush
    // @ts-expect-error duck typed
    reporter.onTestEnd(makeTestCase(), makeTestResult({ status: 'passed', duration: 1 }));
    // onTestEnd pushes one event — expect buffer = 1 (step.test.step) + 1 (testEnd) = 2
    const reporterAny = reporter as unknown as { buffer: unknown[] };
    expect(reporterAny.buffer).toHaveLength(2);
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
    reporter.onTestEnd(
      makeTestCase(),
      makeTestResult({ status: 'failed', duration: 55, error: { message: 'boom' } }),
    );
    // @ts-expect-error duck typed
    await reporter.onEnd({ status: 'failed' });
    const batch = client.postEvents.mock.calls[0][0] as ReporterEventBatch;
    const testEndEvent = batch.events.find((e) => e.type === ReporterEventType.TestEnd);
    expect(testEndEvent).toBeDefined();
    expect((testEndEvent as { payload: { errorMessage?: string } }).payload.errorMessage).toBe('boom');
    expect(client.updateItemStatus.mock.calls[0][0]).toEqual({
      status: RunItemStatus.Failed,
      durationMs: 55,
      errorMessage: 'boom',
    });
  });

  it('calls onFatal when flush retries are exhausted', async () => {
    const client: FakeClient = {
      postEvents: vi
        .fn<(batch: ReporterEventBatch) => Promise<void>>()
        .mockRejectedValue(new Error('retries exhausted')),
      updateItemStatus: vi.fn().mockResolvedValue(undefined),
    };
    const onFatal = vi.fn();
    const reporter = new StreamingReporter({
      env: fakeEnv,
      client: client as unknown as AdminClient,
      chunkSize: 1,
      flushIntervalMs: 100000,
      onFatal,
    });
    // @ts-expect-error duck typed
    reporter.onTestBegin(makeTestCase(), makeTestResult());
    await vi.runAllTimersAsync();
    await Promise.resolve();
    await Promise.resolve();
    expect(onFatal).toHaveBeenCalledTimes(1);
    expect((onFatal.mock.calls[0][0] as Error).message).toBe('retries exhausted');
  });

  it('serializes concurrent flushes: two pushes during pending flush call postEvents only once for first batch', async () => {
    let resolveFirst: (() => void) | null = null;
    const firstPromise = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });
    const client: FakeClient = {
      postEvents: vi
        .fn<(batch: ReporterEventBatch) => Promise<void>>()
        .mockImplementationOnce(() => firstPromise)
        .mockResolvedValue(undefined),
      updateItemStatus: vi.fn().mockResolvedValue(undefined),
    };
    const reporter = new StreamingReporter({
      env: fakeEnv,
      client: client as unknown as AdminClient,
      chunkSize: 1,
      flushIntervalMs: 100000,
    });
    // first push triggers flush (in-flight, not yet resolved)
    // @ts-expect-error duck typed
    reporter.onTestBegin(makeTestCase(), makeTestResult());
    await Promise.resolve();
    // second push during pending flush — must NOT call postEvents again
    // @ts-expect-error duck typed
    reporter.onTestBegin(makeTestCase(), makeTestResult());
    await Promise.resolve();
    expect(client.postEvents).toHaveBeenCalledTimes(1);
    // resolve the pending flush
    resolveFirst!();
    await firstPromise;
    await Promise.resolve();
  });
});
