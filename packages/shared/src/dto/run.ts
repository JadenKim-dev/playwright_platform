import type { RunItemStatus, RunStatus } from '../constants/statuses.js';

export interface RunDto {
  id: string;
  deploymentId: string;
  requestedTestCaseIds: string[];
  status: RunStatus;
  requestedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  playwrightReportKey: string | null;
}

export interface RunItemDto {
  id: string;
  testRunId: string;
  testCaseId: string;
  testFileId: string;
  status: RunItemStatus;
  durationMs: number | null;
  errorMessage: string | null;
  paramsSnapshot: Record<string, unknown>;
  expectedSnapshot: Record<string, unknown>;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface RunCreateDto {
  testCaseIds: string[];
  paramOverrides?: Record<string, Record<string, unknown>>;
}

export interface RunItemStatusUpdateDto {
  status: RunItemStatus;
  durationMs?: number;
  errorMessage?: string | null;
}

export interface RunCompleteDto {
  playwrightReportKey?: string | null;
}
