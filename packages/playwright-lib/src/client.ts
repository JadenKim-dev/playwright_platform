import type {
  ReporterEventBatch,
  ResolvedTestCaseDto,
  RunCompleteDto,
  RunItemStatusUpdateDto,
} from '@platform/shared';

export interface AdminClientOptions {
  adminUrl: string;
  runId: string;
  itemId: string;
  internalApiToken: string;
  timeoutMs?: number;
  maxRetries?: number;
  baseBackoffMs?: number;
  fetchFn?: typeof fetch;
}

export class AdminClient {
  private readonly adminUrl: string;
  private readonly runId: string;
  private readonly itemId: string;
  private readonly token: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly baseBackoffMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(opts: AdminClientOptions) {
    this.adminUrl = opts.adminUrl.replace(/\/$/, '');
    this.runId = opts.runId;
    this.itemId = opts.itemId;
    this.token = opts.internalApiToken;
    this.timeoutMs = opts.timeoutMs ?? 10_000;
    this.maxRetries = opts.maxRetries ?? 3;
    this.baseBackoffMs = opts.baseBackoffMs ?? 100;
    this.fetchFn = opts.fetchFn ?? fetch;
  }

  async resolve(tcId: string): Promise<ResolvedTestCaseDto> {
    const url = `${this.adminUrl}/internal/runs/${encodeURIComponent(this.runId)}/test-case/${encodeURIComponent(tcId)}/resolve`;
    return this.requestJson<ResolvedTestCaseDto>('GET', url);
  }

  async postEvents(batch: ReporterEventBatch): Promise<void> {
    const url = `${this.adminUrl}/internal/runs/${encodeURIComponent(this.runId)}/events`;
    await this.requestJson<void>('POST', url, batch);
  }

  async complete(body: RunCompleteDto): Promise<void> {
    const url = `${this.adminUrl}/internal/runs/${encodeURIComponent(this.runId)}/complete`;
    await this.requestJson<void>('POST', url, body);
  }

  async updateItemStatus(body: RunItemStatusUpdateDto): Promise<void> {
    const url = `${this.adminUrl}/internal/runs/${encodeURIComponent(this.runId)}/items/${encodeURIComponent(this.itemId)}/status`;
    await this.requestJson<void>('POST', url, body);
  }

  private async requestJson<T>(method: string, url: string, body?: unknown): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
          const res = await this.fetchFn(url, {
            method,
            headers: {
              'Content-Type': 'application/json',
              'X-Internal-Token': this.token,
            },
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: controller.signal,
          });
          if (res.status >= 500) throw new Error(`admin ${method} ${url} → ${res.status}`);
          if (!res.ok) throw new NonRetriableError(`admin ${method} ${url} → ${res.status}`);
          if (res.status === 204) return undefined as T;
          const ct = res.headers.get('content-type') ?? '';
          if (ct.includes('application/json')) return (await res.json()) as T;
          return undefined as T;
        } finally {
          clearTimeout(timer);
        }
      } catch (err) {
        lastErr = err;
        if (err instanceof NonRetriableError) throw err;
        if (attempt === this.maxRetries) break;
        const delay = this.baseBackoffMs * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }
}

class NonRetriableError extends Error {}
