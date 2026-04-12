import type { DeploymentStatus } from '../constants/statuses.js';

export interface DeploymentDto {
  id: string;
  gitRef: string;
  status: DeploymentStatus;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface DeploymentCreateDto {
  gitRef: string;
}

export interface TestFileDto {
  id: string;
  deploymentId: string;
  sourcePath: string;
  bundleKey: string;
  createdAt: string;
}

export interface DeploymentStatusUpdateDto {
  status: DeploymentStatus;
  errorMessage?: string | null;
}

export interface DeploymentMappingsDto {
  files: Array<{
    sourcePath: string;
    bundleKey: string;
  }>;
  mappings: Array<{
    testCaseId: string;
    sourcePath: string;
  }>;
}
