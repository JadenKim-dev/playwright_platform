export interface HttpClientOptions {
  timeoutMs?: number;
  maxRetries?: number;
  baseBackoffMs?: number;
  fetchFn?: typeof fetch;
}

export interface HttpRequestInit {
  headers?: Record<string, string>;
  body?: unknown;
}

export class HttpRequestError extends Error {
  constructor(
    public readonly method: string,
    public readonly url: string,
    public readonly status: number,
  ) {
    super(`${method} ${url} → ${status}`);
    this.name = 'HttpRequestError';
  }
}

export class HttpClient {
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly baseBackoffMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(opts: HttpClientOptions = {}) {
    this.timeoutMs = opts.timeoutMs ?? 10_000;
    this.maxRetries = opts.maxRetries ?? 3;
    this.baseBackoffMs = opts.baseBackoffMs ?? 100;
    this.fetchFn = opts.fetchFn ?? fetch;
  }

  async requestJson<T>(method: string, url: string, init: HttpRequestInit = {}): Promise<T> {
    return this.withRetry(async () => {
      const res = await this.fetchWithTimeout(url, {
        method,
        headers: init.headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
      if (!res.ok) throw new HttpRequestError(method, url, res.status);
      if (res.status === 204) return undefined as T;
      const ct = res.headers.get('content-type') ?? '';
      if (ct.includes('application/json')) return (await res.json()) as T;
      return undefined as T;
    });
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchFn(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        if (err instanceof HttpRequestError && err.status < 500) throw err;
        if (attempt === this.maxRetries) break;
        const delay = this.baseBackoffMs * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }
}
