import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpClient, HttpRequestError } from './http-client.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const url = 'http://example.local/resource';

describe('HttpClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('retries up to maxRetries on 5xx and resolves on eventual success', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('err', { status: 500 }))
      .mockResolvedValueOnce(new Response('err', { status: 503 }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const http = new HttpClient({ maxRetries: 3, baseBackoffMs: 1, fetchFn });

    const promise = http.requestJson<{ ok: boolean }>('GET', url);
    await vi.advanceTimersByTimeAsync(10);
    const result = await promise;

    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ ok: true });
  });

  it('throws HttpRequestError immediately on 4xx without retry', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(new Response('bad', { status: 400 }));
    const http = new HttpClient({ maxRetries: 3, baseBackoffMs: 1, fetchFn });

    await expect(http.requestJson('GET', url)).rejects.toBeInstanceOf(HttpRequestError);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('retries on network error (fetch rejects)', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('network down'))
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const http = new HttpClient({ maxRetries: 3, baseBackoffMs: 1, fetchFn });

    const promise = http.requestJson<{ ok: boolean }>('GET', url);
    await vi.advanceTimersByTimeAsync(10);
    const result = await promise;

    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ ok: true });
  });

  it('throws after retries exhausted when AbortError is raised repeatedly', async () => {
    const abortError = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const fetchFn = vi.fn<typeof fetch>().mockRejectedValue(abortError);
    const http = new HttpClient({ maxRetries: 2, baseBackoffMs: 1, timeoutMs: 50, fetchFn });

    const promise = http.requestJson('GET', url);
    const assertion = expect(promise).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(100);
    await assertion;

    expect(fetchFn).toHaveBeenCalledTimes(3);
  });
});
