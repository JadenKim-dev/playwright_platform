import { describe, it, expect } from 'vitest';
import {
  DeploymentStatus,
  RunStatus,
  RunItemStatus,
} from '../src/constants/statuses.js';

describe('statuses', () => {
  it('DeploymentStatus covers full pipeline lifecycle', () => {
    const values = Object.values(DeploymentStatus);
    expect(values).toEqual([
      'pending',
      'cloning',
      'bundling',
      'uploading',
      'mapping',
      'success',
      'failed',
    ]);
  });

  it('RunStatus has queued/running/success/failed/partial', () => {
    const values = Object.values(RunStatus);
    expect(values).toEqual(['queued', 'running', 'success', 'failed', 'partial']);
  });

  it('RunItemStatus has pending/running/passed/failed/skipped/timedout', () => {
    const values = Object.values(RunItemStatus);
    expect(values).toEqual([
      'pending',
      'running',
      'passed',
      'failed',
      'skipped',
      'timedout',
    ]);
  });
});
