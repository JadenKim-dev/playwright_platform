import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventBatcher } from './event-batcher.js';

describe('EventBatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does not flush before chunkSize is reached', () => {
    const flush = vi.fn<(items: number[]) => Promise<void>>().mockResolvedValue(undefined);
    const batcher = new EventBatcher<number>(3, 100000, flush, vi.fn());
    batcher.push(1);
    batcher.push(2);
    expect(flush).not.toHaveBeenCalled();
  });

  it('flushes when buffer hits chunkSize and passes accumulated items', async () => {
    const flush = vi.fn<(items: number[]) => Promise<void>>().mockResolvedValue(undefined);
    const batcher = new EventBatcher<number>(2, 100000, flush, vi.fn());
    batcher.push(1);
    batcher.push(2);
    await vi.runAllTimersAsync();
    await Promise.resolve();
    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush.mock.calls[0][0]).toEqual([1, 2]);
  });

  it('start() schedules periodic flushes via setInterval', async () => {
    const flush = vi.fn<(items: number[]) => Promise<void>>().mockResolvedValue(undefined);
    const batcher = new EventBatcher<number>(1000, 100, flush, vi.fn());
    batcher.start();
    batcher.push(1);
    await vi.advanceTimersByTimeAsync(150);
    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush.mock.calls[0][0]).toEqual([1]);
  });

  it('stop() clears the periodic interval so no further flushes occur', async () => {
    const flush = vi.fn<(items: number[]) => Promise<void>>().mockResolvedValue(undefined);
    const batcher = new EventBatcher<number>(1000, 100, flush, vi.fn());
    batcher.start();
    batcher.stop();
    batcher.push(1);
    await vi.advanceTimersByTimeAsync(500);
    expect(flush).not.toHaveBeenCalled();
  });

  it('flush() is a no-op when buffer is empty', async () => {
    const flush = vi.fn<(items: number[]) => Promise<void>>().mockResolvedValue(undefined);
    const batcher = new EventBatcher<number>(10, 100000, flush, vi.fn());
    await batcher.flush();
    expect(flush).not.toHaveBeenCalled();
  });

  it('flush() drains remaining buffered items', async () => {
    const flush = vi.fn<(items: number[]) => Promise<void>>().mockResolvedValue(undefined);
    const batcher = new EventBatcher<number>(1000, 100000, flush, vi.fn());
    batcher.push(1);
    batcher.push(2);
    batcher.push(3);
    await batcher.flush();
    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush.mock.calls[0][0]).toEqual([1, 2, 3]);
  });

  it('serializes concurrent flushes: a push during in-flight flush does not double-call flush', async () => {
    let resolveFirst: (() => void) | null = null;
    const firstPromise = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });
    const flush = vi
      .fn<(items: number[]) => Promise<void>>()
      .mockImplementationOnce(() => firstPromise)
      .mockResolvedValue(undefined);
    const batcher = new EventBatcher<number>(1, 100000, flush, vi.fn());
    batcher.push(1);
    await Promise.resolve();
    batcher.push(2);
    await Promise.resolve();
    expect(flush).toHaveBeenCalledTimes(1);
    resolveFirst!();
    await firstPromise;
    await Promise.resolve();
  });

  it('invokes onFatal when flush rejects', async () => {
    const onFatal = vi.fn();
    const flush = vi
      .fn<(items: number[]) => Promise<void>>()
      .mockRejectedValue(new Error('boom'));
    const batcher = new EventBatcher<number>(1, 100000, flush, onFatal);
    batcher.push(1);
    await vi.runAllTimersAsync();
    await Promise.resolve();
    await Promise.resolve();
    expect(onFatal).toHaveBeenCalledTimes(1);
    expect((onFatal.mock.calls[0][0] as Error).message).toBe('boom');
  });
});
