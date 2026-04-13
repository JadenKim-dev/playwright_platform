import type {
  TestCaseDto,
  DeploymentDto,
  TestFileDto,
  RunDto,
  RunItemDto,
} from '@platform/shared';
import type { TestCase } from '../entities/test-case.entity';
import type { Deployment } from '../entities/deployment.entity';
import type { TestFile } from '../entities/test-file.entity';
import type { TestRun } from '../entities/test-run.entity';
import type { TestRunItem } from '../entities/test-run-item.entity';

export function toTestCaseDto(entity: TestCase, isActive: boolean): TestCaseDto {
  return {
    id: entity.id,
    name: entity.name,
    description: entity.description,
    params: entity.params,
    expected: entity.expected,
    tags: entity.tags,
    autoCreated: entity.autoCreated,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
    isActive,
  };
}

export function toDeploymentDto(entity: Deployment): DeploymentDto {
  return {
    id: entity.id,
    gitRef: entity.gitRef,
    status: entity.status,
    errorMessage: entity.errorMessage,
    startedAt: entity.startedAt.toISOString(),
    finishedAt: entity.finishedAt ? entity.finishedAt.toISOString() : null,
  };
}

export function toTestFileDto(entity: TestFile): TestFileDto {
  return {
    id: entity.id,
    deploymentId: entity.deployment.id,
    sourcePath: entity.sourcePath,
    bundleKey: entity.bundleKey,
    createdAt: entity.createdAt.toISOString(),
  };
}

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
