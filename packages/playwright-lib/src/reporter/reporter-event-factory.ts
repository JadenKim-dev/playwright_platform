import { ReporterEventType, RunItemStatus, type ReporterEvent } from '@platform/shared';

// Narrow input shapes — depend only on fields actually consumed, not the full
// Playwright TestStep / TestResult types. Keeps the factory unit-testable
// without pulling in @playwright/test types.
export interface StepBeginInput {
  title: string;
}
export interface StepEndInput {
  title: string;
  duration: number;
  error?: { message?: string };
}
export interface TestEndInput {
  status: 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted';
  duration: number;
  error?: { message?: string };
}

/**
 * Builds ReporterEvent payloads from Playwright callback data.
 *
 * Centralizes the repeated `{ type, itemId, ts, payload }` envelope so the
 * Reporter only orchestrates flow, and ReporterEvent schema changes touch a
 * single place.
 */
export class ReporterEventFactory {
  constructor(
    private readonly itemId: string,
    private readonly now: () => Date,
  ) {}

  testBegin(): ReporterEvent {
    return this.envelope(ReporterEventType.TestBegin, {});
  }

  stepBegin(step: StepBeginInput): ReporterEvent {
    return this.envelope(ReporterEventType.StepBegin, { title: step.title });
  }

  stepEnd(step: StepEndInput): ReporterEvent {
    return this.envelope(ReporterEventType.StepEnd, {
      title: step.title,
      durationMs: step.duration,
      errorMessage: step.error?.message,
    });
  }

  testEnd(result: TestEndInput): ReporterEvent {
    return this.envelope(ReporterEventType.TestEnd, {
      status: ReporterEventFactory.mapStatus(result.status),
      durationMs: result.duration,
      errorMessage: result.error?.message,
    });
  }

  stdout(chunk: string | Buffer): ReporterEvent {
    return this.envelope(ReporterEventType.Stdout, { text: chunk.toString() });
  }

  stderr(chunk: string | Buffer): ReporterEvent {
    return this.envelope(ReporterEventType.Stderr, { text: chunk.toString() });
  }

  static mapStatus(s: TestEndInput['status']): RunItemStatus {
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

  private envelope(
    type: ReporterEventType,
    payload: ReporterEvent['payload'],
  ): ReporterEvent {
    return {
      type,
      itemId: this.itemId,
      ts: this.now().toISOString(),
      payload,
    } as ReporterEvent;
  }
}
