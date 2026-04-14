import type {
  ReporterEventBatch,
  ResolvedTestCaseDto,
  RunCompleteDto,
  RunItemStatusUpdateDto,
} from '@platform/shared';
import { HttpClient } from './http-client.js';

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

/**
 * HTTP client for the Admin server's internal API, bound to a single run and item.
 */
export class AdminClient {
  private readonly adminUrl: string;
  private readonly runId: string;
  private readonly itemId: string;
  private readonly token: string;
  private readonly httpClient: HttpClient;

  constructor(opts: AdminClientOptions) {
    this.adminUrl = opts.adminUrl.replace(/\/$/, '');
    this.runId = opts.runId;
    this.itemId = opts.itemId;
    this.token = opts.internalApiToken;
    this.httpClient = new HttpClient({
      timeoutMs: opts.timeoutMs,
      maxRetries: opts.maxRetries,
      baseBackoffMs: opts.baseBackoffMs,
      fetchFn: opts.fetchFn,
    });
  }

  async resolve(tcId: string): Promise<ResolvedTestCaseDto> {
    const url = `${this.adminUrl}/internal/runs/${encodeURIComponent(this.runId)}/test-case/${encodeURIComponent(tcId)}/resolve`;
    return this.request<ResolvedTestCaseDto>('GET', url);
  }

  async postEvents(batch: ReporterEventBatch): Promise<void> {
    const url = `${this.adminUrl}/internal/runs/${encodeURIComponent(this.runId)}/events`;
    await this.request<void>('POST', url, batch);
  }

  async complete(body: RunCompleteDto): Promise<void> {
    const url = `${this.adminUrl}/internal/runs/${encodeURIComponent(this.runId)}/complete`;
    await this.request<void>('POST', url, body);
  }

  async updateItemStatus(body: RunItemStatusUpdateDto): Promise<void> {
    const url = `${this.adminUrl}/internal/runs/${encodeURIComponent(this.runId)}/items/${encodeURIComponent(this.itemId)}/status`;
    await this.request<void>('POST', url, body);
  }

  private async request<T>(method: string, url: string, body?: unknown): Promise<T> {
    return this.httpClient.requestJson<T>(method, url, {
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': this.token,
      },
      body,
    });
  }
}
