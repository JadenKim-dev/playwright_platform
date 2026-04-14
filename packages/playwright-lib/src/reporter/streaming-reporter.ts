import type {
  Reporter,
  TestCase,
  TestResult,
  TestStep,
  FullResult,
} from '@playwright/test/reporter';
import {
  RunItemStatus,
  type ReporterEvent,
  type ReporterEventBatch,
} from '@platform/shared';
import { AdminClient } from '../admin/admin-client.js';
import { loadPlatformEnv, type PlatformEnv } from '../env/platform-env.js';
import { EventBatcher } from './event-batcher.js';
import { ReporterEventFactory } from './reporter-event-factory.js';

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
  private readonly adminClient: AdminClient;
  private readonly onFatal: (err: unknown) => void;
  private readonly eventBatcher: EventBatcher<ReporterEvent>;
  private readonly eventFactory: ReporterEventFactory;

  private finalStatus: RunItemStatus = RunItemStatus.Passed;
  private finalDurationMs: number | undefined;
  private finalErrorMessage: string | undefined;

  constructor(options: StreamingReporterOptions = {}) {
    this.env = options.env ?? loadPlatformEnv();
    this.adminClient =
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
    const now = options.now ?? (() => new Date());
    this.eventFactory = new ReporterEventFactory(this.env.itemId, now);
    this.eventBatcher = new EventBatcher<ReporterEvent>(
      options.chunkSize ?? this.env.reporterChunkSize,
      options.flushIntervalMs ?? this.env.reporterFlushIntervalMs,
      (events) => {
        const batch: ReporterEventBatch = { events };
        return this.adminClient.postEvents(batch);
      },
      (err) => this.onFatal(err),
    );
  }

  onBegin(): void {
    this.eventBatcher.start();
  }

  onTestBegin(_test: TestCase, _result: TestResult): void {
    this.eventBatcher.push(this.eventFactory.testBegin());
  }

  onStepBegin(_test: TestCase, _result: TestResult, step: TestStep): void {
    if (step.category !== 'test.step') return;
    this.eventBatcher.push(this.eventFactory.stepBegin(step));
  }

  onStepEnd(_test: TestCase, _result: TestResult, step: TestStep): void {
    if (step.category !== 'test.step') return;
    this.eventBatcher.push(this.eventFactory.stepEnd(step));
  }

  onTestEnd(_test: TestCase, result: TestResult): void {
    this.finalStatus = ReporterEventFactory.mapStatus(result.status);
    this.finalDurationMs = result.duration;
    this.finalErrorMessage = result.error?.message;
    this.eventBatcher.push(this.eventFactory.testEnd(result));
  }

  onStdOut(chunk: string | Buffer): void {
    this.eventBatcher.push(this.eventFactory.stdout(chunk));
  }

  onStdErr(chunk: string | Buffer): void {
    this.eventBatcher.push(this.eventFactory.stderr(chunk));
  }

  async onEnd(_result: FullResult): Promise<void> {
    this.eventBatcher.stop();
    await this.eventBatcher.flush();
    try {
      await this.adminClient.updateItemStatus({
        status: this.finalStatus,
        durationMs: this.finalDurationMs,
        errorMessage: this.finalErrorMessage,
      });
    } catch (err) {
      this.onFatal(err);
    }
  }
}
