export const DeploymentStatus = {
  Pending: 'pending',
  Cloning: 'cloning',
  Bundling: 'bundling',
  Uploading: 'uploading',
  Mapping: 'mapping',
  Success: 'success',
  Failed: 'failed',
} as const;
export type DeploymentStatus = (typeof DeploymentStatus)[keyof typeof DeploymentStatus];

export const RunStatus = {
  Queued: 'queued',
  Running: 'running',
  Success: 'success',
  Failed: 'failed',
  Partial: 'partial',
} as const;
export type RunStatus = (typeof RunStatus)[keyof typeof RunStatus];

export const RunItemStatus = {
  Pending: 'pending',
  Running: 'running',
  Passed: 'passed',
  Failed: 'failed',
  Skipped: 'skipped',
  Timedout: 'timedout',
} as const;
export type RunItemStatus = (typeof RunItemStatus)[keyof typeof RunItemStatus];
