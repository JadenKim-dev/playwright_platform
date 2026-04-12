import type { ReporterEventType, RunItemStatus } from '../constants/index.js';

export interface ReporterEventBase {
  itemId: string;
  ts: string;
}

export interface TestBeginEvent extends ReporterEventBase {
  type: typeof ReporterEventType.TestBegin;
  payload: Record<string, never>;
}

export interface TestEndEvent extends ReporterEventBase {
  type: typeof ReporterEventType.TestEnd;
  payload: {
    status: RunItemStatus;
    durationMs: number;
    errorMessage?: string;
  };
}

export interface StepBeginEvent extends ReporterEventBase {
  type: typeof ReporterEventType.StepBegin;
  payload: { title: string };
}

export interface StepEndEvent extends ReporterEventBase {
  type: typeof ReporterEventType.StepEnd;
  payload: { title: string; durationMs: number; errorMessage?: string };
}

export interface StdoutEvent extends ReporterEventBase {
  type: typeof ReporterEventType.Stdout;
  payload: { text: string };
}

export interface StderrEvent extends ReporterEventBase {
  type: typeof ReporterEventType.Stderr;
  payload: { text: string };
}

export type ReporterEvent =
  | TestBeginEvent
  | TestEndEvent
  | StepBeginEvent
  | StepEndEvent
  | StdoutEvent
  | StderrEvent;

export interface ReporterEventBatch {
  events: ReporterEvent[];
}
