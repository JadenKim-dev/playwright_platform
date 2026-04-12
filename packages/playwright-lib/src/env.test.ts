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

  it('defaults a numeric env when its value is an empty string', () => {
    const result = loadPlatformEnv({ ...baseEnv, PLATFORM_REPORTER_CHUNK_SIZE: '' });
    expect(result.reporterChunkSize).toBe(50);
  });

  it('throws when a required env is an empty string', () => {
    expect(() => loadPlatformEnv({ ...baseEnv, PLATFORM_RUN_ID: '' })).toThrow(/PLATFORM_RUN_ID/);
  });

  it('throws when a numeric env is zero or negative', () => {
    expect(() => loadPlatformEnv({ ...baseEnv, PLATFORM_REPORTER_CHUNK_SIZE: '0' })).toThrow(
      /PLATFORM_REPORTER_CHUNK_SIZE/,
    );
    expect(() =>
      loadPlatformEnv({ ...baseEnv, PLATFORM_REPORTER_FLUSH_INTERVAL_MS: '-10' }),
    ).toThrow(/PLATFORM_REPORTER_FLUSH_INTERVAL_MS/);
  });

  it('throws when a numeric env is not an integer', () => {
    expect(() => loadPlatformEnv({ ...baseEnv, PLATFORM_REPORTER_CHUNK_SIZE: '1.5' })).toThrow(
      /PLATFORM_REPORTER_CHUNK_SIZE/,
    );
  });

  it('reports all invalid envs in a single error', () => {
    expect(() =>
      loadPlatformEnv({
        PLATFORM_RUN_ID: 'run-1',
        PLATFORM_ITEM_ID: 'item-1',
      }),
    ).toThrow(/PLATFORM_ADMIN_URL[\s\S]*PLATFORM_INTERNAL_API_TOKEN/);
  });
});
