import type { RunItemDto } from '@platform/shared';
import type { TestRunItem } from './test-run-item.entity';

export function toRunItemDto(entity: TestRunItem): RunItemDto {
  return {
    id: entity.id,
    testRunId: entity.testRun.id,
    testCaseId: entity.testCase.id,
    testFileId: entity.testFile.id,
    status: entity.status,
    durationMs: entity.durationMs,
    errorMessage: entity.errorMessage,
    paramsSnapshot: entity.paramsSnapshot,
    expectedSnapshot: entity.expectedSnapshot,
    startedAt: entity.startedAt ? entity.startedAt.toISOString() : null,
    finishedAt: entity.finishedAt ? entity.finishedAt.toISOString() : null,
  };
}
