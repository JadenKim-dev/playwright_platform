import type {
  Reporter,
  TestCase,
  TestResult,
  TestStep,
  FullResult,
} from '@playwright/test/reporter';
import {
  ReporterEventType,
  RunItemStatus,
  type ReporterEvent,
  type ReporterEventBatch,
} from '@platform/shared';
import { AdminClient } from './client.js';
import { loadPlatformEnv, type PlatformEnv } from './env.js';
import { EventBatcher } from './event-batcher.js';

export interface StreamingReporterOptions {
  chunkSize?: number;
  flushIntervalMs?: number;
  client?: AdminClient;
  env?: PlatformEnv;
  onFatal?: (err: unknown) => void;
  now?: () => Date;
}

/**
 * Playwright reporter that buffers test events and streams them in batches to the platform Admin server.
 *
 * Collects test/step begin-end and stdout/stderr events, flushing on chunk size or
 * a periodic interval. On run completion, updates the item status with the final
 * outcome, duration, and error message.
 */
export class StreamingReporter implements Reporter {
  private readonly env: PlatformEnv;
  private readonly client: AdminClient;
  private readonly onFatal: (err: unknown) => void;
  private readonly now: () => Date;
  private readonly batcher: EventBatcher<ReporterEvent>;

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
    this.onFatal =
      options.onFatal ??
      ((err) => {
        console.error('[StreamingReporter] fatal:', err);
        process.exit(1);
      });
    this.now = options.now ?? (() => new Date());
    this.batcher = new EventBatcher<ReporterEvent>(
      options.chunkSize ?? this.env.reporterChunkSize,
      options.flushIntervalMs ?? this.env.reporterFlushIntervalMs,
      (events) => {
        const batch: ReporterEventBatch = { events };
        return this.client.postEvents(batch);
      },
      (err) => this.onFatal(err),
    );
  }

  onBegin(): void {
    this.batcher.start();
  }

  onTestBegin(_test: TestCase, _result: TestResult): void {
    this.batcher.push({
      type: ReporterEventType.TestBegin,
      itemId: this.env.itemId,
      ts: this.now().toISOString(),
      payload: {},
    });
  }

  onStepBegin(_test: TestCase, _result: TestResult, step: TestStep): void {
    if (step.category !== 'test.step') return;
    this.batcher.push({
      type: ReporterEventType.StepBegin,
      itemId: this.env.itemId,
      ts: this.now().toISOString(),
      payload: { title: step.title },
    });
  }

  onStepEnd(_test: TestCase, _result: TestResult, step: TestStep): void {
    if (step.category !== 'test.step') return;
    this.batcher.push({
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
    const status = StreamingReporter.mapStatus(result.status);
    this.finalStatus = status;
    this.finalDurationMs = result.duration;
    this.finalErrorMessage = result.error?.message;
    this.batcher.push({
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
    this.batcher.push({
      type: ReporterEventType.Stdout,
      itemId: this.env.itemId,
      ts: this.now().toISOString(),
      payload: { text: chunk.toString() },
    });
  }

  onStdErr(chunk: string | Buffer): void {
    this.batcher.push({
      type: ReporterEventType.Stderr,
      itemId: this.env.itemId,
      ts: this.now().toISOString(),
      payload: { text: chunk.toString() },
    });
  }

  async onEnd(_result: FullResult): Promise<void> {
    this.batcher.stop();
    await this.batcher.flush();
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

  private static mapStatus(s: TestResult['status']): RunItemStatus {
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
}
