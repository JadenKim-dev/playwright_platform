import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ReporterEventBatch, RunCompleteDto, RunItemStatusUpdateDto } from '@platform/shared';
import { RunItemStatus } from '@platform/shared';
import { AdminClient } from '../src/client.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function emptyResponse(status = 204): Response {
  return new Response(null, { status });
}

const baseOpts = {
  adminUrl: 'http://admin.local',
  runId: 'run-1',
  itemId: 'item-1',
  internalApiToken: 'token-xyz',
  timeoutMs: 50,
  baseBackoffMs: 1,
};

describe('AdminClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('resolve calls correct URL and headers and parses JSON', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ params: { a: 1 }, expected: { b: 2 } }));
    const client = new AdminClient({ ...baseOpts, fetchFn });

    const result = await client.resolve('TC-001');

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('http://admin.local/internal/runs/run-1/test-case/TC-001/resolve');
    expect(init?.method).toBe('GET');
    const headers = init?.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['X-Internal-Token']).toBe('token-xyz');
    expect(result).toEqual({ params: { a: 1 }, expected: { b: 2 } });
  });

  it('postEvents POSTs JSON.stringify(batch)', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(emptyResponse(204));
    const client = new AdminClient({ ...baseOpts, fetchFn });

    const batch: ReporterEventBatch = { events: [] };
    await client.postEvents(batch);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('http://admin.local/internal/runs/run-1/events');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(JSON.stringify(batch));
  });

  it('complete POSTs', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(emptyResponse(204));
    const client = new AdminClient({ ...baseOpts, fetchFn });

    const body: RunCompleteDto = { playwrightReportKey: 'reports/run-1.zip' };
    await client.complete(body);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('http://admin.local/internal/runs/run-1/complete');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(JSON.stringify(body));
  });

  it('retries up to 3 times on 5xx and resolves on 3rd attempt success', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('err', { status: 500 }))
      .mockResolvedValueOnce(new Response('err', { status: 503 }))
      .mockResolvedValueOnce(jsonResponse({ params: {}, expected: {} }));
    const client = new AdminClient({ ...baseOpts, maxRetries: 3, fetchFn });

    const promise = client.resolve('TC-001');
    await vi.advanceTimersByTimeAsync(10);
    const result = await promise;

    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ params: {}, expected: {} });
  });

  it('throws immediately on 4xx without retry', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(new Response('bad', { status: 400 }));
    const client = new AdminClient({ ...baseOpts, maxRetries: 3, fetchFn });

    await expect(client.resolve('TC-001')).rejects.toThrow();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('retries on network error (fetch rejects)', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('network down'))
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(jsonResponse({ params: {}, expected: {} }));
    const client = new AdminClient({ ...baseOpts, maxRetries: 3, fetchFn });

    const promise = client.resolve('TC-001');
    await vi.advanceTimersByTimeAsync(10);
    const result = await promise;

    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ params: {}, expected: {} });
  });

  it('sends X-Internal-Token header with injected token value', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(emptyResponse(204));
    const client = new AdminClient({
      ...baseOpts,
      internalApiToken: 'super-secret-token',
      fetchFn,
    });

    await client.postEvents({ events: [] });

    const [, init] = fetchFn.mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers['X-Internal-Token']).toBe('super-secret-token');
  });

  it('updateItemStatus POSTs to items/{itemId}/status with body and token header', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(emptyResponse(204));
    const client = new AdminClient({ ...baseOpts, fetchFn });

    const body: RunItemStatusUpdateDto = { status: RunItemStatus.Passed, durationMs: 42 };
    await client.updateItemStatus(body);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('http://admin.local/internal/runs/run-1/items/item-1/status');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(JSON.stringify(body));
    const headers = init?.headers as Record<string, string>;
    expect(headers['X-Internal-Token']).toBe('token-xyz');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('updateItemStatus URL-encodes itemId with special characters', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(emptyResponse(204));
    const client = new AdminClient({ ...baseOpts, itemId: 'item with space', fetchFn });

    await client.updateItemStatus({ status: RunItemStatus.Failed });

    const [url] = fetchFn.mock.calls[0];
    expect(url).toBe('http://admin.local/internal/runs/run-1/items/item%20with%20space/status');
  });

  it('throws after retries exhausted when AbortError is raised repeatedly', async () => {
    const abortError = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const fetchFn = vi.fn<typeof fetch>().mockRejectedValue(abortError);
    const client = new AdminClient({
      ...baseOpts,
      maxRetries: 2,
      fetchFn,
    });

    const promise = client.resolve('TC-001');
    const assertion = expect(promise).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(100);
    await assertion;

    expect(fetchFn).toHaveBeenCalledTimes(3);
  });
});
