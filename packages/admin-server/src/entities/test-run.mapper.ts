import type { RunDto } from '@platform/shared';
import type { TestRun } from './test-run.entity';

export function toRunDto(entity: TestRun): RunDto {
  return {
    id: entity.id,
    deploymentId: entity.deployment.id,
    requestedTestCaseIds: entity.requestedTestCaseIds,
    status: entity.status,
    requestedAt: entity.requestedAt.toISOString(),
    startedAt: entity.startedAt ? entity.startedAt.toISOString() : null,
    finishedAt: entity.finishedAt ? entity.finishedAt.toISOString() : null,
    playwrightReportKey: entity.playwrightReportKey,
  };
}
