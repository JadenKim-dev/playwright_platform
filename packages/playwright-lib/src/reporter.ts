import type { Reporter, TestCase, TestResult, TestStep, FullResult } from '@playwright/test/reporter';
import {
  ReporterEventType,
  RunItemStatus,
  type ReporterEvent,
  type ReporterEventBatch,
} from '@platform/shared';
import { AdminClient } from './client.js';
import { loadPlatformEnv, type PlatformEnv } from './env.js';

export interface StreamingReporterOptions {
  chunkSize?: number;
  flushIntervalMs?: number;
  client?: AdminClient;
  env?: PlatformEnv;
  onFatal?: (err: unknown) => void;
  now?: () => Date;
}

export class StreamingReporter implements Reporter {
  private readonly env: PlatformEnv;
  private readonly client: AdminClient;
  private readonly chunkSize: number;
  private readonly flushIntervalMs: number;
  private readonly onFatal: (err: unknown) => void;
  private readonly now: () => Date;

  private buffer: ReporterEvent[] = [];
  private flushing: Promise<void> | null = null;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private finalStatus: RunItemStatus = RunItemStatus.Passed;
  private finalDurationMs: number | undefined;
  private finalErrorMessage: string | undefined;

  constructor(options: StreamingReporterOptions = {}) {
    this.env = options.env ?? loadPlatformEnv();
    this.client =
      options.client ??
      new AdminClient({
        adminUrl: this.env.adminUrl,
        runId: this.env.runId,
        itemId: this.env.itemId,
        internalApiToken: this.env.internalApiToken,
      });
    this.chunkSize = options.chunkSize ?? this.env.reporterChunkSize;
    this.flushIntervalMs = options.flushIntervalMs ?? this.env.reporterFlushIntervalMs;
    this.onFatal = options.onFatal ?? ((err) => {

      console.error('[StreamingReporter] fatal:', err);
      process.exit(1);
    });
    this.now = options.now ?? (() => new Date());
  }

  onBegin(): void {
    this.intervalHandle = setInterval(() => void this.flushSafe(), this.flushIntervalMs);
  }

  onTestBegin(_test: TestCase, _result: TestResult): void {
    this.push({
      type: ReporterEventType.TestBegin,
      itemId: this.env.itemId,
      ts: this.now().toISOString(),
      payload: {},
    });
  }

  onStepBegin(_test: TestCase, _result: TestResult, step: TestStep): void {
    if (step.category !== 'test.step') return;
    this.push({
      type: ReporterEventType.StepBegin,
      itemId: this.env.itemId,
      ts: this.now().toISOString(),
      payload: { title: step.title },
    });
  }

  onStepEnd(_test: TestCase, _result: TestResult, step: TestStep): void {
    if (step.category !== 'test.step') return;
    this.push({
      type: ReporterEventType.StepEnd,
      itemId: this.env.itemId,
      ts: this.now().toISOString(),
      payload: {
        title: step.title,
        durationMs: step.duration,
        errorMessage: step.error?.message,
      },
    });
  }

  onTestEnd(_test: TestCase, result: TestResult): void {
    const status = mapStatus(result.status);
    this.finalStatus = status;
    this.finalDurationMs = result.duration;
    this.finalErrorMessage = result.error?.message;
    this.push({
      type: ReporterEventType.TestEnd,
      itemId: this.env.itemId,
      ts: this.now().toISOString(),
      payload: {
        status,
        durationMs: result.duration,
        errorMessage: result.error?.message,
      },
    });
  }

  onStdOut(chunk: string | Buffer): void {
    this.push({
      type: ReporterEventType.Stdout,
      itemId: this.env.itemId,
      ts: this.now().toISOString(),
      payload: { text: chunk.toString() },
    });
  }

  onStdErr(chunk: string | Buffer): void {
    this.push({
      type: ReporterEventType.Stderr,
      itemId: this.env.itemId,
      ts: this.now().toISOString(),
      payload: { text: chunk.toString() },
    });
  }

  async onEnd(_result: FullResult): Promise<void> {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    await this.flushSafe();
    try {
      await this.client.updateItemStatus({
        status: this.finalStatus,
        durationMs: this.finalDurationMs,
        errorMessage: this.finalErrorMessage,
      });
    } catch (err) {
      this.onFatal(err);
    }
  }

  private push(ev: ReporterEvent): void {
    this.buffer.push(ev);
    if (this.buffer.length >= this.chunkSize) void this.flushSafe();
  }

  private async flushSafe(): Promise<void> {
    if (this.flushing) return this.flushing;
    if (this.buffer.length === 0) return;
    const events = this.buffer.splice(0, this.buffer.length);
    const batch: ReporterEventBatch = { events };
    this.flushing = this.client
      .postEvents(batch)
      .catch((err) => this.onFatal(err))
      .finally(() => {
        this.flushing = null;
      });
    return this.flushing;
  }
}

function mapStatus(s: TestResult['status']): RunItemStatus {
  switch (s) {
    case 'passed':
      return RunItemStatus.Passed;
    case 'skipped':
      return RunItemStatus.Skipped;
    case 'failed':
    case 'timedOut':
    case 'interrupted':
    default:
      return RunItemStatus.Failed;
  }
}
