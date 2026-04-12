import { describe, it, expect } from 'vitest';
import { loadPlatformEnv } from './env.js';

const baseEnv = {
  PLATFORM_RUN_ID: 'run-1',
  PLATFORM_ITEM_ID: 'item-1',
  PLATFORM_ADMIN_URL: 'http://admin.local',
  PLATFORM_INTERNAL_API_TOKEN: 'token-xyz',
};

describe('loadPlatformEnv', () => {
  it('returns an object with correct fields when all required envs are present', () => {
    const result = loadPlatformEnv({
      ...baseEnv,
      PLATFORM_REPORTER_CHUNK_SIZE: '10',
      PLATFORM_REPORTER_FLUSH_INTERVAL_MS: '500',
    });
    expect(result).toEqual({
      runId: 'run-1',
      itemId: 'item-1',
      adminUrl: 'http://admin.local',
      internalApiToken: 'token-xyz',
      reporterChunkSize: 10,
      reporterFlushIntervalMs: 500,
    });
  });

  it('throws with env name in message when a required env is missing', () => {
    const missing: Partial<typeof baseEnv> = { ...baseEnv };
    delete missing.PLATFORM_RUN_ID;
    expect(() => loadPlatformEnv(missing)).toThrow(/PLATFORM_RUN_ID/);
  });

  it('defaults PLATFORM_REPORTER_CHUNK_SIZE to 50 when not set', () => {
    const result = loadPlatformEnv({ ...baseEnv });
    expect(result.reporterChunkSize).toBe(50);
  });

  it('defaults PLATFORM_REPORTER_FLUSH_INTERVAL_MS to 2000 when not set', () => {
    const result = loadPlatformEnv({ ...baseEnv });
    expect(result.reporterFlushIntervalMs).toBe(2000);
  });

  it('throws when a numeric env contains a non-numeric value', () => {
    expect(() => loadPlatformEnv({ ...baseEnv, PLATFORM_REPORTER_CHUNK_SIZE: 'abc' })).toThrow(
      /PLATFORM_REPORTER_CHUNK_SIZE/,
    );
  });
});
