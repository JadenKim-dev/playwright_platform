export interface PlatformEnv {
  runId: string;
  itemId: string;
  adminUrl: string;
  internalApiToken: string;
  reporterChunkSize: number;
  reporterFlushIntervalMs: number;
}

export function loadPlatformEnv(source: NodeJS.ProcessEnv = process.env): PlatformEnv {
  const errors: string[] = [];

  const requireString = (key: string): string => {
    const value = source[key];
    if (value === undefined || value === '') {
      errors.push(`${key}: required`);
      return '';
    }
    return value;
  };

  const parsePositiveInt = (key: string, fallback: number): number => {
    const raw = source[key];
    if (raw === undefined || raw === '') return fallback;
    const value = Number(raw);
    if (!Number.isInteger(value) || value <= 0) {
      errors.push(`${key}: must be a positive integer`);
      return fallback;
    }
    return value;
  };

  const env: PlatformEnv = {
    runId: requireString('PLATFORM_RUN_ID'),
    itemId: requireString('PLATFORM_ITEM_ID'),
    adminUrl: requireString('PLATFORM_ADMIN_URL'),
    internalApiToken: requireString('PLATFORM_INTERNAL_API_TOKEN'),
    reporterChunkSize: parsePositiveInt('PLATFORM_REPORTER_CHUNK_SIZE', 50),
    reporterFlushIntervalMs: parsePositiveInt('PLATFORM_REPORTER_FLUSH_INTERVAL_MS', 2000),
  };

  if (errors.length > 0) {
    throw new Error(`Invalid env:\n  - ${errors.join('\n  - ')}`);
  }
  return env;
}
